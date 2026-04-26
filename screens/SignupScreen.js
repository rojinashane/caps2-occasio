import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
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

const TEAL      = '#00686F';
const TEAL_SOFT = 'rgba(0,104,111,0.09)';

const InputField = ({ label, icon, ...props }) => (
  <View style={sf.fieldGroup}>
    <CustomText style={sf.label}>{label}</CustomText>
    <View style={sf.inputRow}>
      <View style={sf.iconWrap}>
        <Ionicons name={icon} size={17} color={TEAL} />
      </View>
      <TextInput
        style={sf.textInput}
        placeholderTextColor="#B0BAC9"
        {...props}
      />
    </View>
  </View>
);

export default function SignupScreen({ navigation }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // step 1 = Role, step 2 = Personal Details, step 3 = Account Setup
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null); // null | 'planner' | 'owner'

  const [firstname,  setFirstname]  = useState('');
  const [middlename, setMiddlename] = useState('');
  const [lastname,   setLastname]   = useState('');
  const [username,   setUsername]   = useState('');   // planner only
  const [venueName,  setVenueName]  = useState('');   // owner only
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');

  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const animateStep = (direction, onMidpoint) => {
    const outVal = direction === 'forward' ? -30 : 30;
    Animated.timing(slideAnim, {
      toValue: outVal,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Swap content while the card is off-screen
      onMidpoint();
      slideAnim.setValue(-outVal);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // ── Step 1 → 2: Role must be chosen ─────────────────────────────
  const handleRoleNext = () => {
    if (!role) {
      Alert.alert('Role Required', 'Please select a role to continue.');
      return;
    }
    animateStep('forward', () => setStep(2));
  };

  // ── Step 2 → 3: Validate fields by role ─────────────────────────
  const handleDetailsNext = () => {
    if (!firstname.trim() || !lastname.trim()) {
      Alert.alert('Missing Fields', 'First and Last name are required.');
      return;
    }
    if (role === 'planner' && !username.trim()) {
      Alert.alert('Missing Fields', 'Username is required for Event Planners.');
      return;
    }
    if (role === 'owner' && !venueName.trim()) {
      Alert.alert('Missing Fields', 'Venue Name is required for Venue Owners.');
      return;
    }
    animateStep('forward', () => setStep(3));
  };

  // ── Step 3: Create account ───────────────────────────────────────
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
      const cleanEmail     = email.trim().toLowerCase();
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user           = userCredential.user;

      const userData = {
        firstName:  firstname.trim(),
        middleName: middlename.trim(),
        lastName:   lastname.trim(),
        email:      cleanEmail,
        role:       role,
        createdAt:  serverTimestamp(),
        uid:        user.uid,
      };

      // Role-specific field only
      if (role === 'planner') {
        userData.username  = username.trim();
      } else {
        userData.venueName = venueName.trim();
      }

      await setDoc(doc(db, 'users', user.uid), userData);
      await sendEmailVerification(user);
      await signOut(auth);

      Alert.alert(
        'Verify Email',
        `Account created as ${role === 'planner' ? 'Event Planner' : 'Venue Owner'}! Please check your inbox and verify your email before logging in.`,
        [{ text: 'OK', onPress: () => navigation.replace('Login') }]
      );
    } catch (err) {
      console.error('Signup failed:', err);
      let errorMessage = 'An error occurred. Please try again.';
      if (err.code === 'auth/email-already-in-use') errorMessage = 'This email is already registered.';
      else if (err.code === 'auth/invalid-email')   errorMessage = 'Invalid email format.';
      Alert.alert('Signup Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Your Role', 'Personal Info', 'Account Setup'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.blobTR} pointerEvents="none" />
      <View style={styles.blobBL} pointerEvents="none" />

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
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>

            {/* ── Header ── */}
            <View style={styles.header}>
              <CustomText style={styles.title}>Create Account</CustomText>
              <CustomText style={styles.subtitle}>
                Join Occasio and plan unforgettable events
              </CustomText>

              {/* 3-step progress tracker */}
              <View style={styles.stepRow}>
                {[1, 2, 3].map((s, i) => (
                  <React.Fragment key={s}>
                    <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                      {step > s
                        ? <Ionicons name="checkmark" size={12} color="#FFF" />
                        : <CustomText style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</CustomText>
                      }
                    </View>
                    {i < 2 && (
                      <View style={[styles.stepLine, step > s && styles.stepLineActive]} />
                    )}
                  </React.Fragment>
                ))}
              </View>

              <View style={styles.stepLabels}>
                {stepLabels.map((label, i) => (
                  <CustomText
                    key={label}
                    style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}
                  >
                    {label}
                  </CustomText>
                ))}
              </View>
            </View>

            {/* ── Card ── */}
            <Animated.View style={[styles.card, { transform: [{ translateX: slideAnim }] }]}>
              <View style={styles.cardStripe} />
              <View style={styles.cardBody}>

                {/* ── STEP 1: ROLE SELECTION ── */}
                {step === 1 && (
                  <>
                    <CustomText style={styles.roleHeading}>I want to register as a:</CustomText>

                    <TouchableOpacity
                      style={[styles.roleCard, role === 'planner' && styles.roleCardActive]}
                      onPress={() => setRole('planner')}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.roleIconWrap, role === 'planner' && styles.roleIconWrapActive]}>
                        <Ionicons name="calendar" size={22} color={role === 'planner' ? '#FFF' : TEAL} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <CustomText style={[styles.roleCardTitle, role === 'planner' && styles.roleCardTitleActive]}>
                          Event Planner
                        </CustomText>
                        <CustomText style={[styles.roleCardDesc, role === 'planner' && styles.roleCardDescActive]}>
                          Organize and manage events
                        </CustomText>
                      </View>
                      {role === 'planner' && <Ionicons name="checkmark-circle" size={22} color="#FFF" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.roleCard, role === 'owner' && styles.roleCardActive]}
                      onPress={() => setRole('owner')}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.roleIconWrap, role === 'owner' && styles.roleIconWrapActive]}>
                        <Ionicons name="business" size={22} color={role === 'owner' ? '#FFF' : TEAL} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <CustomText style={[styles.roleCardTitle, role === 'owner' && styles.roleCardTitleActive]}>
                          Venue Owner
                        </CustomText>
                        <CustomText style={[styles.roleCardDesc, role === 'owner' && styles.roleCardDescActive]}>
                          List and manage your property
                        </CustomText>
                      </View>
                      {role === 'owner' && <Ionicons name="checkmark-circle" size={22} color="#FFF" />}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRoleNext} style={styles.primaryBtn} activeOpacity={0.85}>
                      <CustomText style={styles.primaryBtnText}>Continue</CustomText>
                      <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  </>
                )}

                {/* ── STEP 2: PERSONAL DETAILS (adapts per role) ── */}
                {step === 2 && (
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

                    {/* Event Planner → Username */}
                    {role === 'planner' && (
                      <InputField
                        label="Username *"
                        icon="at-outline"
                        placeholder="johndoe"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleDetailsNext}
                      />
                    )}

                    {/* Venue Owner → Venue Name */}
                    {role === 'owner' && (
                      <InputField
                        label="Venue Name *"
                        icon="location-outline"
                        placeholder="e.g. The Grand Ballroom"
                        value={venueName}
                        onChangeText={setVenueName}
                        returnKeyType="done"
                        onSubmitEditing={handleDetailsNext}
                      />
                    )}

                    <View style={styles.stepBtnRow}>
                      <TouchableOpacity
                        onPress={() => animateStep('back', () => setStep(1))}
                        style={styles.backBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="arrow-back" size={16} color={TEAL} />
                        <CustomText style={styles.backBtnText}>Back</CustomText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleDetailsNext}
                        style={[styles.primaryBtn, styles.flex1]}
                        activeOpacity={0.85}
                      >
                        <CustomText style={styles.primaryBtnText}>Next</CustomText>
                        <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* ── STEP 3: ACCOUNT SETUP ── */}
                {step === 3 && (
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

                    <View style={sf.fieldGroup}>
                      <CustomText style={sf.label}>Password *</CustomText>
                      <View style={sf.inputRow}>
                        <View style={sf.iconWrap}>
                          <Ionicons name="lock-closed-outline" size={17} color={TEAL} />
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
                        onPress={() => animateStep('back', () => setStep(2))}
                        style={styles.backBtn}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="arrow-back" size={16} color={TEAL} />
                        <CustomText style={styles.backBtnText}>Back</CustomText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSignup}
                        disabled={loading}
                        style={[styles.primaryBtn, styles.flex1, loading && { opacity: 0.65 }]}
                        activeOpacity={0.85}
                      >
                        {loading
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <CustomText style={styles.primaryBtnText}>Create Account</CustomText>
                        }
                      </TouchableOpacity>
                    </View>
                  </>
                )}

              </View>
            </Animated.View>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
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

const sf = StyleSheet.create({
  fieldGroup: { marginBottom: 14 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#4B5563',
    marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F7FAFA', borderRadius: 14,
    paddingHorizontal: 12, height: 52,
    borderWidth: 1.5, borderColor: '#E2ECEC',
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: TEAL_SOFT,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  textInput: { flex: 1, fontSize: 15, color: '#0D1B2A', fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF4F4' },
  blobTR: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: TEAL, opacity: 0.07, top: -90, right: -80,
  },
  blobBL: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: TEAL, opacity: 0.05, bottom: 60, left: -60,
  },
  scrollContent: {
    flexGrow: 1, justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 32,
  },
  header:   { alignItems: 'center', marginBottom: 22 },
  title:    { fontSize: 28, fontWeight: '800', color: '#0D1B2A', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginBottom: 20, textAlign: 'center' },

  stepRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepDot:        { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5EAEA', borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  stepDotActive:  { backgroundColor: TEAL, borderColor: TEAL },
  stepNum:        { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepNumActive:  { color: '#FFFFFF' },
  stepLine:       { width: 40, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: TEAL },
  stepLabels:     { flexDirection: 'row', width: 260, justifyContent: 'space-between' },
  stepLabel:      { fontSize: 10, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.3 },
  stepLabelActive:{ color: TEAL },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 28, overflow: 'hidden',
    shadowColor: '#000D1A', shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08, shadowRadius: 28, elevation: 8,
    borderWidth: 1, borderColor: TEAL_SOFT, marginBottom: 14,
  },
  cardStripe: { height: 4, backgroundColor: TEAL },
  cardBody:   { padding: 24 },

  roleHeading:         { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 14 },
  roleCard:            { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2ECEC', marginBottom: 12, gap: 14, backgroundColor: '#F7FAFA' },
  roleCardActive:      { backgroundColor: TEAL, borderColor: TEAL },
  roleIconWrap:        { width: 42, height: 42, borderRadius: 12, backgroundColor: TEAL_SOFT, alignItems: 'center', justifyContent: 'center' },
  roleIconWrapActive:  { backgroundColor: 'rgba(255,255,255,0.2)' },
  roleCardTitle:       { fontSize: 15, fontWeight: '700', color: '#0D1B2A' },
  roleCardTitleActive: { color: '#FFF' },
  roleCardDesc:        { fontSize: 12, color: '#6B7280', marginTop: 2 },
  roleCardDescActive:  { color: 'rgba(255,255,255,0.8)' },

  primaryBtn:     { backgroundColor: TEAL, borderRadius: 14, height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 6, shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  stepBtnRow:     { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  flex1:          { flex: 1 },
  backBtn:        { height: 52, paddingHorizontal: 16, borderRadius: 14, borderWidth: 2, borderColor: TEAL, backgroundColor: TEAL_SOFT, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtnText:    { color: TEAL, fontSize: 15, fontWeight: '800' },
  loginLink:      { paddingVertical: 14, alignItems: 'center' },
  loginLinkText:      { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  loginLinkHighlight: { color: TEAL, fontWeight: '800' },
});