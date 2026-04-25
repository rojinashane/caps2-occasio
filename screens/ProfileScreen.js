import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
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
    Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import { auth, db } from '../firebase';
import { updateDoc, doc, getDoc } from 'firebase/firestore';


const { width } = Dimensions.get('window');

const AVATAR_MAP = {
    'Avatar1': require('../assets/profile/Avatar1.jpg'),
    'Avatar2': require('../assets/profile/Avatar2.jpg'),
    'Avatar3': require('../assets/profile/Avatar3.jpg'),
    'Avatar4': require('../assets/profile/Avatar4.jpg'),
    'Avatar5': require('../assets/profile/Avatar5.jpg'),
    'Avatar6': require('../assets/profile/Avatar6.jpg'),
};

export default function ProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [contactNumber, setContactNumber] = useState('');

    // Original values for cancel functionality
    const [originalData, setOriginalData] = useState({});

    // Stable onChange handlers — prevents InputField from remounting on every keystroke
    const handleFirstNameChange = useCallback((v) => setFirstName(v), []);
    const handleMiddleNameChange = useCallback((v) => setMiddleName(v), []);
    const handleLastNameChange = useCallback((v) => setLastName(v), []);
    const handleUsernameChange = useCallback((v) => setUsername(v), []);
    const handleContactNumberChange = useCallback((v) => {
        // Only allow digits
        const digitsOnly = v.replace(/[^0-9]/g, '');
        setContactNumber(digitsOnly);
    }, []);

    // Entrance animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const avatarScale = useRef(new Animated.Value(0.8)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;

    // Edit mode animation
    const editModeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Staggered entrance animation for better visual hierarchy
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.spring(avatarScale, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 400,
                    delay: 100,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

        fetchUserDetails();
    }, []);

    useEffect(() => {
        // Smooth transition when entering/exiting edit mode
        Animated.spring(editModeAnim, {
            toValue: isEditing ? 1 : 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, [isEditing]);

    const fetchUserDetails = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const userData = {
                        firstName: data.firstName || '',
                        middleName: data.middleName || '',
                        lastName: data.lastName || '',
                        username: data.username || '',
                        avatar: data.avatar || null,
                        contactNumber: data.contactNumber ? String(data.contactNumber) : '',
                    };
                    setFirstName(userData.firstName);
                    setMiddleName(userData.middleName);
                    setLastName(userData.lastName);
                    setUsername(userData.username);
                    setSelectedAvatar(userData.avatar);
                    setContactNumber(userData.contactNumber);
                    setOriginalData(userData);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'Could not load profile data.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        // Restore original values
        setFirstName(originalData.firstName);
        setMiddleName(originalData.middleName);
        setLastName(originalData.lastName);
        setUsername(originalData.username);
        setSelectedAvatar(originalData.avatar);
        setContactNumber(originalData.contactNumber || '');
        setIsEditing(false);
    };

    const handleUpdateProfile = async () => {
        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
            Alert.alert('Incomplete Information', 'First name, last name, and username are required.');
            return;
        }

        // Username validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username.trim())) {
            Alert.alert('Invalid Username', 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
            return;
        }

        // Contact number validation (optional but must be digits-only if provided)
        if (contactNumber && (contactNumber.length < 7 || contactNumber.length > 15)) {
            Alert.alert('Invalid Contact Number', 'Contact number must be between 7 and 15 digits.');
            return;
        }

        try {
            setIsSaving(true);
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updatedData = {
                firstName: firstName.trim(),
                middleName: middleName.trim(),
                lastName: lastName.trim(),
                username: username.trim().toLowerCase(),
                avatar: selectedAvatar,
                contactNumber: contactNumber ? Number(contactNumber) : null,
            };
            await updateDoc(userRef, updatedData);
            // Keep contactNumber as string in local state for display
            setOriginalData({ ...updatedData, contactNumber: contactNumber });
            setIsEditing(false);
            setShowSuccess(true);
        } catch (error) {
            Alert.alert('Update Failed', 'Could not update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingSpinnerWrap}>
                        <ActivityIndicator size="large" color="#00686F" />
                    </View>
                    <CustomText style={styles.loadingText}>Loading profile...</CustomText>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <SuccessModal
                visible={showSuccess}
                onClose={() => setShowSuccess(false)}
            />

            {/* ── HEADER ─────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <View style={styles.headerBtnInner}>
                        <Ionicons name="arrow-back" size={20} color="#FFF" />
                    </View>
                </TouchableOpacity>

                <CustomText style={styles.headerTitle}>
                    {isEditing ? 'Edit Profile' : 'My Profile'}
                </CustomText>

                {isEditing ? (
                    <TouchableOpacity
                        onPress={handleUpdateProfile}
                        style={styles.headerBtn}
                        disabled={isSaving}
                    >
                        <View style={[styles.headerBtnInner, styles.headerSaveBtnInner]}>
                            // Line ~246 — inside the header Save button
                                {isSaving
                                    ? <ActivityIndicator size="small" color="#FFF" />   // ✅ was "save"
                                    : <CustomText style={styles.headerSaveText}>Save</CustomText>
                                }
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 36 }} />
                )}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* ── HERO CARD ───────────────────────────── */}
                    <Animated.View style={[
                        styles.heroCard,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}>
                        {/* Decorative circles */}
                        <View style={styles.heroDeco1} />
                        <View style={styles.heroDeco2} />

                        {/* Avatar */}
                        <View style={styles.avatarContainer}>
                            <Animated.View style={[
                                styles.avatarRing,
                                { transform: [{ scale: avatarScale }] }
                            ]}>
                                <View style={styles.avatarInner}>
                                    {selectedAvatar && AVATAR_MAP[selectedAvatar] ? (
                                        <Image source={AVATAR_MAP[selectedAvatar]} style={styles.avatarImg} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Ionicons name="person" size={46} color="#00686F" />
                                        </View>
                                    )}
                                </View>
                            </Animated.View>

                            {isEditing && (
                                <Animated.View style={[
                                    styles.editAvatarBadge,
                                    { opacity: editModeAnim, transform: [{ scale: editModeAnim }] }
                                ]}>
                                    <Ionicons name="camera" size={16} color="#FFF" />
                                </Animated.View>
                            )}
                        </View>

                        {/* Profile info (view mode only) */}
                        {!isEditing && (
                            <Animated.View style={[styles.heroInfo, { opacity: contentOpacity }]}>
                                <CustomText style={styles.heroName}>
                                    {`${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`}
                                </CustomText>
                                <View style={styles.heroBadgeRow}>
                                    <View style={styles.usernameBadge}>
                                        <Ionicons name="at" size={12} color="#00686F" />
                                        <CustomText style={styles.usernameText}>{username}</CustomText>
                                    </View>
                                </View>
                                <View style={styles.emailRow}>
                                    <Ionicons name="mail-outline" size={13} color="rgba(255,255,255,0.7)" style={{ marginRight: 5 }} />
                                    <CustomText style={styles.emailText}>{auth.currentUser?.email}</CustomText>
                                </View>
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* ── CONTENT ─────────────────────────────── */}
                    <Animated.View style={[
                        styles.contentSection,
                        { opacity: contentOpacity, transform: [{ translateY: slideAnim }] }
                    ]}>
                        {isEditing ? (
                            <View style={styles.editForm}>

                                {/* Avatar picker */}
                                <View style={styles.formBlock}>
                                    <View style={styles.formBlockHeader}>
                                        <View style={styles.formBlockIconWrap}>
                                            <Ionicons name="image-outline" size={16} color="#00686F" />
                                        </View>
                                        <CustomText style={styles.formBlockTitle}>Profile Picture</CustomText>
                                    </View>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.avatarScrollView}
                                        contentContainerStyle={styles.avatarPicker}
                                    >
                                        <AvatarOption
                                            isSelected={selectedAvatar === null}
                                            onPress={() => setSelectedAvatar(null)}
                                            isNone
                                        />
                                        {Object.keys(AVATAR_MAP).map((key) => (
                                            <AvatarOption
                                                key={key}
                                                source={AVATAR_MAP[key]}
                                                isSelected={selectedAvatar === key}
                                                onPress={() => setSelectedAvatar(key)}
                                            />
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Divider */}
                                <View style={styles.formDivider} />

                                {/* Personal info fields */}
                                <View style={styles.formBlock}>
                                    <View style={styles.formBlockHeader}>
                                        <View style={styles.formBlockIconWrap}>
                                            <Ionicons name="person-outline" size={16} color="#00686F" />
                                        </View>
                                        <CustomText style={styles.formBlockTitle}>Personal Information</CustomText>
                                    </View>

                                    <View style={styles.fieldRow}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <InputField
                                                label="First Name"
                                                value={firstName}
                                                onChange={handleFirstNameChange}
                                                icon="person-outline"
                                                required
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <InputField
                                                label="Middle Name"
                                                value={middleName}
                                                onChange={handleMiddleNameChange}
                                                icon="person-outline"
                                            />
                                        </View>
                                    </View>

                                    <InputField
                                        label="Last Name"
                                        value={lastName}
                                        onChange={handleLastNameChange}
                                        icon="person-outline"
                                        required
                                    />
                                    <InputField
                                        label="Username"
                                        value={username}
                                        onChange={handleUsernameChange}
                                        icon="at"
                                        autoCapitalize="none"
                                        required
                                        hint="Letters, numbers and underscores only"
                                    />
                                </View>

                                {/* Divider */}
                                <View style={styles.formDivider} />

                                {/* Contact info fields */}
                                <View style={styles.formBlock}>
                                    <View style={styles.formBlockHeader}>
                                        <View style={styles.formBlockIconWrap}>
                                            <Ionicons name="call-outline" size={16} color="#00686F" />
                                        </View>
                                        <CustomText style={styles.formBlockTitle}>Contact Information</CustomText>
                                    </View>

                                    <InputField
                                        label="Contact Number"
                                        value={contactNumber}
                                        onChange={handleContactNumberChange}
                                        icon="call-outline"
                                        autoCapitalize="none"
                                        keyboardType="phone-pad"
                                        hint="Digits only (7–15 digits)"
                                    />
                                </View>

                                {/* Action buttons */}
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.cancelBtn]}
                                        onPress={handleCancel}
                                        disabled={isSaving}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="close" size={18} color="#64748B" style={{ marginRight: 6 }} />
                                        <CustomText style={styles.cancelBtnText}>Discard</CustomText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                                        onPress={handleUpdateProfile}
                                        disabled={isSaving}
                                        activeOpacity={0.8}
                                    >
                                        {isSaving ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark" size={18} color="#FFF" style={{ marginRight: 6 }} />
                                                <CustomText style={styles.saveBtnText}>Save Changes</CustomText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                {/* Account Settings section */}
                                <View style={styles.settingsSection}>
                                    <CustomText style={styles.sectionLabel}>Account Settings</CustomText>
                                    <View style={styles.optionsCard}>
                                        <ProfileOption
                                            icon="create-outline"
                                            label="Edit Profile"
                                            subtitle="Update your personal information"
                                            onPress={() => setIsEditing(true)}
                                            showChevron
                                            accent
                                        />
                                        <View style={styles.optionDivider} />
                                        <ProfileOption
                                            icon="mail-outline"
                                            label="Email Address"
                                            subtitle={auth.currentUser?.email}
                                            isLocked
                                        />
                                        <View style={styles.optionDivider} />
                                        <ProfileOption
                                            icon="call-outline"
                                            label="Contact Number"
                                            subtitle={originalData.contactNumber ? String(originalData.contactNumber) : 'Not set'}
                                            isLocked
                                        />
                                    </View>
                                </View>

                                {/* Quick Actions section */}
                                <View style={styles.settingsSection}>
                                    <CustomText style={styles.sectionLabel}>Navigation</CustomText>
                                    <View style={styles.optionsCard}>
                                        <ProfileOption
                                            icon="home-outline"
                                            label="Back to Dashboard"
                                            subtitle="Return to your events overview"
                                            onPress={() => navigation.navigate('Dashboard')}
                                            showChevron
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// --- Enhanced Components ---

const AvatarOption = ({ source, isSelected, onPress, isNone }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            useNativeDriver: true,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View
                style={[
                    styles.avatarOption,
                    isSelected && styles.selectedAvatarOption,
                    { transform: [{ scale: scaleAnim }] }
                ]}
            >
                {isNone ? (
                    <View style={[styles.avatarThumb, styles.noneThumb]}>
                        <Ionicons name="close" size={24} color="#94A3B8" />
                    </View>
                ) : (
                    <Image source={source} style={styles.avatarThumb} />
                )}
                {isSelected && (
                    <View style={styles.selectedIndicator}>
                        <Ionicons name="checkmark-circle" size={24} color="#00686F" />
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const InputField = ({ label, value, onChange, icon, autoCapitalize = "words", required, hint, keyboardType = "default" }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.inputWrapper}>
            <View style={styles.inputLabelRow}>
                <CustomText style={[styles.inputLabel, isFocused && styles.inputLabelFocused]}>
                    {label}
                </CustomText>
                {required && <CustomText style={styles.requiredStar}> *</CustomText>}
            </View>
            <View style={styles.inputContainer}>
                {isFocused && <View style={styles.inputFocusRing} pointerEvents="none" />}
                <Ionicons
                    name={icon}
                    size={18}
                    color={isFocused ? '#00686F' : '#94A3B8'}
                    style={styles.inputIcon}
                />
                <TextInput
                    style={styles.input}
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
                <CustomText style={styles.inputHint}>{hint}</CustomText>
            )}
        </View>
    );
};

const ProfileOption = ({ icon, label, subtitle, onPress, isLocked, showChevron, accent }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!isLocked) {
            Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
        }
    };
    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={isLocked}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[styles.optionRow, { transform: [{ scale: scaleAnim }] }]}>
                <View style={[
                    styles.optionIconBox,
                    isLocked && styles.optionIconBoxLocked,
                    accent && styles.optionIconBoxAccent,
                ]}>
                    <Ionicons
                        name={icon}
                        size={20}
                        color={isLocked ? '#94A3B8' : accent ? '#FFF' : '#00686F'}
                    />
                </View>
                <View style={styles.optionContent}>
                    <CustomText style={[styles.optionLabel, isLocked && styles.optionLabelLocked]}>
                        {label}
                    </CustomText>
                    {subtitle && (
                        <CustomText style={styles.optionSubtitle} numberOfLines={1}>{subtitle}</CustomText>
                    )}
                </View>
                {!isLocked && showChevron && (
                    <View style={styles.chevronWrap}>
                        <Ionicons name="chevron-forward" size={16} color="#00686F" />
                    </View>
                )}
                {isLocked && (
                    <View style={styles.lockWrap}>
                        <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                    </View>
                )}
            </Animated.View>
        </Pressable>
    );
};

const SuccessModal = ({ visible, onClose }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0);
            fadeAnim.setValue(0);
        }
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="none">
            <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                <Animated.View style={[
                    styles.modalContent,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <Animated.View style={styles.successIconCircle}>
                        <Ionicons name="checkmark" size={40} color="#FFF" />
                    </Animated.View>
                    <CustomText style={styles.successTitle}>Profile Updated!</CustomText>
                    <CustomText style={styles.successSub}>
                        Your changes have been saved successfully.
                    </CustomText>
                    <TouchableOpacity style={styles.successCloseBtn} onPress={onClose}>
                        <CustomText style={styles.successCloseBtnText}>Continue</CustomText>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    // ── Base ────────────────────────────────────────
    container: {
        flex: 1,
        backgroundColor: '#F0F4F8',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F4F8',
    },
    loadingSpinnerWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#E0F2F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    loadingText: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },

    // ── Header ──────────────────────────────────────
    header: {
        backgroundColor: '#00686F',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8,
    },
    headerBtn: {
        width: 36,
        alignItems: 'center',
    },
    headerBtnInner: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerSaveBtnInner: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 14,
        width: '60',
        borderRadius: 12,
        marginRight: 20,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    headerSaveText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },

    // ── Scroll ──────────────────────────────────────
    scrollContent: {
        paddingBottom: 40,
    },

    // ── Hero Card ───────────────────────────────────
    heroCard: {
        backgroundColor: '#00686F',
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 36,
        paddingHorizontal: 20,
        overflow: 'hidden',
        // Curved bottom
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        shadowColor: '#004E54',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 10,
    },
    // Decorative background circles
    heroDeco1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.06)',
        top: -60,
        right: -40,
    },
    heroDeco2: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.05)',
        bottom: -20,
        left: -30,
    },

    // Avatar
    avatarContainer: {
        position: 'relative',
        marginBottom: 18,
    },
    avatarRing: {
        width: 114,
        height: 114,
        borderRadius: 57,
        padding: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    avatarInner: {
        flex: 1,
        borderRadius: 54,
        overflow: 'hidden',
        backgroundColor: '#FFF',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E0F2F3',
    },
    editAvatarBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#004E54',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2.5,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },

    // Hero text
    heroInfo: {
        alignItems: 'center',
    },
    heroName: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    usernameBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    usernameText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    },
    emailRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emailText: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 13,
        fontWeight: '400',
    },

    // ── Content Section ─────────────────────────────
    contentSection: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },

    // ── Settings (view mode) ────────────────────────
    settingsSection: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    optionsCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
    },
    optionDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 72,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    optionIconBox: {
        width: 42,
        height: 42,
        borderRadius: 13,
        backgroundColor: '#E8F5F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    optionIconBoxLocked: {
        backgroundColor: '#F1F5F9',
    },
    optionIconBoxAccent: {
        backgroundColor: '#00686F',
    },
    optionContent: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 1,
    },
    optionLabelLocked: {
        color: '#64748B',
        fontWeight: '500',
    },
    optionSubtitle: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '400',
    },
    chevronWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        backgroundColor: '#E8F5F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Edit Form ───────────────────────────────────
    editForm: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    formBlock: {
        padding: 20,
    },
    formDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 20,
    },
    formBlockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    formBlockIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: '#E8F5F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    formBlockTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
    },
    fieldRow: {
        flexDirection: 'row',
    },
    avatarScrollView: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    avatarPicker: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 4,
        paddingRight: 40,
    },
    avatarOption: {
        position: 'relative',
        borderRadius: 32,
        borderWidth: 2.5,
        borderColor: 'transparent',
    },
    selectedAvatarOption: {
        borderColor: '#00686F',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 5,
    },
    avatarThumb: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    noneThumb: {
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    selectedIndicator: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#FFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 3,
    },

    // ── Inputs ──────────────────────────────────────
    inputWrapper: {
        marginBottom: 16,
    },
    inputLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputLabelFocused: {
        color: '#00686F',
    },
    requiredStar: {
        color: '#EF4444',
        fontSize: 13,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E8EEF4',
        paddingHorizontal: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    inputFocusRing: {
        position: 'absolute',
        top: -1.5,
        left: -1.5,
        right: -1.5,
        bottom: -1.5,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#00686F',
        backgroundColor: 'transparent',
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 13,
        color: '#1E293B',
        fontSize: 15,
        fontWeight: '500',
    },
    inputHint: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
        marginLeft: 2,
    },

    // ── Edit Action Buttons ─────────────────────────
    editActions: {
        flexDirection: 'row',
        gap: 10,
        padding: 20,
        paddingTop: 4,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    saveBtn: {
        backgroundColor: '#00686F',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    cancelBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    saveBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: 15,
    },

    // ── Success Modal ───────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#FFF',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#00686F',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 22,
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    successSub: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 26,
        lineHeight: 20,
    },
    successCloseBtn: {
        backgroundColor: '#00686F',
        paddingHorizontal: 40,
        paddingVertical: 13,
        borderRadius: 14,
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    successCloseBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
});