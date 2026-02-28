import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LandingScreen({ navigation }) {
  // --- ALL ANIMATION VALUES UNCHANGED ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const socialFade = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance sequence — unchanged
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideUpAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.back(1)),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(socialFade, {
          toValue: 1,
          duration: 800,
          delay: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Floating animation — unchanged
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F4F4" />

      {/* Decorative background orbs — matches Login/Signup */}
      <View style={styles.orbTopRight} />
      <View style={styles.orbBottomLeft} />
      <View style={styles.orbMid} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.content}>

          {/* ── Hero Section ── */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: Animated.add(slideUpAnim, bounceAnim) },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            {/* Eyebrow label */}
            <View style={styles.eyebrowPill}>
              <View style={styles.eyebrowDot} />
              <CustomText style={styles.welcomeText}>Welcome to</CustomText>
            </View>

            {/* Logo in card */}
            <View style={styles.logoCard}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Image
                  source={require('../assets/logoo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </Animated.View>
              {/* Decorative ring */}
              <View style={styles.logoRingOuter} />
            </View>

            {/* Brand name */}
            <CustomText style={styles.brandName}>Occasio</CustomText>

            {/* Accent divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDiamond} />
              <View style={styles.dividerLine} />
            </View>

            {/* Tagline */}
            <CustomText style={styles.tagline}>Plan Events Beyond the Screen</CustomText>

            {/* Feature pills */}
            <View style={styles.featurePills}>
              {['Smart Planning', 'Easy RSVPs', 'Real-time Updates'].map((f, i) => (
                <View key={i} style={styles.featurePill}>
                  <Ionicons name="checkmark-circle" size={12} color="#00686F" />
                  <CustomText style={styles.featurePillText}>{f}</CustomText>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Footer / CTA Section ── */}
          <Animated.View
            style={[
              styles.footer,
              {
                opacity: buttonFade,
                transform: [{
                  translateY: buttonFade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            {/* Login button */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.88}
              style={styles.primaryButton}
            >
              <View style={styles.primaryButtonInner}>
                <CustomText style={styles.primaryButtonText}>Sign In</CustomText>
                <View style={styles.primaryButtonArrow}>
                  <Ionicons name="arrow-forward" size={16} color="#00686F" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Create account button */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.8}
              style={styles.secondaryButton}
            >
              <CustomText style={styles.secondaryButtonText}>Create Account</CustomText>
            </TouchableOpacity>

            {/* Social section */}
            <Animated.View style={[styles.socialSection, { opacity: socialFade }]}>
              <View style={styles.socialDividerRow}>
                <View style={styles.socialDividerLine} />
                <CustomText style={styles.socialTitle}>Connect with us</CustomText>
                <View style={styles.socialDividerLine} />
              </View>
              <View style={styles.socialIcons}>
                {[
                  { name: 'logo-facebook', color: '#1877F2', bg: '#EEF4FF' },
                  { name: 'logo-twitter', color: '#1DA1F2', bg: '#EFF8FF' },
                  { name: 'logo-instagram', color: '#E4405F', bg: '#FFF0F3' },
                ].map((social, index) => (
                  <TouchableOpacity key={index} style={[styles.socialCircle, { backgroundColor: social.bg }]}>
                    <Ionicons name={social.name} size={20} color={social.color} />
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </Animated.View>

        </View>
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
  orbTopRight: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: '#00686F',
    opacity: 0.13,
    top: -80,
    right: -80,
  },
  orbBottomLeft: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: '#00868E',
    opacity: 0.10,
    bottom: 60,
    left: -60,
  },
  orbMid: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: '#004D52',
    opacity: 0.06,
    top: height * 0.42,
    right: 10,
  },

  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: height * 0.07,
    paddingBottom: 32,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
  },

  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,104,111,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(0,104,111,0.14)',
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00686F',
  },
  welcomeText: {
    fontSize: 12,
    color: '#00686F',
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '700',
  },

  // Logo card
  logoCard: {
    width: 116,
    height: 116,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: '#00686F',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,104,111,0.12)',
    position: 'relative',
  },
  logoRingOuter: {
    position: 'absolute',
    inset: -6,
    width: 128,
    height: 128,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(0,104,111,0.10)',
    borderStyle: 'dashed',
  },
  logoImage: {
    width: 74,
    height: 74,
  },

  brandName: {
    fontSize: 54,
    fontWeight: '900',
    color: '#004D52',
    letterSpacing: -2,
    textAlign: 'center',
    lineHeight: 62,
    marginBottom: 14,
  },

  // Accent divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dividerLine: {
    width: 36,
    height: 1.5,
    backgroundColor: 'rgba(0,104,111,0.3)',
    borderRadius: 1,
  },
  dividerDiamond: {
    width: 7,
    height: 7,
    backgroundColor: '#00686F',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },

  tagline: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '600',
    maxWidth: '80%',
    lineHeight: 22,
    marginBottom: 20,
  },

  // Feature pills row
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,104,111,0.12)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featurePillText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },

  // ── Footer ──
  footer: {
    width: '100%',
    marginTop: 32,
  },

  primaryButton: {
    backgroundColor: '#00686F',
    borderRadius: 16,
    height: 56,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00686F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  primaryButtonArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButton: {
    borderColor: '#00686F',
    borderWidth: 2,
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,104,111,0.04)',
  },
  secondaryButtonText: {
    color: '#00686F',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Social
  socialSection: {
    alignItems: 'center',
    marginTop: 28,
  },
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    width: '80%',
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  socialTitle: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 14,
  },
  socialCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});