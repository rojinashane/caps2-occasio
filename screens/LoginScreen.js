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

        // Logo rotation
        Animated.timing(logoRotate, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.exp),
            useNativeDriver: true,
        }).start();

        // Continuous floating animation
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

    const rotation = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

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
                    // --- ADMIN REDIRECTION LOGIC ---
                    if (user.email.toLowerCase() === 'rojinashaneecohabana@gmail.com') {
                        navigation.replace('AdminDashboard');
                    } else {
                        navigation.replace('Dashboard');
                    }
                } else {
                    Alert.alert(
                        "Email Not Verified",
                        "Please verify your email before logging in. Check your inbox for the verification link.",
                        [
                            { text: "OK", onPress: () => signOut(auth) }
                        ]
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
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
                        <Image 
                            source={require('../assets/logo/logoo.png')} 
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    <Animated.View 
                        style={[
                            styles.formContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideUpAnim }]
                            }
                        ]}
                    >
                        <CustomText style={styles.title}>Welcome Back</CustomText>
                        <CustomText style={styles.subtitle}>Log in to manage your events effortlessly</CustomText>

                        <View style={styles.inputWrapper}>
                            <CustomText style={styles.label}>Email Address</CustomText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="mail-outline" size={20} color="#6B7280" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="yourname@email.com"
                                    placeholderTextColor="#9CA3AF"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputWrapper}>
                            <CustomText style={styles.label}>Password</CustomText>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Ionicons 
                                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                        size={20} 
                                        color="#6B7280" 
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                            <CustomText style={styles.forgotText}>Forgot Password?</CustomText>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.loginButton} 
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <CustomText style={styles.loginButtonText}>Login</CustomText>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <CustomText style={styles.footerText}>Don't have an account? </CustomText>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                                <CustomText style={styles.signupText}>Sign Up</CustomText>
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
        backgroundColor: '#F3F4F6',
    },
    scrollContent: {
        flexGrow: 1,
    },
    keyboardView: {
        flex: 1,
        paddingHorizontal: 25,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 150,
        height: 150,
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 30,
    },
    inputWrapper: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        marginLeft: 4,
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 25,
    },
    footerText: {
        color: '#6B7280',
        fontSize: 15,
    },
    signupText: {
        color: '#00686F',
        fontWeight: 'bold',
        fontSize: 15,
    },
});