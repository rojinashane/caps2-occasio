import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    ActivityIndicator,
    Image,
    Modal,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import { auth, db } from '../firebase';
import { updateDoc, doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// ─── Brand ────────────────────────────────────────────────────────────────────
const TEAL        = '#00686F';
const TEAL_DARK   = '#004E54';
const TEAL_LIGHT  = '#F0F9FA';
const TEAL_MID    = '#E0F2F3';
const TEAL_BORDER = '#B2DEDE';

// ─── Avatar Map ───────────────────────────────────────────────────────────────
const AVATAR_MAP = {
    'Avatar1': require('../assets/profile/Avatar1.jpg'),
    'Avatar2': require('../assets/profile/Avatar2.jpg'),
    'Avatar3': require('../assets/profile/Avatar3.jpg'),
    'Avatar4': require('../assets/profile/Avatar4.jpg'),
    'Avatar5': require('../assets/profile/Avatar5.jpg'),
    'Avatar6': require('../assets/profile/Avatar6.jpg'),
};

// ─── Business Type Options ────────────────────────────────────────────────────
const BUSINESS_TYPES = [
    'Events Hall',
    'Garden Venue',
    'Hotel & Function Room',
    'Beach Resort',
    'Mountain Retreat',
    'Rooftop Venue',
    'Barn / Farm',
    'Other',
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VenueOwnerProfileScreen({ navigation }) {
    const [loading, setLoading]     = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSaving, setIsSaving]   = useState(false);

    // Personal fields
    const [firstName, setFirstName]       = useState('');
    const [middleName, setMiddleName]     = useState('');
    const [lastName, setLastName]         = useState('');
    const [username, setUsername]         = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(null);

    // Business fields
    const [businessName, setBusinessName]       = useState('');
    const [businessType, setBusinessType]       = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [businessPhone, setBusinessPhone]     = useState('');
    const [businessFacebook, setBusinessFacebook] = useState('');
    const [businessInstagram, setBusinessInstagram] = useState('');
    const [businessDescription, setBusinessDescription] = useState('');

    // Original data for cancel
    const [originalData, setOriginalData] = useState({});

    // Stable handlers
    const handleFirstNameChange    = useCallback(v => setFirstName(v), []);
    const handleMiddleNameChange   = useCallback(v => setMiddleName(v), []);
    const handleLastNameChange     = useCallback(v => setLastName(v), []);
    const handleUsernameChange     = useCallback(v => setUsername(v), []);
    const handleContactChange      = useCallback(v => setContactNumber(v.replace(/[^0-9]/g, '')), []);
    const handleBusinessNameChange = useCallback(v => setBusinessName(v), []);
    const handleBusinessAddrChange = useCallback(v => setBusinessAddress(v), []);
    const handleBusinessPhoneChange= useCallback(v => setBusinessPhone(v.replace(/[^0-9]/g, '')), []);
    const handleFacebookChange     = useCallback(v => setBusinessFacebook(v), []);
    const handleInstagramChange    = useCallback(v => setBusinessInstagram(v), []);
    const handleDescriptionChange  = useCallback(v => setBusinessDescription(v), []);

    // Animations
    const fadeAnim     = useRef(new Animated.Value(0)).current;
    const slideAnim    = useRef(new Animated.Value(30)).current;
    const avatarScale  = useRef(new Animated.Value(0.8)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const editModeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.spring(avatarScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(contentOpacity, { toValue: 1, duration: 400, delay: 100, useNativeDriver: true }),
            ]),
        ]).start();
        fetchUserDetails();
    }, []);

    useEffect(() => {
        Animated.spring(editModeAnim, {
            toValue: isEditing ? 1 : 0,
            friction: 8, tension: 40, useNativeDriver: true,
        }).start();
    }, [isEditing]);

    const fetchUserDetails = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) {
                    const d = snap.data();
                    const ud = {
                        firstName:     d.firstName || '',
                        middleName:    d.middleName || '',
                        lastName:      d.lastName || '',
                        username:      d.username || '',
                        contactNumber: d.contactNumber ? String(d.contactNumber) : '',
                        avatar:        d.avatar || null,
                        // Business
                        businessName:    d.businessName || '',
                        businessType:    d.businessType || '',
                        businessAddress: d.businessAddress || '',
                        businessPhone:   d.businessPhone ? String(d.businessPhone) : '',
                        businessFacebook:  d.businessFacebook || '',
                        businessInstagram: d.businessInstagram || '',
                        businessDescription: d.businessDescription || '',
                    };
                    setFirstName(ud.firstName);
                    setMiddleName(ud.middleName);
                    setLastName(ud.lastName);
                    setUsername(ud.username);
                    setContactNumber(ud.contactNumber);
                    setSelectedAvatar(ud.avatar);
                    setBusinessName(ud.businessName);
                    setBusinessType(ud.businessType);
                    setBusinessAddress(ud.businessAddress);
                    setBusinessPhone(ud.businessPhone);
                    setBusinessFacebook(ud.businessFacebook);
                    setBusinessInstagram(ud.businessInstagram);
                    setBusinessDescription(ud.businessDescription);
                    setOriginalData(ud);
                }
            }
        } catch {
            Alert.alert('Error', 'Could not load profile data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setFirstName(originalData.firstName);
        setMiddleName(originalData.middleName);
        setLastName(originalData.lastName);
        setUsername(originalData.username);
        setContactNumber(originalData.contactNumber || '');
        setSelectedAvatar(originalData.avatar);
        setBusinessName(originalData.businessName);
        setBusinessType(originalData.businessType);
        setBusinessAddress(originalData.businessAddress);
        setBusinessPhone(originalData.businessPhone);
        setBusinessFacebook(originalData.businessFacebook);
        setBusinessInstagram(originalData.businessInstagram);
        setBusinessDescription(originalData.businessDescription);
        setIsEditing(false);
    };

    const handleUpdateProfile = async () => {
        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
            Alert.alert('Incomplete', 'First name, last name, and username are required.');
            return;
        }
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username.trim())) {
            Alert.alert('Invalid Username', 'Username must be 3-20 characters: letters, numbers, and underscores only.');
            return;
        }
        if (contactNumber && (contactNumber.length < 7 || contactNumber.length > 15)) {
            Alert.alert('Invalid Contact', 'Contact number must be 7-15 digits.');
            return;
        }
        try {
            setIsSaving(true);
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updated = {
                firstName:     firstName.trim(),
                middleName:    middleName.trim(),
                lastName:      lastName.trim(),
                username:      username.trim().toLowerCase(),
                avatar:        selectedAvatar,
                contactNumber: contactNumber ? Number(contactNumber) : null,
                businessName:    businessName.trim(),
                businessType:    businessType,
                businessAddress: businessAddress.trim(),
                businessPhone:   businessPhone ? Number(businessPhone) : null,
                businessFacebook:  businessFacebook.trim(),
                businessInstagram: businessInstagram.trim(),
                businessDescription: businessDescription.trim(),
            };
            await updateDoc(userRef, updated);
            setOriginalData({ ...updated, contactNumber, businessPhone });
            setIsEditing(false);
            setShowSuccess(true);
        } catch {
            Alert.alert('Update Failed', 'Could not update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4F8' }} edges={['top']}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={TEAL} />
                    <CustomText style={{ color: '#94A3B8', marginTop: 12, fontSize: 14 }}>Loading profile…</CustomText>
                </View>
            </SafeAreaView>
        );
    }

    const fullName = `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4F8' }} edges={['top']}>
            <SuccessModal visible={showSuccess} onClose={() => setShowSuccess(false)} />

            {/* ── HEADER ─────────────────────────────────────────────────── */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 20, paddingVertical: 14,
                backgroundColor: '#F0F4F8', borderBottomWidth: 1, borderBottomColor: '#E8EEF4',
            }}>
                <TouchableOpacity
                    onPress={isEditing ? handleCancel : () => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{
                        width: 40, height: 40, borderRadius: 12,
                        backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Ionicons name={isEditing ? 'close' : 'arrow-back'} size={20} color="#FFF" />
                </TouchableOpacity>

                <CustomText style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                    {isEditing ? 'Edit Profile' : 'My Profile'}
                </CustomText>

                {isEditing ? (
                    <TouchableOpacity
                        onPress={handleUpdateProfile}
                        disabled={isSaving}
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
                            opacity: isSaving ? 0.6 : 1,
                        }}
                    >
                        {isSaving
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <Ionicons name="checkmark" size={20} color="#FFF" />
                        }
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* ── HERO CARD ─────────────────────────────────────── */}
                    <Animated.View style={[
                        heroCardStyle,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}>
                        {/* Decorative blobs */}
                        <View style={heroDeco1} />
                        <View style={heroDeco2} />

                        {/* Avatar */}
                        <View style={{ alignItems: 'center', paddingTop: 32 }}>
                            <Animated.View style={[
                                avatarRingStyle,
                                { transform: [{ scale: avatarScale }] },
                            ]}>
                                <View style={avatarInnerStyle}>
                                    {selectedAvatar && AVATAR_MAP[selectedAvatar] ? (
                                        <Image source={AVATAR_MAP[selectedAvatar]} style={avatarImgStyle} />
                                    ) : (
                                        <View style={avatarPlaceholderStyle}>
                                            <Ionicons name="person" size={46} color={TEAL} />
                                        </View>
                                    )}
                                </View>
                            </Animated.View>

                            {isEditing && (
                                <Animated.View style={[editAvatarBadge, { opacity: editModeAnim, transform: [{ scale: editModeAnim }] }]}>
                                    <Ionicons name="camera" size={16} color="#FFF" />
                                </Animated.View>
                            )}
                        </View>

                        {/* View-mode info */}
                        {!isEditing && (
                            <Animated.View style={{ alignItems: 'center', paddingBottom: 28, opacity: contentOpacity }}>
                                <CustomText style={{ fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: 14, marginBottom: 4 }}>
                                    {fullName || 'Venue Owner'}
                                </CustomText>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 6 }}>
                                    <Ionicons name="at" size={12} color="rgba(255,255,255,0.9)" />
                                    <CustomText style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
                                        {username || 'username'}
                                    </CustomText>
                                </View>
                                {businessName ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                        <Ionicons name="business-outline" size={12} color="rgba(255,255,255,0.7)" />
                                        <CustomText style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 5 }}>
                                            {businessName}
                                        </CustomText>
                                    </View>
                                ) : null}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Ionicons name="mail-outline" size={12} color="rgba(255,255,255,0.7)" />
                                    <CustomText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 5 }}>
                                        {auth.currentUser?.email}
                                    </CustomText>
                                </View>
                                {businessType ? (
                                    <View style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 }}>
                                        <CustomText style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🏛️ {businessType}</CustomText>
                                    </View>
                                ) : null}
                            </Animated.View>
                        )}

                        {isEditing && <View style={{ height: 24 }} />}
                    </Animated.View>

                    {/* ── CONTENT ──────────────────────────────────────── */}
                    <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: slideAnim }] }}>

                        {isEditing ? (
                            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>

                                {/* Avatar Picker */}
                                <FormBlock icon="image-outline" title="Profile Picture">
                                    <ScrollView
                                        horizontal showsHorizontalScrollIndicator={false}
                                        style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
                                        contentContainerStyle={{ flexDirection: 'row', gap: 12, paddingVertical: 4, paddingRight: 40 }}
                                    >
                                        <AvatarOption isSelected={selectedAvatar === null} onPress={() => setSelectedAvatar(null)} isNone />
                                        {Object.keys(AVATAR_MAP).map(key => (
                                            <AvatarOption
                                                key={key}
                                                source={AVATAR_MAP[key]}
                                                isSelected={selectedAvatar === key}
                                                onPress={() => setSelectedAvatar(key)}
                                            />
                                        ))}
                                    </ScrollView>
                                </FormBlock>

                                <Divider />

                                {/* Personal Info */}
                                <FormBlock icon="person-outline" title="Personal Information">
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <InputField label="First Name" value={firstName} onChange={handleFirstNameChange} icon="person-outline" required />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <InputField label="Middle Name" value={middleName} onChange={handleMiddleNameChange} icon="person-outline" />
                                        </View>
                                    </View>
                                    <InputField label="Last Name" value={lastName} onChange={handleLastNameChange} icon="person-outline" required />
                                    <InputField label="Username" value={username} onChange={handleUsernameChange} icon="at" autoCapitalize="none" required />
                                    <InputField label="Contact Number" value={contactNumber} onChange={handleContactChange} icon="call-outline" keyboardType="phone-pad" hint="Personal mobile number" />
                                </FormBlock>

                                <Divider />

                                {/* Business Info */}
                                <FormBlock icon="business-outline" title="Business Information">
                                    <InputField label="Business / Venue Name" value={businessName} onChange={handleBusinessNameChange} icon="business-outline" hint="Your brand or establishment name" />
                                    <InputField label="Business Contact Number" value={businessPhone} onChange={handleBusinessPhoneChange} icon="call-outline" keyboardType="phone-pad" />
                                    <InputField label="Address / Location" value={businessAddress} onChange={handleBusinessAddrChange} icon="location-outline" hint="City, Province" />

                                    {/* Business Type Picker */}
                                    <View style={{ marginBottom: 16 }}>
                                        <CustomText style={fieldLabelStyle}>BUSINESS TYPE</CustomText>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 8, paddingVertical: 2 }}>
                                            {BUSINESS_TYPES.map(type => (
                                                <TouchableOpacity
                                                    key={type}
                                                    onPress={() => setBusinessType(type)}
                                                    style={[
                                                        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
                                                        businessType === type
                                                            ? { backgroundColor: TEAL, borderColor: TEAL }
                                                            : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                                                    ]}
                                                >
                                                    <CustomText style={{ fontSize: 12, fontWeight: '700', color: businessType === type ? '#fff' : '#64748B' }}>
                                                        {type}
                                                    </CustomText>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </FormBlock>

                                <Divider />

                                {/* Online Presence */}
                                <FormBlock icon="globe-outline" title="Online Presence">
                                    <InputField label="Facebook Page URL" value={businessFacebook} onChange={handleFacebookChange} icon="logo-facebook" autoCapitalize="none" hint="facebook.com/your-page" />
                                    <InputField label="Instagram Handle" value={businessInstagram} onChange={handleInstagramChange} icon="logo-instagram" autoCapitalize="none" hint="@yourhandle" />
                                    <View style={{ marginBottom: 4 }}>
                                        <CustomText style={fieldLabelStyle}>ABOUT YOUR VENUES</CustomText>
                                        <View style={[descInputContainer]}>
                                            <TextInput
                                                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, color: '#1E293B', fontSize: 14, textAlignVertical: 'top', minHeight: 80 }}
                                                value={businessDescription}
                                                onChangeText={handleDescriptionChange}
                                                placeholder="Briefly describe your venues or services…"
                                                placeholderTextColor="#C4CDD8"
                                                multiline
                                                numberOfLines={3}
                                            />
                                        </View>
                                    </View>
                                </FormBlock>

                                {/* Action buttons */}
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                    <TouchableOpacity
                                        onPress={handleCancel}
                                        style={{ flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' }}
                                    >
                                        <CustomText style={{ color: '#64748B', fontWeight: '700', fontSize: 15 }}>Cancel</CustomText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleUpdateProfile}
                                        disabled={isSaving}
                                        activeOpacity={0.8}
                                        style={[{
                                            flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                                            backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
                                        }, isSaving && { opacity: 0.6 }]}
                                    >
                                        {isSaving
                                            ? <ActivityIndicator size="small" color="#FFF" />
                                            : <>
                                                <Ionicons name="checkmark" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                                <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Save Changes</CustomText>
                                              </>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>

                                {/* Account Settings */}
                                <SectionHeader label="Account Settings" />
                                <OptionsCard>
                                    <ProfileOption
                                        icon="create-outline"
                                        label="Edit Profile"
                                        subtitle="Update personal & business information"
                                        onPress={() => setIsEditing(true)}
                                        showChevron
                                        accent
                                    />
                                    <OptionDivider />
                                    <ProfileOption
                                        icon="mail-outline"
                                        label="Email Address"
                                        subtitle={auth.currentUser?.email}
                                        isLocked
                                    />
                                    <OptionDivider />
                                    <ProfileOption
                                        icon="call-outline"
                                        label="Personal Contact"
                                        subtitle={originalData.contactNumber ? String(originalData.contactNumber) : 'Not set'}
                                        isLocked
                                    />
                                </OptionsCard>

                                {/* Business Details */}
                                {(businessName || businessType || businessAddress) ? (
                                    <>
                                        <SectionHeader label="Business Details" />
                                        <OptionsCard>
                                            {businessName ? (
                                                <>
                                                    <ProfileOption icon="business-outline" label="Business Name" subtitle={businessName} isLocked />
                                                    <OptionDivider />
                                                </>
                                            ) : null}
                                            {businessType ? (
                                                <>
                                                    <ProfileOption icon="storefront-outline" label="Business Type" subtitle={businessType} isLocked />
                                                    <OptionDivider />
                                                </>
                                            ) : null}
                                            {businessAddress ? (
                                                <>
                                                    <ProfileOption icon="location-outline" label="Address" subtitle={businessAddress} isLocked />
                                                    <OptionDivider />
                                                </>
                                            ) : null}
                                            {originalData.businessPhone ? (
                                                <ProfileOption icon="call-outline" label="Business Phone" subtitle={String(originalData.businessPhone)} isLocked />
                                            ) : null}
                                        </OptionsCard>
                                    </>
                                ) : null}

                                {/* Online Presence */}
                                {(businessFacebook || businessInstagram) ? (
                                    <>
                                        <SectionHeader label="Online Presence" />
                                        <OptionsCard>
                                            {businessFacebook ? (
                                                <>
                                                    <ProfileOption icon="logo-facebook" label="Facebook" subtitle={businessFacebook} isLocked />
                                                    {businessInstagram ? <OptionDivider /> : null}
                                                </>
                                            ) : null}
                                            {businessInstagram ? (
                                                <ProfileOption icon="logo-instagram" label="Instagram" subtitle={businessInstagram} isLocked />
                                            ) : null}
                                        </OptionsCard>
                                    </>
                                ) : null}

                                {/* Navigation */}
                                <SectionHeader label="Navigation" />
                                <OptionsCard>
                                    <ProfileOption
                                        icon="business-outline"
                                        label="Back to Dashboard"
                                        subtitle="Return to your venue management"
                                        onPress={() => navigation.navigate('VenueOwner')}
                                        showChevron
                                    />
                                </OptionsCard>

                                <View style={{ height: 20 }} />
                            </View>
                        )}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const AvatarOption = ({ source, isSelected, onPress, isNone }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start()}
        >
            <Animated.View style={[
                { borderRadius: 32, borderWidth: 2.5, borderColor: isSelected ? TEAL : 'transparent' },
                isSelected && { shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 5 },
                { transform: [{ scale: scaleAnim }] },
            ]}>
                {isNone ? (
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed' }}>
                        <Ionicons name="close" size={24} color="#94A3B8" />
                    </View>
                ) : (
                    <Image source={source} style={{ width: 60, height: 60, borderRadius: 30 }} />
                )}
                {isSelected && (
                    <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FFF', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 3 }}>
                        <Ionicons name="checkmark-circle" size={24} color={TEAL} />
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const InputField = ({ label, value, onChange, icon, autoCapitalize = 'words', required, hint, keyboardType = 'default' }) => {
    const [isFocused, setIsFocused] = useState(false);
    return (
        <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <CustomText style={[fieldLabelStyle, isFocused && { color: TEAL }]}>{label}</CustomText>
                {required && <CustomText style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}> *</CustomText>}
            </View>
            <View style={[inputContainerStyle, isFocused && { borderColor: TEAL, borderWidth: 2 }]}>
                {isFocused && <View style={{ position: 'absolute', top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: 14, borderWidth: 2, borderColor: TEAL, backgroundColor: 'transparent' }} pointerEvents="none" />}
                <Ionicons name={icon} size={18} color={isFocused ? TEAL : '#94A3B8'} style={{ marginRight: 8 }} />
                <TextInput
                    style={{ flex: 1, paddingVertical: 13, color: '#1E293B', fontSize: 15, fontWeight: '500' }}
                    value={value}
                    onChangeText={onChange}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    placeholderTextColor="#C4CDD8"
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType={keyboardType}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
            {hint && !isFocused && (
                <CustomText style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginLeft: 2 }}>{hint}</CustomText>
            )}
        </View>
    );
};

const FormBlock = ({ icon, title, children }) => (
    <View style={{ paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: TEAL_LIGHT, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                <Ionicons name={icon} size={16} color={TEAL} />
            </View>
            <CustomText style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{title}</CustomText>
        </View>
        {children}
    </View>
);

const Divider = () => <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: -20 }} />;
const OptionDivider = () => <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 }} />;

const SectionHeader = ({ label }) => (
    <CustomText style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10 }}>
        {label}
    </CustomText>
);

const OptionsCard = ({ children }) => (
    <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}>
        {children}
    </View>
);

const ProfileOption = ({ icon, label, subtitle, onPress, showChevron, accent, isLocked }) => (
    <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
    >
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: accent ? TEAL_LIGHT : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name={icon} size={18} color={accent ? TEAL : '#64748B'} />
        </View>
        <View style={{ flex: 1 }}>
            <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 1 }}>{label}</CustomText>
            {subtitle ? (
                <CustomText style={{ fontSize: 12, color: '#94A3B8' }} numberOfLines={1}>{subtitle}</CustomText>
            ) : null}
        </View>
        {showChevron && <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />}
        {isLocked && <Ionicons name="lock-closed-outline" size={14} color="#CBD5E1" />}
    </TouchableOpacity>
);

const SuccessModal = ({ visible, onClose }) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="none">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <Animated.View style={[
                    { width: '100%', maxWidth: 320, backgroundColor: '#FFF', borderRadius: 28, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 },
                    { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
                ]}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center', marginBottom: 22, shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 }}>
                        <Ionicons name="checkmark" size={40} color="#FFF" />
                    </View>
                    <CustomText style={{ fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>Profile Updated!</CustomText>
                    <CustomText style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 26, lineHeight: 20 }}>
                        Your profile and business information have been saved successfully.
                    </CustomText>
                    <TouchableOpacity
                        onPress={onClose}
                        style={{ backgroundColor: TEAL, paddingHorizontal: 40, paddingVertical: 13, borderRadius: 14, shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                    >
                        <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Done</CustomText>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const heroCardStyle = {
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: TEAL,
    shadowColor: TEAL_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
};

const heroDeco1 = {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -40, right: -30,
};

const heroDeco2 = {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 20, left: -20,
};

const avatarRingStyle = {
    width: 112, height: 112, borderRadius: 56, padding: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
};

const avatarInnerStyle = {
    flex: 1, borderRadius: 54, overflow: 'hidden',
    backgroundColor: TEAL_LIGHT,
};

const avatarImgStyle = {
    width: '100%', height: '100%',
};

const avatarPlaceholderStyle = {
    flex: 1, justifyContent: 'center', alignItems: 'center',
};

const editAvatarBadge = {
    position: 'absolute', bottom: 4, right: 4,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: TEAL_DARK,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
};

const fieldLabelStyle = {
    fontSize: 12, fontWeight: '600', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.5,
};

const inputContainerStyle = {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E8EEF4',
    paddingHorizontal: 12, position: 'relative', overflow: 'hidden',
};

const descInputContainer = {
    backgroundColor: '#F8FAFC', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#E8EEF4', overflow: 'hidden',
};