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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const socialFade = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance sequence
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

    // Floating animation
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
      <StatusBar barStyle="dark-content" backgroundColor="#EFF0EE" />
      
      <View style={styles.bgCircle} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.content}>
          {/* Header Section */}
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: Animated.add(slideUpAnim, bounceAnim) }, 
                  { scale: scaleAnim }
                ],
              }
            ]}
          >
            <CustomText style={styles.welcomeText}>Welcome to</CustomText>
            
            {/* Reduced size for logoWrapper */}
            <Animated.View style={[styles.logoWrapper, { transform: [{ rotate: spin }] }]}>
              <Image 
                source={require('../assets/logo/logoo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Enhanced brandName styling */}
            <CustomText style={styles.brandName}>Occasio</CustomText>
            <View style={styles.brandDivider} />
            <CustomText style={styles.tagline}>Plan Event Beyond the Screen</CustomText>
          </Animated.View>

          {/* Bottom Section */}
          <Animated.View 
            style={[
              styles.footer, 
              { 
                opacity: buttonFade, 
                transform: [{ 
                  translateY: buttonFade.interpolate({ 
                    inputRange: [0, 1], 
                    outputRange: [20, 0] 
                  }) 
                }] 
              }
            ]}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.9}
              style={styles.primaryButton}
            >
              <CustomText style={styles.primaryButtonText}>Login</CustomText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.7}
              style={styles.secondaryButton}
            >
              <CustomText style={styles.secondaryButtonText}>Create Account</CustomText>
            </TouchableOpacity>

            <Animated.View style={[styles.socialSection, { opacity: socialFade }]}>
              <CustomText style={styles.socialTitle}>Connect with us</CustomText>
              <View style={styles.socialIcons}>
                {[
                  { name: 'logo-facebook', color: '#1877F2' },
                  { name: 'logo-twitter', color: '#1DA1F2' },
                  { name: 'logo-instagram', color: '#E4405F' },
                ].map((social, index) => (
                  <TouchableOpacity key={index} style={styles.socialCircle}>
                    <Ionicons name={social.name} size={22} color={social.color} />
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
    backgroundColor: '#EFF0EE',
  },
  bgCircle: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: 'rgba(0, 104, 111, 0.03)',
    top: -width * 0.4,
    left: -width * 0.25,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingTop: height * 0.08,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#9CA3AF',
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 15,
  },
  logoWrapper: {
    width: 100, // Shrunk from 140 to 100 for a more balanced look
    height: 100,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 52, // Slightly larger
    fontWeight: '900', // Heavier weight for better presence
    color: '#004D52',
    letterSpacing: -1.5, // Tighter spacing for a modern "full" look
    textAlign: 'center',
    lineHeight: 60, // Ensure no clipping
  },
  brandDivider: {
    width: 50, // Wider divider
    height: 4, // Thicker divider
    backgroundColor: '#00686F',
    borderRadius: 2,
    marginVertical: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500', // Slightly bolder tagline
    maxWidth: '85%',
  },
  footer: {
    width: '100%',
    marginTop: 30,
  },
  primaryButton: {
    backgroundColor: '#00686F',
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#EFF0EE',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    borderColor: '#00686F',
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 18,
  },
  secondaryButtonText: {
    color: '#00686F',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  socialSection: {
    alignItems: 'center',
    marginTop: 35,
  },
  socialTitle: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  socialIcons: {
    flexDirection: 'row',
    gap: 20,
  },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
});