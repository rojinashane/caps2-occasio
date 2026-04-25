import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    Image,
    Animated,
    Dimensions,
    Platform,
    Linking,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomText from './CustomText';

// ─── Brand ────────────────────────────────────────────────────────────────────
const BLUE       = '#1D4ED8';
const BLUE_LIGHT = '#EFF6FF';
const BLUE_BORDER= '#BFDBFE';
const BLUE_MID   = '#DBEAFE';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Scaniverse store links ───────────────────────────────────────────────────
const SCANIVERSE_DEEP_LINK      = 'scaniverse://';
const SCANIVERSE_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nianticlabs.scaniverse';
const SCANIVERSE_APP_STORE_URL  = 'https://apps.apple.com/us/app/scaniverse-3d-scanner/id1541433893';

const openScaniverse = async () => {
    const storeUrl = Platform.OS === 'ios' ? SCANIVERSE_APP_STORE_URL : SCANIVERSE_PLAY_STORE_URL;
    try {
        const isInstalled = await Linking.canOpenURL(SCANIVERSE_DEEP_LINK);
        if (isInstalled) {
            await Linking.openURL(SCANIVERSE_DEEP_LINK);
        } else {
            const canOpen = await Linking.canOpenURL(storeUrl);
            if (canOpen) await Linking.openURL(storeUrl);
        }
    } catch { /* silent fail */ }
};

// ─── Guide slides ─────────────────────────────────────────────────────────────
const SLIDES = [
    {
        key:      'intro',
        tag:      'GETTING STARTED',
        title:    'Scan Your Venue in 3D',
        body:     'Turn your venue into an immersive AR experience. Guests can explore every corner before booking — right from their phone.',
        image:    require('../assets/guide1.jpg'),
        hasAppBtn: false,
    },
    {
        key:      'step1',
        tag:      'STEP 1',
        title:    'Download Scaniverse',
        body:     'Install the free Scaniverse app on your device. It\'s available on both iOS and Android.',
        image:    require('../assets/guide2.jpg'),
        hasAppBtn: true,
    },
    {
        key:      'step2',
        tag:      'STEP 2',
        title:    'Scan Your Venue',
        body:     'Open Scaniverse, point your camera around the venue, and move slowly to capture all angles for the best result.',
        image:    require('../assets/guide3.jpg'),
        hasAppBtn: false,
    },
    {
        key:      'step3',
        tag:      'STEP 3',
        title:    'Adjust & Export',
        body:     'Once the scan is complete, review and clean it up inside Scaniverse, then export it as a .glb file.',
        image:    require('../assets/guide4.jpg'),
        hasAppBtn: false,
    },
    {
        key:      'step4',
        tag:      'STEP 4',
        title:    'Upload to Occasio',
        body:     'Come back here and import your .glb file. Your venue will instantly become AR-ready for all Event Planner of Occasio.',
        image:    require('../assets/guide5.jpg'),
        hasAppBtn: false,
        isFinal:  true,
    },
];

// ─── GuideModal ───────────────────────────────────────────────────────────────
export default function GuideModal({ visible, onClose }) {
    const [index, setIndex]       = useState(0);
    const fadeAnim                = useRef(new Animated.Value(1)).current;
    const slideAnim               = useRef(new Animated.Value(0)).current;
    const progressAnim            = useRef(new Animated.Value(0)).current;

    const slide    = SLIDES[index];
    const isFirst  = index === 0;
    const isLast   = index === SLIDES.length - 1;
    const progress = (index + 1) / SLIDES.length;

    // Animate progress bar on slide change
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [index]);

    // Reset on open
    useEffect(() => {
        if (visible) {
            setIndex(0);
            progressAnim.setValue(1 / SLIDES.length);
        }
    }, [visible]);

    const animateTo = (nextIndex, direction) => {
        const outX = direction > 0 ? -24 : 24;
        Animated.parallel([
            Animated.timing(fadeAnim,  { toValue: 0, duration: 110, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: outX, duration: 110, useNativeDriver: true }),
        ]).start(() => {
            setIndex(nextIndex);
            slideAnim.setValue(-outX);
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]).start();
        });
    };

    const goNext = () => {
        if (isLast) { onClose(); return; }
        animateTo(index + 1, 1);
    };

    const goPrev = () => {
        if (isFirst) { onClose(); return; }
        animateTo(index - 1, -1);
    };

    const goToIndex = (i) => {
        if (i === index) return;
        animateTo(i, i > index ? 1 : -1);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(10,18,38,0.72)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 12,
            }}>
                <View style={{
                    width: '100%',
                    backgroundColor: '#fff',
                    borderRadius: 32,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 24 },
                    shadowOpacity: 0.3,
                    shadowRadius: 40,
                    elevation: 24,
                }}>

                    {/* ── Progress bar (top) ───────────────────────────────── */}
                    <View style={{ height: 4, backgroundColor: '#F1F5F9' }}>
                        <Animated.View style={{
                            height: '100%',
                            backgroundColor: BLUE,
                            borderRadius: 2,
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                        }} />
                    </View>

                    {/* ── Header row ───────────────────────────────────────── */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingTop: 18,
                        paddingBottom: 12,
                    }}>
                        {/* App label + step tag */}
                        <View>
                            <CustomText style={{
                                fontSize: 10, fontWeight: '800', color: BLUE,
                                letterSpacing: 1.2, textTransform: 'uppercase',
                            }}>
                                Occasio Guide
                            </CustomText>
                            <CustomText style={{
                                fontSize: 12, fontWeight: '700', color: '#94A3B8',
                                letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1,
                            }}>
                                {slide.tag}
                            </CustomText>
                        </View>

                        {/* Dot indicators */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            {SLIDES.map((_, i) => (
                                <TouchableOpacity key={i} onPress={() => goToIndex(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                                    <View style={{
                                        width:  i === index ? 18 : 6,
                                        height: 6,
                                        borderRadius: 3,
                                        backgroundColor: i === index ? BLUE : '#CBD5E1',
                                    }} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Close button */}
                        <TouchableOpacity
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={{
                                width: 34, height: 34, borderRadius: 10,
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1, borderColor: '#E8EEF4',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Ionicons name="close" size={17} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    {/* ── Slide content ────────────────────────────────────── */}
                    <Animated.View style={{
                        opacity:   fadeAnim,
                        transform: [{ translateX: slideAnim }],
                    }}>
                        {/* Guide image */}
                        <View style={{
                            marginHorizontal: 16,
                            borderRadius: 20,
                            overflow: 'hidden',
                            backgroundColor: BLUE_LIGHT,
                            borderWidth: 1.5,
                            borderColor: BLUE_BORDER,
                            height: Math.round(SCREEN_HEIGHT * 0.38),
                        }}>
                            <Image
                                source={slide.image}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />

                            {/* Step badge overlay */}
                            {!isFirst && (
                                <View style={{
                                    position: 'absolute', top: 12, left: 12,
                                    backgroundColor: BLUE,
                                    paddingHorizontal: 10, paddingVertical: 4,
                                    borderRadius: 20,
                                    flexDirection: 'row', alignItems: 'center', gap: 5,
                                }}>
                                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                                    <CustomText style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>
                                        {slide.tag}
                                    </CustomText>
                                </View>
                            )}

                            {/* Final badge */}
                            {slide.isFinal && (
                                <View style={{
                                    position: 'absolute', top: 12, right: 12,
                                    backgroundColor: '#10B981',
                                    paddingHorizontal: 10, paddingVertical: 4,
                                    borderRadius: 20,
                                    flexDirection: 'row', alignItems: 'center', gap: 5,
                                }}>
                                    <Ionicons name="checkmark-circle" size={11} color="#fff" />
                                    <CustomText style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                                        All set!
                                    </CustomText>
                                </View>
                            )}
                        </View>

                        {/* Text block */}
                        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
                            <CustomText style={{
                                fontSize: 20, fontWeight: '800', color: '#0F172A',
                                lineHeight: 28, letterSpacing: -0.3, marginBottom: 8,
                            }}>
                                {slide.title}
                            </CustomText>
                            <CustomText style={{
                                fontSize: 13.5, color: '#64748B', lineHeight: 21,
                                fontWeight: '500',
                            }}>
                                {slide.body}
                            </CustomText>

                            {/* Open Scaniverse button (step 1 only) */}
                            {slide.hasAppBtn && (
                                <TouchableOpacity
                                    onPress={openScaniverse}
                                    activeOpacity={0.85}
                                    style={{
                                        marginTop: 16,
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: BLUE,
                                        paddingVertical: 13, borderRadius: 16, gap: 8,
                                        shadowColor: BLUE, shadowOffset: { width: 0, height: 5 },
                                        shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
                                    }}
                                >
                                    <Ionicons name="download-outline" size={17} color="#fff" />
                                    <CustomText style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                        Download Scaniverse
                                    </CustomText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>

                    {/* ── Footer navigation ────────────────────────────────── */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 20,
                        paddingTop: 12,
                        paddingBottom: Platform.OS === 'ios' ? 28 : 20,
                        gap: 10,
                    }}>
                        {/* Back / Skip */}
                        <TouchableOpacity
                            onPress={goPrev}
                            style={{
                                flexDirection: 'row', alignItems: 'center', gap: 5,
                                paddingVertical: 13, paddingHorizontal: 18,
                                borderRadius: 14, backgroundColor: '#F1F5F9',
                                borderWidth: 1, borderColor: '#E2E8F0',
                            }}
                        >
                            {isFirst
                                ? <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#94A3B8' }}>Close</CustomText>
                                : <>
                                    <Ionicons name="arrow-back" size={15} color="#64748B" />
                                    <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Back</CustomText>
                                  </>
                            }
                        </TouchableOpacity>

                        {/* Next / Done */}
                        <TouchableOpacity
                            onPress={goNext}
                            activeOpacity={0.85}
                            style={{
                                flex: 1,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                                paddingVertical: 13, borderRadius: 14,
                                backgroundColor: isLast ? '#10B981' : BLUE,
                                shadowColor: isLast ? '#10B981' : BLUE,
                                shadowOffset: { width: 0, height: 5 },
                                shadowOpacity: 0.28, shadowRadius: 10, elevation: 5,
                            }}
                        >
                            <CustomText style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                {isLast ? 'Got it!' : 'Next'}
                            </CustomText>
                            <Ionicons
                                name={isLast ? 'checkmark-circle-outline' : 'arrow-forward'}
                                size={16}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
}