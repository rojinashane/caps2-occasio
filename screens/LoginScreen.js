import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Animated,
    Easing,
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import {
    signInWithEmailAndPassword,
    reload,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';

export default function LoginScreen({ navigation }) {
    // --- ANIMATION VALUES --- (unchanged)
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideUpAnim = useRef(new Animated.Value(30)).current;
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoRotate = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 7,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.timing(slideUpAnim, {
                toValue: 0,
                duration: 800,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
        ]).start();

        Animated.timing(logoRotate, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -10,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [loading, setLoading]           = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const rotation = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // --- ALL LOGIC UNCHANGED ---
    const handleLogin = () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        setLoading(true);
        signInWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                await reload(user);
                if (user.emailVerified) {
                    if (user.email.toLowerCase() === 'rojinashaneecohabana@gmail.com') {
                        navigation.replace('AdminDashboard');
                    } else {
                        navigation.replace('Dashboard');
                    }
                } else {
                    Alert.alert(
                        'Email Not Verified',
                        'Please verify your email before logging in. Check your inbox for the verification link.',
                        [{ text: 'OK', onPress: () => signOut(auth) }]
                    );
                }
            })
            .catch((error) => {
                let errorMessage = 'An error occurred. Please try again.';
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMessage = 'Invalid email or password.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'The email address is not valid.';
                }
                Alert.alert('Login Failed', errorMessage);
            })
            .finally(() => setLoading(false));
    };

    const handleForgotPassword = () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address first.');
            return;
        }
        sendPasswordResetEmail(auth, email)
            .then(() => {
                Alert.alert('Success', 'Password reset email sent. Please check your inbox.');
            })
            .catch((error) => {
                Alert.alert('Error', error.message);
            });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Purely decorative — no interaction */}
            <View style={styles.blobTR} pointerEvents="none" />
            <View style={styles.blobBL} pointerEvents="none" />

            {/* BUG FIX: KAV must wrap ScrollView, not be inside it */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo */}
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    { scale: logoScale },
                                    { rotate: rotation },
                                    { translateY: floatAnim },
                                ],
                            },
                        ]}
                    >
                        <View style={styles.logoRing}>
                            <Image
                                source={require('../assets/logoo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>
                    </Animated.View>

                    {/* Card */}
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideUpAnim }],
                            },
                        ]}
                    >
                        <View style={styles.cardStripe} />

                        <View style={styles.cardBody}>
                            <CustomText style={styles.title}>Welcome Back</CustomText>
                            <CustomText style={styles.subtitle}>
                                Log in to manage your events effortlessly
                            </CustomText>

                            <View style={styles.divider} />

                            {/* Email */}
                            <View style={styles.fieldGroup}>
                                <CustomText style={styles.label}>Email Address</CustomText>
                                <View style={styles.inputRow}>
                                    <View style={styles.iconWrap}>
                                        <Ionicons name="mail-outline" size={17} color="#00686F" />
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="yourname@email.com"
                                        placeholderTextColor="#B0BAC9"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            {/* Password */}
                            <View style={styles.fieldGroup}>
                                <CustomText style={styles.label}>Password</CustomText>
                                <View style={styles.inputRow}>
                                    <View style={styles.iconWrap}>
                                        <Ionicons name="lock-closed-outline" size={17} color="#00686F" />
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="••••••••"
                                        placeholderTextColor="#B0BAC9"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                            size={20}
                                            color="#9CA3AF"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Forgot */}
                            <TouchableOpacity
                                style={styles.forgotBtn}
                                onPress={handleForgotPassword}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <CustomText style={styles.forgotText}>Forgot Password?</CustomText>
                            </TouchableOpacity>

                            {/* Login button */}
                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <CustomText style={styles.loginButtonText}>Sign In</CustomText>
                                )}
                            </TouchableOpacity>

                            {/* Divider row */}
                            <View style={styles.orRow}>
                                <View style={styles.orLine} />
                                <CustomText style={styles.orLabel}>New to Occasio?</CustomText>
                                <View style={styles.orLine} />
                            </View>

                            {/* Sign-up button */}
                            <TouchableOpacity
                                style={styles.signupButton}
                                onPress={() => navigation.navigate('Signup')}
                                activeOpacity={0.8}
                            >
                                <CustomText style={styles.signupButtonText}>Create an Account</CustomText>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const TEAL      = '#00686F';
const TEAL_SOFT = 'rgba(0,104,111,0.09)';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EEF4F4',
    },

    /* Background blobs */
    blobTR: {
        position: 'absolute',
        width: 320,
        height: 320,
        borderRadius: 160,
        backgroundColor: TEAL,
        opacity: 0.07,
        top: -110,
        right: -90,
    },
    blobBL: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: TEAL,
        opacity: 0.05,
        bottom: 50,
        left: -65,
    },

    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 36,
    },

    /* Logo */
    logoContainer: {
        alignItems: 'center',
        marginBottom: 26,
    },
    logoRing: {
        width: 112,
        height: 112,
        borderRadius: 34,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: TEAL,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1.5,
        borderColor: TEAL_SOFT,
    },
    logo: {
        width: 74,
        height: 74,
    },

    /* Card */
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000D1A',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.08,
        shadowRadius: 28,
        elevation: 8,
        borderWidth: 1,
        borderColor: TEAL_SOFT,
    },
    cardStripe: {
        height: 4,
        backgroundColor: TEAL,
    },
    cardBody: {
        padding: 28,
    },

    /* Headings */
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0D1B2A',
        textAlign: 'center',
        letterSpacing: -0.4,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginVertical: 22,
    },

    /* Fields */
    fieldGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4B5563',
        marginBottom: 8,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 52,
        borderWidth: 1.5,
        borderColor: '#E2ECEC',
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: TEAL_SOFT,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: '#0D1B2A',
        fontWeight: '500',
    },

    /* Forgot */
    forgotBtn: {
        alignSelf: 'flex-end',
        marginTop: 2,
        marginBottom: 22,
    },
    forgotText: {
        color: TEAL,
        fontWeight: '700',
        fontSize: 13,
    },

    /* Primary CTA */
    loginButton: {
        backgroundColor: TEAL,
        borderRadius: 14,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: TEAL,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
        elevation: 7,
    },
    loginButtonDisabled: {
        opacity: 0.65,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },

    /* "Or" divider row */
    orRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 14,
        gap: 10,
    },
    orLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    orLabel: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },

    /* Secondary CTA */
    signupButton: {
        height: 50,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: TEAL,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: TEAL_SOFT,
    },
    signupButtonText: {
        color: TEAL,
        fontSize: 15,
        fontWeight: '800',
    },
});