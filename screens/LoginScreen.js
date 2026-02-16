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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { 
    signInWithEmailAndPassword, 
    reload, 
    signOut, 
    sendPasswordResetEmail // Added for forgot password functionality
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
        Animated.sequence([
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 7,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(logoRotate, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.out(Easing.cubic),
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
            ])
        ]).start();

        // Continuous floating idle animation
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

    const spin = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // --- HANDLERS ---

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
            Alert.alert('Email Required', 'Please enter your email address in the field above to reset your password.');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            Alert.alert(
                'Reset Link Sent',
                'A password reset link has been sent to your email. Please check your inbox and spam folder.'
            );
        } catch (err) {
            let errorMessage = 'Could not send reset email. Please try again.';
            if (err.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address.';
            }
            Alert.alert('Reset Error', errorMessage);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#EFF0EE' }} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingVertical: 24, justifyContent: 'center' }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ANIMATED LOGO SECTION */}
                    <Animated.View 
                        style={{ 
                            alignItems: 'center', 
                            marginBottom: 20,
                            transform: [
                                { scale: logoScale },
                                { rotate: spin },
                                { translateY: floatAnim }
                            ]
                        }}
                    >
                        <View style={styles.logoCircle}>
                            <Ionicons name="calendar" size={40} color="#EFF0EE" />
                        </View>
                    </Animated.View>

                    <Animated.View
                        style={{
                            opacity: fadeAnim,
                            transform: [{ translateY: slideUpAnim }],
                        }}
                    >
                        <View style={{ marginBottom: 28, alignItems: 'center' }}>
                            <CustomText style={{ fontSize: 28, fontWeight: 'bold', color: '#00686F', marginBottom: 4 }}>
                                Welcome Back
                            </CustomText>
                            <CustomText style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                                Sign in to continue your planning
                            </CustomText>
                        </View>

                        {/* Email Input */}
                        <View style={{ marginBottom: 14 }}>
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
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={{ marginBottom: 10 }}>
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
                                    onSubmitEditing={handleLogin}
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

                        {/* Forgot Password Link */}
                        <TouchableOpacity 
                            onPress={handleForgotPassword} 
                            style={{ alignSelf: 'flex-end', marginBottom: 24, paddingVertical: 5 }}
                        >
                            <CustomText style={styles.forgotPasswordText}>Forgot Password?</CustomText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleLogin}
                            disabled={loading}
                            style={styles.loginButton}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#EFF0EE" size="small" />
                            ) : (
                                <CustomText style={styles.loginButtonText}>Sign In</CustomText>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <CustomText style={styles.dividerText}>OR</CustomText>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('Signup')}
                            style={{ paddingVertical: 10 }}
                        >
                            <CustomText style={{ textAlign: 'center', fontSize: 14, color: '#6B7280' }}>
                                Don't have an account?{' '}
                                <CustomText style={{ color: '#00686F', fontWeight: 'bold' }}>Sign Up</CustomText>
                            </CustomText>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#00686F',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    textInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#111827',
    },
    forgotPasswordText: {
        color: '#00686F',
        fontSize: 13,
        fontWeight: '700',
    },
    loginButton: {
        backgroundColor: '#00686F',
        borderRadius: 12,
        paddingVertical: 14,
        marginBottom: 16,
        shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    loginButtonText: {
        color: '#EFF0EE',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 18
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#D1D5DB'
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#9CA3AF',
        fontSize: 13
    }
});