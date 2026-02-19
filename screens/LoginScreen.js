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
    // --- ANIMATION VALUES ---
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideUpAnim = useRef(new Animated.Value(30)).current;
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoRotate = useRef(new Animated.Value(0)).current; 
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Main entrance sequence
        Animated.parallel([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 7,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(logoRotate, {
                toValue: 1,
                duration: 1200, 
                easing: Easing.out(Easing.exp), // FIXED: Changed .expo to .exp
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true
            }),
            Animated.timing(slideUpAnim, {
                toValue: 0,
                duration: 700,
                easing: Easing.out(Easing.back(1)),
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous floating idle animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -10,
                    duration: 2500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const spin = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.');
            return;
        }
        if (loading) return;
        setLoading(true);

        try {
            const cleanEmail = email.trim().toLowerCase();
            const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
            const user = userCredential.user;
            await reload(user);

            if (!user.emailVerified) {
                await signOut(auth);
                Alert.alert('Email Not Verified', 'Please verify your email before logging in.');
                setLoading(false);
                return;
            }
            navigation.replace('Dashboard');
        } catch (err) {
            let errorMessage = 'An error occurred. Please try again.';
            if (err.code === 'auth/invalid-credential') errorMessage = 'Invalid email or password.';
            Alert.alert('Login Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email.trim()) {
            Alert.alert('Email Required', 'Please enter your email to reset password.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            Alert.alert('Reset Link Sent', 'Check your inbox for the reset link.');
        } catch (err) {
            Alert.alert('Error', 'Could not send reset email.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* LOGO SECTION */}
                    <Animated.View 
                        style={[
                            styles.logoContainer,
                            { 
                                transform: [
                                    { scale: logoScale },
                                    { rotate: spin },
                                    { translateY: floatAnim }
                                ]
                            }
                        ]}
                    >
                        <Image 
                            source={require('../assets/logo/logoo.png')} 
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    <Animated.View
                        style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideUpAnim }],
                        }}
                    >
                        <View style={styles.headerTextContainer}>
                            <CustomText style={styles.welcomeTitle}>Welcome Back</CustomText>
                            <CustomText style={styles.subtitle}>Sign in to continue your planning</CustomText>
                        </View>

                        {/* Email Input */}
                        <View style={styles.inputWrapper}>
                            <CustomText style={styles.inputLabel}>Email</CustomText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="mail-outline" size={20} color="#00686F" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="your@email.com"
                                    placeholderTextColor="#9CA3AF"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputWrapper}>
                            <CustomText style={styles.inputLabel}>Password</CustomText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#00686F" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter password"
                                    placeholderTextColor="#9CA3AF"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#6B7280"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
                            <CustomText style={styles.forgotText}>Forgot Password?</CustomText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.loginButton}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#EFF0EE" size="small" />
                            ) : (
                                <CustomText style={styles.loginButtonText}>Sign In</CustomText>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.line} />
                            <CustomText style={styles.orText}>OR</CustomText>
                            <View style={styles.line} />
                        </View>

                        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                            <CustomText style={styles.signupPrompt}>
                                Don't have an account? <CustomText style={styles.signupLink}>Sign Up</CustomText>
                            </CustomText>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#EFF0EE' },
    scrollContent: { 
        flexGrow: 1, 
        paddingHorizontal: 30, 
        paddingVertical: 40, 
        justifyContent: 'center' 
    },
    logoContainer: { 
        alignItems: 'center', 
        marginBottom: 20 
    },
    logoImage: { 
        width: 90, 
        height: 90 
    },
    headerTextContainer: { 
        marginBottom: 30, 
        alignItems: 'center' 
    },
    welcomeTitle: { 
        fontSize: 34, 
        fontWeight: '900', 
        color: '#004D52', 
        letterSpacing: -1 
    },
    subtitle: { 
        fontSize: 15, 
        color: '#6B7280', 
        marginTop: 4 
    },
    inputWrapper: { marginBottom: 15 },
    inputLabel: { 
        fontSize: 13, 
        fontWeight: '700', 
        color: '#374151', 
        marginBottom: 6 
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 55,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    textInput: { 
        flex: 1, 
        marginLeft: 10, 
        fontSize: 16, 
        color: '#111827' 
    },
    forgotBtn: { 
        alignSelf: 'flex-end', 
        marginBottom: 25 
    },
    forgotText: { 
        color: '#00686F', 
        fontWeight: '700', 
        fontSize: 14 
    },
    loginButton: {
        backgroundColor: '#00686F',
        borderRadius: 15,
        height: 55,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    loginButtonText: { 
        color: '#FFF', 
        fontSize: 18, 
        fontWeight: 'bold' 
    },
    dividerContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginVertical: 25 
    },
    line: { flex: 1, height: 1, backgroundColor: '#D1D5DB' },
    orText: { marginHorizontal: 10, color: '#9CA3AF', fontSize: 13 },
    signupPrompt: { 
        textAlign: 'center', 
        color: '#6B7280', 
        fontSize: 15 
    },
    signupLink: { 
        color: '#00686F', 
        fontWeight: 'bold' 
    },
});