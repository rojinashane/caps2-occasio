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
  StyleSheet,
  Dimensions,
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

const { height } = Dimensions.get('window');

// ── InputField — OUTSIDE main component (unchanged logic) ──────────────────
const InputField = ({ label, icon, isFocused, onFocus, onBlur, ...props }) => (
  <View style={inputStyles.wrapper}>
    <CustomText style={inputStyles.label}>{label}</CustomText>
    <View style={[inputStyles.container, isFocused && inputStyles.containerFocused]}>
      <View style={inputStyles.iconBox}>
        <Ionicons name={icon} size={16} color={isFocused ? '#00686F' : '#94A3B8'} />
      </View>
      <TextInput
        style={inputStyles.input}
        placeholderTextColor="#CBD5E1"
        onFocus={onFocus}
        onBlur={onBlur}
        {...props}
      />
    </View>
  </View>
);

const inputStyles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 7,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  containerFocused: {
    borderColor: '#00686F',
    backgroundColor: '#FAFFFE',
    shadowColor: '#00686F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
});

// ── Step indicator dot ──────────────────────────────────────────────────────
const StepDot = ({ active, completed }) => (
  <View style={[
    styles.stepDot,
    active && styles.stepDotActive,
    completed && styles.stepDotCompleted,
  ]}>
    {completed && <Ionicons name="checkmark" size={10} color="#fff" />}
  </View>
);

export default function SignupScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // --- ALL STATE UNCHANGED ---
  const [step, setStep] = useState(1);
  const [firstname, setFirstname] = useState('');
  const [middlename, setMiddlename] = useState('');
  const [lastname, setLastname] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Focus state for improved input styling
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true
    }).start();
  }, []);

  // --- ALL ANIMATION LOGIC UNCHANGED ---
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

  // --- ALL HANDLERS UNCHANGED ---
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Decorative orbs */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            }}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <CustomText style={styles.title}>Create Account</CustomText>
              <CustomText style={styles.subtitle}>
                Join Occasio and plan unforgettable events
              </CustomText>

              {/* Step indicator */}
              <View style={styles.stepRow}>
                <StepDot active={step === 1} completed={step > 1} />
                <View style={[styles.stepLine, step > 1 && styles.stepLineActive]} />
                <StepDot active={step === 2} completed={false} />
              </View>

              <View style={styles.stepLabels}>
                <CustomText style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>
                  Personal Info
                </CustomText>
                <CustomText style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>
                  Account Setup
                </CustomText>
              </View>
            </View>

            {/* ── Card ── */}
            <View style={styles.card}>
              <View style={styles.cardAccentBar} />
              <View style={styles.cardInner}>

                {/* ── Step 1 ── */}
                {step === 1 && (
                  <>
                    <InputField
                      label="First Name *"
                      icon="person-outline"
                      placeholder="John"
                      value={firstname}
                      onChangeText={setFirstname}
                      returnKeyType="next"
                      isFocused={focused === 'firstname'}
                      onFocus={() => setFocused('firstname')}
                      onBlur={() => setFocused(null)}
                    />
                    <InputField
                      label="Middle Name"
                      icon="person-outline"
                      placeholder="Optional"
                      value={middlename}
                      onChangeText={setMiddlename}
                      returnKeyType="next"
                      isFocused={focused === 'middlename'}
                      onFocus={() => setFocused('middlename')}
                      onBlur={() => setFocused(null)}
                    />
                    <InputField
                      label="Last Name *"
                      icon="person-outline"
                      placeholder="Doe"
                      value={lastname}
                      onChangeText={setLastname}
                      returnKeyType="next"
                      isFocused={focused === 'lastname'}
                      onFocus={() => setFocused('lastname')}
                      onBlur={() => setFocused(null)}
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
                      isFocused={focused === 'username'}
                      onFocus={() => setFocused('username')}
                      onBlur={() => setFocused(null)}
                    />

                    <TouchableOpacity
                      onPress={handleNext}
                      style={styles.primaryBtn}
                      activeOpacity={0.88}
                    >
                      <View style={styles.primaryBtnInner}>
                        <CustomText style={styles.primaryBtnText}>Continue</CustomText>
                        <View style={styles.btnArrow}>
                          <Ionicons name="arrow-forward" size={16} color="#00686F" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </>
                )}

                {/* ── Step 2 ── */}
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
                      isFocused={focused === 'email'}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                    />

                    {/* Password field (custom to keep toggle button) */}
                    <View style={{ marginBottom: 20 }}>
                      <CustomText style={inputStyles.label}>Password *</CustomText>
                      <View style={[
                        inputStyles.container,
                        focused === 'password' && inputStyles.containerFocused
                      ]}>
                        <View style={inputStyles.iconBox}>
                          <Ionicons 
                            name="lock-closed-outline" 
                            size={16} 
                            color={focused === 'password' ? '#00686F' : '#94A3B8'} 
                          />
                        </View>
                        <TextInput
                          style={inputStyles.input}
                          placeholder="6+ characters"
                          placeholderTextColor="#CBD5E1"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          returnKeyType="done"
                          onSubmitEditing={handleSignup}
                          onFocus={() => setFocused('password')}
                          onBlur={() => setFocused(null)}
                        />
                        <TouchableOpacity 
                          onPress={() => setShowPassword(!showPassword)}
                          style={{ padding: 4 }}
                        >
                          <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={18}
                            color="#94A3B8"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.stepBtnRow}>
                      <TouchableOpacity
                        onPress={() => {
                          animateStep('back');
                          setStep(1);
                        }}
                        style={styles.backBtn}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="arrow-back" size={16} color="#00686F" />
                        <CustomText style={styles.backBtnText}>Back</CustomText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSignup}
                        disabled={loading}
                        style={[styles.primaryBtn, styles.flex1, loading && { opacity: 0.7 }]}
                        activeOpacity={0.88}
                      >
                        <View style={styles.primaryBtnInner}>
                          {loading ? (
                            <ActivityIndicator color="#EFF0EE" size="small" />
                          ) : (
                            <>
                              <CustomText style={styles.primaryBtnText}>Create Account</CustomText>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* ── Login link ── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
            >
              <CustomText style={styles.loginLinkText}>
                Already have an account?{'  '}
                <CustomText style={styles.loginLinkHighlight}>Sign In</CustomText>
              </CustomText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F4',
  },

  // Orbs
  orbTopRight: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: '#00686F',
    opacity: 0.15,
    top: -70,
    right: -70,
  },
  orbBottomLeft: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: '#00868E',
    opacity: 0.12,
    bottom: 80,
    left: -50,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 22,
    textAlign: 'center',
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
    marginBottom: 8,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#00686F',
    borderColor: '#00686F',
  },
  stepDotCompleted: {
    backgroundColor: '#00686F',
    borderColor: '#00686F',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#00686F',
  },
  stepLabels: {
    flexDirection: 'row',
    width: 180,
    justifyContent: 'space-between',
  },
  stepLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepLabelActive: {
    color: '#00686F',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,104,111,0.08)',
    marginBottom: 16,
  },
  cardAccentBar: {
    height: 4,
    backgroundColor: '#00686F',
  },
  cardInner: {
    padding: 24,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: '#00686F',
    borderRadius: 13,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#00686F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnArrow: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  backBtn: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#00686F',
    backgroundColor: 'rgba(0,104,111,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    color: '#00686F',
    fontSize: 15,
    fontWeight: '800',
  },

  // Login link
  loginLink: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  loginLinkHighlight: {
    color: '#00686F',
    fontWeight: '800',
  },
});