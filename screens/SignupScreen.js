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

// InputField defined OUTSIDE the main component (unchanged pattern)
const InputField = ({ label, icon, ...props }) => (
  <View style={sf.fieldGroup}>
    <CustomText style={sf.label}>{label}</CustomText>
    <View style={sf.inputRow}>
      <View style={sf.iconWrap}>
        <Ionicons name={icon} size={17} color="#00686F" />
      </View>
      <TextInput
        style={sf.textInput}
        placeholderTextColor="#B0BAC9"
        {...props}
      />
    </View>
  </View>
);

// Shared field styles (kept outside to avoid re-creation)
const sf = StyleSheet.create({
  fieldGroup: {
    marginBottom: 14,
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
    backgroundColor: 'rgba(0,104,111,0.09)',
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
});

export default function SignupScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // BUG FIX: slideAnim is applied only to the card, not the whole page,
  // so input focus can't trigger a page-level layout recalculation.
  const slideAnim = useRef(new Animated.Value(0)).current;

  // --- ALL STATE UNCHANGED ---
  const [step, setStep]           = useState(1);
  const [firstname, setFirstname] = useState('');
  const [middlename, setMiddlename] = useState('');
  const [lastname, setLastname]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
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
      {/* Decorative blobs */}
      <View style={styles.blobTR} pointerEvents="none" />
      <View style={styles.blobBL} pointerEvents="none" />

      {/* KAV wraps ScrollView — correct nesting */}
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
          {/* Outer wrapper fades in — no translateX here so focus can't shift layout */}
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Header */}
            <View style={styles.header}>
              <CustomText style={styles.title}>Create Account</CustomText>
              <CustomText style={styles.subtitle}>
                Join Occasio and plan unforgettable events
              </CustomText>

              {/* Step indicator */}
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
                  {step > 1
                    ? <Ionicons name="checkmark" size={12} color="#FFF" />
                    : <CustomText style={styles.stepNum}>1</CustomText>
                  }
                </View>
                <View style={[styles.stepLine, step > 1 && styles.stepLineActive]} />
                <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
                  <CustomText style={[styles.stepNum, step >= 2 && styles.stepNumActive]}>2</CustomText>
                </View>
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

            {/* BUG FIX: translateX lives here on the card only, not the outer wrapper */}
            <Animated.View
              style={[styles.card, { transform: [{ translateX: slideAnim }] }]}
            >
              <View style={styles.cardStripe} />
              <View style={styles.cardBody}>

                {/* Step 1 */}
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
                      style={styles.primaryBtn}
                      activeOpacity={0.85}
                    >
                      <CustomText style={styles.primaryBtnText}>Continue</CustomText>
                      <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 2 */}
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

                    {/* Password (custom — keeps toggle button) */}
                    <View style={sf.fieldGroup}>
                      <CustomText style={sf.label}>Password *</CustomText>
                      <View style={sf.inputRow}>
                        <View style={sf.iconWrap}>
                          <Ionicons name="lock-closed-outline" size={17} color="#00686F" />
                        </View>
                        <TextInput
                          style={sf.textInput}
                          placeholder="6+ characters"
                          placeholderTextColor="#B0BAC9"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          returnKeyType="done"
                          onSubmitEditing={handleSignup}
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

                    <View style={styles.stepBtnRow}>
                      <TouchableOpacity
                        onPress={() => { animateStep('back'); setStep(1); }}
                        style={styles.backBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="arrow-back" size={16} color="#00686F" />
                        <CustomText style={styles.backBtnText}>Back</CustomText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSignup}
                        disabled={loading}
                        style={[styles.primaryBtn, styles.flex1, loading && { opacity: 0.65 }]}
                        activeOpacity={0.85}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <CustomText style={styles.primaryBtnText}>Create Account</CustomText>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>

            {/* Login link */}
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
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: TEAL,
    opacity: 0.07,
    top: -90,
    right: -80,
  },
  blobBL: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: TEAL,
    opacity: 0.05,
    bottom: 60,
    left: -60,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0D1B2A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },

  /* Step indicator */
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 130,
    marginBottom: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5EAEA',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNumActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: TEAL,
  },
  stepLabels: {
    flexDirection: 'row',
    width: 190,
    justifyContent: 'space-between',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepLabelActive: {
    color: TEAL,
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
    marginBottom: 14,
  },
  cardStripe: {
    height: 4,
    backgroundColor: TEAL,
  },
  cardBody: {
    padding: 24,
  },

  /* Buttons */
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stepBtnRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  flex1: {
    flex: 1,
  },
  backBtn: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: TEAL,
    backgroundColor: TEAL_SOFT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: '800',
  },

  /* Login link */
  loginLink: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  loginLinkHighlight: {
    color: TEAL,
    fontWeight: '800',
  },
});