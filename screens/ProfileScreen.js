import React, { useState, useEffect, useRef } from 'react';
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
    Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import { auth, db } from '../firebase';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

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

    // Original values for cancel functionality
    const [originalData, setOriginalData] = useState({});

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
                    };
                    setFirstName(userData.firstName);
                    setMiddleName(userData.middleName);
                    setLastName(userData.lastName);
                    setUsername(userData.username);
                    setSelectedAvatar(userData.avatar);
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

        try {
            setIsSaving(true);
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updatedData = {
                firstName: firstName.trim(),
                middleName: middleName.trim(),
                lastName: lastName.trim(),
                username: username.trim().toLowerCase(),
                avatar: selectedAvatar
            };
            await updateDoc(userRef, updatedData);
            setOriginalData(updatedData);
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
                    <ActivityIndicator size="large" color="#00686F" />
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

            {/* Header with gradient effect */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.headerButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <CustomText style={styles.headerTitle}>
                    {isEditing ? 'Edit Profile' : 'My Profile'}
                </CustomText>
                {isEditing ? (
                    <TouchableOpacity
                        onPress={handleUpdateProfile}
                        style={styles.headerButton}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <CustomText style={styles.headerSaveText}>Save</CustomText>
                        )}
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} />
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
                    {/* Profile Header Card */}
                    <Animated.View style={[
                        styles.profileCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}>
                        {/* Avatar with edit button overlay */}
                        <View style={styles.avatarContainer}>
                            <Animated.View style={[
                                styles.avatarLarge,
                                { transform: [{ scale: avatarScale }] }
                            ]}>
                                {selectedAvatar && AVATAR_MAP[selectedAvatar] ? (
                                    <Image source={AVATAR_MAP[selectedAvatar]} style={styles.avatarImg} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Ionicons name="person" size={50} color="#00686F" />
                                    </View>
                                )}
                            </Animated.View>

                            {isEditing && (
                                <Animated.View
                                    style={[
                                        styles.editAvatarBadge,
                                        { opacity: editModeAnim, transform: [{ scale: editModeAnim }] }
                                    ]}
                                >
                                    <Ionicons name="camera" size={18} color="#FFF" />
                                </Animated.View>
                            )}
                        </View>

                        {!isEditing && (
                            <Animated.View style={[styles.profileInfo, { opacity: contentOpacity }]}>
                                <CustomText style={styles.nameText}>
                                    {`${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`}
                                </CustomText>
                                <CustomText style={styles.handleText}>@{username}</CustomText>
                                <View style={styles.emailBadge}>
                                    <Ionicons name="mail" size={14} color="#00686F" style={{ marginRight: 6 }} />
                                    <CustomText style={styles.emailText}>{auth.currentUser?.email}</CustomText>
                                </View>
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* Content Section */}
                    <Animated.View style={[
                        styles.contentSection,
                        { opacity: contentOpacity, transform: [{ translateY: slideAnim }] }
                    ]}>
                        {isEditing ? (
                            <View style={styles.editForm}>
                                {/* Avatar Selection */}
                                <View style={styles.formSection}>
                                    <CustomText style={styles.sectionTitle}>Profile Picture</CustomText>
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

                                {/* Form Fields */}
                                <View style={styles.formSection}>
                                    <CustomText style={styles.sectionTitle}>Personal Information</CustomText>
                                    <InputField
                                        label="First Name"
                                        value={firstName}
                                        onChange={setFirstName}
                                        icon="person-outline"
                                        required
                                    />
                                    <InputField
                                        label="Middle Name"
                                        value={middleName}
                                        onChange={setMiddleName}
                                        icon="person-outline"
                                    />
                                    <InputField
                                        label="Last Name"
                                        value={lastName}
                                        onChange={setLastName}
                                        icon="person-outline"
                                        required
                                    />
                                    <InputField
                                        label="Username"
                                        value={username}
                                        onChange={setUsername}
                                        icon="at"
                                        autoCapitalize="none"
                                        required
                                    />
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.editActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.cancelBtn]}
                                        onPress={handleCancel}
                                        disabled={isSaving}
                                    >
                                        <Ionicons name="close-circle-outline" size={20} color="#64748B" style={{ marginRight: 6 }} />
                                        <CustomText style={styles.cancelBtnText}>Cancel</CustomText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                                        onPress={handleUpdateProfile}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
                                                <CustomText style={styles.saveBtnText}>Save Changes</CustomText>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <View style={styles.settingsSection}>
                                    <CustomText style={styles.sectionLabel}>Account Settings</CustomText>
                                    <ProfileOption
                                        icon="create-outline"
                                        label="Edit Profile"
                                        subtitle="Update your personal information"
                                        onPress={() => setIsEditing(true)}
                                    />
                                    <ProfileOption
                                        icon="shield-checkmark-outline"
                                        label="Email Address"
                                        subtitle={auth.currentUser?.email}
                                        isLocked
                                    />
                                </View>

                                <View style={styles.settingsSection}>
                                    <CustomText style={styles.sectionLabel}>Quick Actions</CustomText>
                                    <ProfileOption
                                        icon="home-outline"
                                        label="Back to Dashboard"
                                        onPress={() => navigation.navigate('Dashboard')}
                                        showChevron
                                    />
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

const InputField = ({ label, value, onChange, icon, autoCapitalize = "words", required }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.inputWrapper}>
            <View style={styles.inputLabelRow}>
                <CustomText style={styles.inputLabel}>
                    {label}
                    {required && <CustomText style={styles.requiredStar}> *</CustomText>}
                </CustomText>
            </View>
            <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
                <Ionicons name={icon} size={20} color={isFocused ? '#00686F' : '#94A3B8'} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    placeholderTextColor="#CBD5E1"
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
        </View>
    );
};

const ProfileOption = ({ icon, label, subtitle, onPress, isLocked, showChevron }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        if (!isLocked) {
            Animated.spring(scaleAnim, {
                toValue: 0.97,
                useNativeDriver: true,
            }).start();
        }
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
            disabled={isLocked}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
        >
            <Animated.View style={[styles.optionRow, { transform: [{ scale: scaleAnim }] }]}>
                <View style={[styles.optionIconBox, isLocked && styles.optionIconBoxLocked]}>
                    <Ionicons name={icon} size={22} color={isLocked ? '#94A3B8' : '#00686F'} />
                </View>
                <View style={styles.optionContent}>
                    <CustomText style={[styles.optionLabel, isLocked && styles.optionLabelLocked]}>
                        {label}
                    </CustomText>
                    {subtitle && (
                        <CustomText style={styles.optionSubtitle}>{subtitle}</CustomText>
                    )}
                </View>
                {!isLocked && showChevron && (
                    <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                )}
                {isLocked && (
                    <Ionicons name="lock-closed" size={18} color="#CBD5E1" />
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
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748B',
    },
    header: {
        backgroundColor: '#00686F',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    headerButton: {
        padding: 4,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    headerSaveText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    scrollContent: {
        paddingBottom: 30,
    },
    profileCard: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
        backgroundColor: '#00686F',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    avatarLarge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    avatarImg: {
        width: '100%',
        height: '100%'
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F0F9FA',
    },
    editAvatarBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#00686F',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    profileInfo: {
        alignItems: 'center',
    },
    nameText: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'center',
    },
    handleText: {
        color: '#D1FAE5',
        fontSize: 16,
        marginBottom: 12,
        fontWeight: '500',
    },
    emailBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginTop: 4,
    },
    emailText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '500',
    },
    contentSection: {
        padding: 20,
    },
    settingsSection: {
        marginBottom: 28
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    optionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#E0F2F3',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14
    },
    optionIconBoxLocked: {
        backgroundColor: '#F1F5F9',
    },
    optionContent: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 2,
    },
    optionLabelLocked: {
        color: '#64748B',
    },
    optionSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },
    editForm: {
        backgroundColor: '#FFF',
        padding: 20,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    formSection: {
        marginBottom: 28,
    },
    avatarScrollView: {
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    avatarPicker: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 4,
    paddingRight: 40,
},
    avatarOption: {
        position: 'relative',
        borderRadius: 34,
        borderWidth: 3,
        borderColor: 'transparent',
    },
    selectedAvatarOption: {
        borderColor: '#00686F',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    avatarThumb: {
        width: 64,
        height: 64,
        borderRadius: 32
    },
    noneThumb: {
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed'
    },
    selectedIndicator: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#FFF',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    inputWrapper: {
        marginBottom: 20
    },
    inputLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginLeft: 4,
    },
    requiredStar: {
        color: '#EF4444',
        fontSize: 13,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
    },
    inputContainerFocused: {
        borderColor: '#00686F',
        backgroundColor: '#FFF',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '500',
    },
    editActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    saveBtn: {
        backgroundColor: '#00686F'
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    cancelBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    saveBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 16,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFF',
        borderRadius: 28,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    successIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 12,
        textAlign: 'center',
    },
    successSub: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    successCloseBtn: {
        backgroundColor: '#00686F',
        paddingHorizontal: 48,
        paddingVertical: 14,
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
        fontSize: 16,
    }
});
