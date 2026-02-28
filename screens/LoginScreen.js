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
    Dimensions,
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

const { width, height } = Dimensions.get('window');

// Decorative background orb component
const Orb = ({ style }) => (
    <View style={[styles.orb, style]} />
);

export default function LoginScreen({ navigation }) {
    // --- ANIMATION VALUES --- (unchanged)
    const fadeAnim = useRef(new Animated.Value(0)).current;
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
            })
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
                })
            ])
        ).start();
    }, []);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [focusedField, setFocusedField] = useState(null);

    const rotation = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // --- ALL LOGIC UNCHANGED ---
    const handleLogin = () => {
        if (!email || !password) {
            Alert.alert("Error", "Please fill in all fields");
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
                        "Email Not Verified",
                        "Please verify your email before logging in. Check your inbox for the verification link.",
                        [{ text: "OK", onPress: () => signOut(auth) }]
                    );
                }
            })
            .catch((error) => {
                let errorMessage = "An error occurred. Please try again.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMessage = "Invalid email or password.";
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = "The email address is not valid.";
                }
                Alert.alert("Login Failed", errorMessage);
            })
            .finally(() => setLoading(false));
    };

    const handleForgotPassword = () => {
        if (!email) {
            Alert.alert("Error", "Please enter your email address first.");
            return;
        }
        sendPasswordResetEmail(auth, email)
            .then(() => {
                Alert.alert("Success", "Password reset email sent. Please check your inbox.");
            })
            .catch((error) => {
                Alert.alert("Error", error.message);
            });
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Decorative background */}
            <Orb style={styles.orbTopRight} />
            <Orb style={styles.orbBottomLeft} />
            <Orb style={styles.orbCenter} />

            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={styles.scrollContent}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
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
                                    { translateY: floatAnim }
                                ]
                            }
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

                    {/* Form Card */}
                    <Animated.View 
                        style={[
                            styles.formContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideUpAnim }]
                            }
                        ]}
                    >
                        {/* Card top accent bar */}
                        <View style={styles.cardAccentBar} />

                        <View style={styles.cardInner}>
                            <CustomText style={styles.title}>Welcome Back</CustomText>
                            <CustomText style={styles.subtitle}>
                                Log in to manage your events effortlessly
                            </CustomText>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* Email */}
                            <View style={styles.inputWrapper}>
                                <CustomText style={styles.label}>Email Address</CustomText>
                                <View style={[
                                    styles.inputContainer, 
                                    focusedField === 'email' && styles.inputFocused
                                ]}>
                                    <View style={styles.inputIconBox}>
                                        <Ionicons name="mail-outline" size={16} color={focusedField === 'email' ? '#00686F' : '#94A3B8'} />
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="yourname@email.com"
                                        placeholderTextColor="#CBD5E1"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        onFocus={() => setFocusedField('email')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                            </View>

                            {/* Password */}
                            <View style={styles.inputWrapper}>
                                <CustomText style={styles.label}>Password</CustomText>
                                <View style={[
                                    styles.inputContainer, 
                                    focusedField === 'password' && styles.inputFocused
                                ]}>
                                    <View style={styles.inputIconBox}>
                                        <Ionicons name="lock-closed-outline" size={16} color={focusedField === 'password' ? '#00686F' : '#94A3B8'} />
                                    </View>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="••••••••"
                                        placeholderTextColor="#CBD5E1"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                    <TouchableOpacity 
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeBtn}
                                    >
                                        <Ionicons 
                                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                            size={18} 
                                            color="#94A3B8" 
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Forgot */}
                            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                                <CustomText style={styles.forgotText}>Forgot Password?</CustomText>
                            </TouchableOpacity>

                            {/* Login Button */}
                            <TouchableOpacity 
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.88}
                            >
                                <View style={styles.loginButtonInner}>
                                    {loading ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <CustomText style={styles.loginButtonText}>Sign In</CustomText>
                                            <View style={styles.loginArrow}>
                                                <Ionicons name="arrow-forward" size={16} color="#00686F" />
                                            </View>
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <View style={styles.footerLine} />
                                <CustomText style={styles.footerText}>New to Occasio?</CustomText>
                                <View style={styles.footerLine} />
                            </View>
                            <TouchableOpacity 
                                style={styles.signupButton}
                                onPress={() => navigation.navigate('Signup')}
                                activeOpacity={0.8}
                            >
                                <CustomText style={styles.signupButtonText}>Create an Account</CustomText>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4F4',
    },

    // Background orbs
    orb: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.18,
    },
    orbTopRight: {
        width: 280,
        height: 280,
        backgroundColor: '#00686F',
        top: -80,
        right: -80,
    },
    orbBottomLeft: {
        width: 200,
        height: 200,
        backgroundColor: '#00868E',
        bottom: 60,
        left: -60,
    },
    orbCenter: {
        width: 120,
        height: 120,
        backgroundColor: '#004D52',
        top: height * 0.35,
        right: 20,
        opacity: 0.08,
    },

    scrollContent: {
        flexGrow: 1,
    },
    keyboardView: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
        paddingTop: 20,
        paddingBottom: 32,
    },

    // Logo
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoRing: {
        width: 120,
        height: 120,
        borderRadius: 36,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(0,104,111,0.12)',
    },
    logo: {
        width: 80,
        height: 80,
    },

    // Card
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.1,
        shadowRadius: 32,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,104,111,0.08)',
    },
    cardAccentBar: {
        height: 4,
        backgroundColor: '#00686F',
    },
    cardInner: {
        padding: 28,
    },

    title: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 22,
    },

    // Inputs
    inputWrapper: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 52,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    inputFocused: {
        borderColor: '#00686F',
        backgroundColor: '#FAFFFE',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2,
    },
    inputIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    textInput: { 
        flex: 1, 
        fontSize: 15, 
        color: '#0F172A',
        fontWeight: '500',
    },
    eyeBtn: {
        padding: 4,
    },

    // Forgot
    forgotBtn: { 
        alignSelf: 'flex-end', 
        marginBottom: 22,
        marginTop: 4,
    },
    forgotText: { 
        color: '#00686F', 
        fontWeight: '700', 
        fontSize: 13,
        letterSpacing: 0.2,
    },

    // Login button
    loginButton: {
        backgroundColor: '#00686F',
        borderRadius: 14,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    loginButtonText: { 
        color: '#FFF', 
        fontSize: 16, 
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    loginArrow: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Footer / signup
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 14,
        gap: 10,
    },
    footerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    footerText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    signupButton: {
        height: 50,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#00686F',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,104,111,0.04)',
    },
    signupButtonText: {
        color: '#00686F',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});