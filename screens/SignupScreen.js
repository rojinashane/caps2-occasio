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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Move InputField OUTSIDE the main component
const InputField = ({ label, icon, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <CustomText style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
      {label}
    </CustomText>
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
      }}
    >
      <Ionicons name={icon} size={20} color="#00686F" />
      <TextInput
        style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#111827' }}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </View>
  </View>
);

export default function SignupScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState(1);
  const [firstname, setFirstname] = useState('');
  const [middlename, setMiddlename] = useState('');
  const [lastname, setLastname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true
    }).start();
  }, []);

  const animateStep = (direction) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction === 'forward' ? -20 : 20,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (!firstname.trim() || !lastname.trim() || !username.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    animateStep('forward');
    setStep(2);
  };

  const handleSignup = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password should be at least 6 characters.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        firstName: firstname.trim(),
        middleName: middlename.trim(),
        lastName: lastname.trim(),
        username: username.trim(),
        email: cleanEmail,
        createdAt: serverTimestamp(),
        uid: user.uid,
      });

      await sendEmailVerification(user);
      await signOut(auth);

      Alert.alert(
        'Verify Email',
        'Account created! Please check your inbox and verify your email before logging in.',
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } catch (err) {
      console.error('Signup failed:', err);
      let errorMessage = 'An error occurred. Please try again.';

      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format.';
      }

      Alert.alert('Signup Error', errorMessage);
    } finally {
      setLoading(false);
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
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            }}
          >
            {/* Header with Step Indicator */}
            <View style={{ marginBottom: 24, alignItems: 'center' }}>
              <CustomText style={{ fontSize: 28, fontWeight: 'bold', color: '#00686F', marginBottom: 4 }}>
                Create Account
              </CustomText>
              <CustomText style={{ fontSize: 14, color: '#6B7280', marginBottom: 12 }}>
                Step {step} of 2
              </CustomText>
              {/* Progress Bar */}
              <View style={{ width: '100%', height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, overflow: 'hidden' }}>
                <View
                  style={{
                    width: step === 1 ? '50%' : '100%',
                    height: '100%',
                    backgroundColor: '#00686F',
                  }}
                />
              </View>
            </View>

            {/* Step 1: Personal Info */}
            {step === 1 && (
              <>
                <InputField
                  label="First Name *"
                  icon="person-outline"
                  placeholder="John"
                  value={firstname}
                  onChangeText={setFirstname}
                  returnKeyType="next"
                />

                <InputField
                  label="Middle Name"
                  icon="person-outline"
                  placeholder="Optional"
                  value={middlename}
                  onChangeText={setMiddlename}
                  returnKeyType="next"
                />

                <InputField
                  label="Last Name *"
                  icon="person-outline"
                  placeholder="Doe"
                  value={lastname}
                  onChangeText={setLastname}
                  returnKeyType="next"
                />

                <InputField
                  label="Username *"
                  icon="at-outline"
                  placeholder="johndoe"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />

                <TouchableOpacity
                  onPress={handleNext}
                  style={{
                    backgroundColor: '#00686F',
                    borderRadius: 12,
                    paddingVertical: 14,
                    marginTop: 8,
                    shadowColor: '#00686F',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    elevation: 4,
                  }}
                  activeOpacity={0.85}
                >
                  <CustomText style={{ color: '#EFF0EE', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
                    Next
                  </CustomText>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Account Info */}
            {step === 2 && (
              <>
                <InputField
                  label="Email *"
                  icon="mail-outline"
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />

                <View style={{ marginBottom: 20 }}>
                  <CustomText style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                    Password *
                  </CustomText>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      borderWidth: 1.5,
                      borderColor: '#D1D5DB',
                    }}
                  >
                    <Ionicons name="lock-closed-outline" size={20} color="#00686F" />
                    <TextInput
                      style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#111827' }}
                      placeholder="6+ characters"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSignup}
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

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      animateStep('back');
                      setStep(1);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      paddingVertical: 14,
                      borderWidth: 1.5,
                      borderColor: '#00686F',
                    }}
                    activeOpacity={0.85}
                  >
                    <CustomText style={{ color: '#00686F', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
                      Back
                    </CustomText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSignup}
                    disabled={loading}
                    style={{
                      flex: 1,
                      backgroundColor: '#00686F',
                      borderRadius: 12,
                      paddingVertical: 14,
                      shadowColor: '#00686F',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.25,
                      shadowRadius: 6,
                      elevation: 4,
                    }}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#EFF0EE" size="small" />
                    ) : (
                      <CustomText style={{ color: '#EFF0EE', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
                        Sign Up
                      </CustomText>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Login Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={{ paddingVertical: 16, marginTop: 8 }}
            >
              <CustomText style={{ textAlign: 'center', fontSize: 14, color: '#6B7280' }}>
                Already have an account?{' '}
                <CustomText style={{ color: '#00686F', fontWeight: 'bold' }}>
                  Sign In
                </CustomText>
              </CustomText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
