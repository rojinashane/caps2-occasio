import React, { useRef } from 'react';
import {
    View,
    Animated,
    TouchableOpacity,
    Linking,
    Platform,
    Dimensions,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// ── BRAND PALETTE (mirrors DashboardScreen exactly) ──────────
const BRAND = {
    primary:      '#00686F',
    primaryDark:  '#004E54',
    primaryBg:    '#E8F5F5',
    primaryMid:   '#E0F2F3',
    primaryFaint: '#F0F9FA',
};

export default function VenueDetailsScreen({ route, navigation }) {
    const { venue } = route.params;
    const scrollY = useRef(new Animated.Value(0)).current;

    const priceDisplay   = venue.price ? venue.price.split(' ')[0] : '₱0';
    const hasCoordinates = venue.coordinates?.latitude && venue.coordinates?.longitude;

    // ── SMART MAP LINKING ──────────────────────────────────────
    const handleOpenMaps = () => {
        if (hasCoordinates) {
            // Open via exact coordinates if available
            const { latitude, longitude } = venue.coordinates;
            const url = Platform.select({
                ios: `maps:0,0?q=${venue.name}@${latitude},${longitude}`,
                android: `geo:0,0?q=${latitude},${longitude}(${venue.name})`,
            });
            Linking.openURL(url);
        } else if (venue.location) {
            // Fallback: search the text address in the Maps app
            const query = encodeURIComponent(`${venue.name} ${venue.location}`);
            const url = Platform.select({
                ios: `maps:0,0?q=${query}`,
                android: `geo:0,0?q=${query}`,
            });
            Linking.openURL(url);
        }
    };

    // Hero image parallax
    const heroTranslate = scrollY.interpolate({
        inputRange: [-100, 0, 300],
        outputRange: [50, 0, -80],
        extrapolate: 'clamp',
    });

    // Header background fades in as user scrolls
    const headerBg = scrollY.interpolate({
        inputRange: [180, 260],
        outputRange: ['rgba(240,244,248,0)', 'rgba(240,244,248,1)'],
        extrapolate: 'clamp',
    });
    const headerBorder = scrollY.interpolate({
        inputRange: [220, 280],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <View style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* ── FLOATING HEADER ─────────────────────────── */}
            <Animated.View
                style={{
                    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
                    backgroundColor: headerBg,
                    borderBottomWidth: headerBorder,
                    borderBottomColor: '#E8EEF4',
                }}
            >
                <SafeAreaView edges={['top']}>
                    <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 20, paddingVertical: 10,
                    }}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={{
                                width: 40, height: 40, borderRadius: 20,
                                backgroundColor: 'rgba(255,255,255,0.92)',
                                justifyContent: 'center', alignItems: 'center',
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
                            }}
                        >
                            <Ionicons name="chevron-back" size={20} color={BRAND.primary} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Animated.View>

            {/* ── SCROLLABLE BODY ──────────────────────────── */}
            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                {/* ── HERO IMAGE ───────────────────────────── */}
                <View style={{ width, height: 320, overflow: 'hidden' }}>
                    <Animated.Image
                        source={{ uri: venue.image }}
                        style={{
                            width: '100%', height: 380,
                            transform: [{ translateY: heroTranslate }],
                        }}
                        resizeMode="cover"
                    />
                    {/* Gradient scrim */}
                    <View
                        style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
                            backgroundColor: 'rgba(0,0,0,0.45)',
                        }}
                    />
                    {/* AR badge */}
                    {venue.hasAR && (
                        <View
                            style={{
                                position: 'absolute', bottom: 20, right: 20,
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: BRAND.primary + 'EE',
                                borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
                            }}
                        >
                            <Ionicons name="cube" size={14} color="#FFF" />
                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 11, marginLeft: 5, letterSpacing: 0.8 }}>
                                AR READY
                            </CustomText>
                        </View>
                    )}
                    {/* Venue name overlaid on hero */}
                    <View style={{ position: 'absolute', bottom: 20, left: 20, right: venue.hasAR ? 120 : 20 }}>
                        <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 26, lineHeight: 32 }} numberOfLines={2}>
                            {venue.name}
                        </CustomText>
                    </View>
                </View>

                {/* ── MAIN CONTENT CARD ────────────────────── */}
                <View
                    style={{
                        marginHorizontal: 16, marginTop: -24,
                        backgroundColor: '#FFF', borderRadius: 28,
                        overflow: 'hidden',
                        shadowColor: BRAND.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.1, shadowRadius: 20, elevation: 6,
                        marginBottom: 16,
                        marginTop: -15,
                    }}
                >
                    {/* Top accent stripe */}
                    <View style={{ height: 4, backgroundColor: BRAND.primary }} />

                    <View style={{ padding: 20 }}>

                        {/* ── PRICE + LABEL ROW ─────────────── */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: BRAND.primaryFaint,
                                borderWidth: 1, borderColor: BRAND.primaryMid,
                                borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
                            }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.primary, marginRight: 6 }} />
                                <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 10, letterSpacing: 1 }}>
                                    VENUE DETAILS
                                </CustomText>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 22 }}>
                                    {priceDisplay}
                                </CustomText>
                                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>
                                    per day
                                </CustomText>
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: BRAND.primary + '18', marginBottom: 16 }} />

                        {/* ── QUICK INFO CHIPS ──────────────── */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                            {/* Capacity */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: BRAND.primaryFaint,
                                borderWidth: 1, borderColor: BRAND.primaryMid,
                                borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                            }}>
                                <Ionicons name="people" size={15} color={BRAND.primary} />
                                <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13, marginLeft: 6 }}>
                                    {venue.capacity}
                                </CustomText>
                            </View>

                            {/* Location chip — Clickable to open Native Maps */}
                            {venue.location ? (
                                <TouchableOpacity
                                    onPress={handleOpenMaps}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: BRAND.primaryFaint,
                                        borderWidth: 1, borderColor: BRAND.primaryMid,
                                        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                                        flex: 1,
                                    }}
                                >
                                    <Ionicons name="location" size={15} color={BRAND.primary} />
                                    <CustomText
                                        fontFamily="semibold"
                                        style={{ color: BRAND.primary, fontSize: 13, marginLeft: 6, flex: 1 }}
                                        numberOfLines={1}
                                    >
                                        {venue.location}
                                    </CustomText>
                                    <Ionicons name="open-outline" size={12} color={BRAND.primary + '88'} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* ── DESCRIPTION CARD ─────────────────────── */}
                <View
                    style={{
                        marginHorizontal: 16, marginBottom: 16,
                        backgroundColor: '#FFF', borderRadius: 24,
                        overflow: 'hidden',
                        shadowColor: '#64748B',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
                    }}
                >
                    <View style={{ height: 4, backgroundColor: BRAND.primaryMid }} />
                    <View style={{ padding: 20 }}>
                        {/* Section heading */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{
                                width: 32, height: 32, borderRadius: 10,
                                backgroundColor: BRAND.primaryMid,
                                alignItems: 'center', justifyContent: 'center',
                                marginRight: 10,
                            }}>
                                <Ionicons name="document-text-outline" size={16} color={BRAND.primary} />
                            </View>
                            <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 16 }}>
                                About this Venue
                            </CustomText>
                        </View>
                        <CustomText
                            fontFamily="medium"
                            style={{ color: '#475569', fontSize: 14, lineHeight: 22 }}
                        >
                            {venue.description || 'No description provided.'}
                        </CustomText>
                    </View>
                </View>

                {/* ── AMENITIES CARD ───────────────────────── */}
                {venue.amenities && venue.amenities.length > 0 && (
                    <View
                        style={{
                            marginHorizontal: 16, marginBottom: 16,
                            backgroundColor: '#FFF', borderRadius: 24,
                            overflow: 'hidden',
                            shadowColor: '#64748B',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
                        }}
                    >
                        <View style={{ height: 4, backgroundColor: BRAND.primaryMid }} />
                        <View style={{ padding: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <View style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    backgroundColor: BRAND.primaryMid,
                                    alignItems: 'center', justifyContent: 'center',
                                    marginRight: 10,
                                }}>
                                    <Ionicons name="checkmark-circle-outline" size={16} color={BRAND.primary} />
                                </View>
                                <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 16 }}>
                                    What's Included
                                </CustomText>
                            </View>

                            {venue.amenities.map((amenity, i) => (
                                <View
                                    key={i}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        paddingVertical: 10,
                                        borderBottomWidth: i < venue.amenities.length - 1 ? 1 : 0,
                                        borderBottomColor: '#F1F5F9',
                                    }}
                                >
                                    <View style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        backgroundColor: BRAND.primaryFaint,
                                        alignItems: 'center', justifyContent: 'center',
                                        marginRight: 12,
                                    }}>
                                        <Ionicons name="sparkles-outline" size={15} color={BRAND.primary} />
                                    </View>
                                    <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 14, flex: 1 }}>
                                        {amenity}
                                    </CustomText>
                                    <Ionicons name="checkmark-circle" size={18} color={BRAND.primary} />
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── CONTACT CARD ─────────────────────────── */}
                {(venue.contact?.phone || venue.contact?.facebook || venue.contact?.instagram) && (
                    <View
                        style={{
                            marginHorizontal: 16, marginBottom: 16,
                            backgroundColor: '#FFF', borderRadius: 24,
                            overflow: 'hidden',
                            shadowColor: '#64748B',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
                        }}
                    >
                        <View style={{ height: 4, backgroundColor: BRAND.primaryMid }} />
                        <View style={{ padding: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                <View style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    backgroundColor: BRAND.primaryMid,
                                    alignItems: 'center', justifyContent: 'center',
                                    marginRight: 10,
                                }}>
                                    <Ionicons name="call-outline" size={16} color={BRAND.primary} />
                                </View>
                                <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 16 }}>
                                    Contact & Socials
                                </CustomText>
                            </View>

                            {venue.contact?.phone ? (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL(`tel:${venue.contact.phone}`)}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        paddingVertical: 10,
                                        borderBottomWidth: (venue.contact?.facebook || venue.contact?.instagram) ? 1 : 0,
                                        borderBottomColor: '#F1F5F9',
                                    }}
                                >
                                    <View style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        backgroundColor: BRAND.primaryFaint,
                                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    }}>
                                        <Ionicons name="call" size={15} color={BRAND.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>Phone</CustomText>
                                        <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 14 }}>{venue.contact.phone}</CustomText>
                                    </View>
                                    <Ionicons name="open-outline" size={14} color={BRAND.primary + '88'} />
                                </TouchableOpacity>
                            ) : null}

                            {venue.contact?.facebook ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        const url = venue.contact.facebook.startsWith('http')
                                            ? venue.contact.facebook
                                            : `https://facebook.com/${venue.contact.facebook}`;
                                        Linking.openURL(url);
                                    }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        paddingVertical: 10,
                                        borderBottomWidth: venue.contact?.instagram ? 1 : 0,
                                        borderBottomColor: '#F1F5F9',
                                    }}
                                >
                                    <View style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        backgroundColor: '#EFF6FF',
                                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    }}>
                                        <Ionicons name="logo-facebook" size={16} color="#3B82F6" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>Facebook</CustomText>
                                        <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 14 }} numberOfLines={1}>
                                            {venue.contact.facebook}
                                        </CustomText>
                                    </View>
                                    <Ionicons name="open-outline" size={14} color="#3B82F6AA" />
                                </TouchableOpacity>
                            ) : null}

                            {venue.contact?.instagram ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        const handle = venue.contact.instagram.replace('@', '');
                                        Linking.openURL(`https://instagram.com/${handle}`);
                                    }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        paddingVertical: 10,
                                    }}
                                >
                                    <View style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        backgroundColor: '#FDF2F8',
                                        alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                    }}>
                                        <Ionicons name="logo-instagram" size={16} color="#EC4899" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>Instagram</CustomText>
                                        <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 14 }} numberOfLines={1}>
                                            {venue.contact.instagram.startsWith('@') ? venue.contact.instagram : `@${venue.contact.instagram}`}
                                        </CustomText>
                                    </View>
                                    <Ionicons name="open-outline" size={14} color="#EC4899AA" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                )}

                {/* Bottom spacer for the sticky footer */}
                <View style={{ height: 110 }} />
            </Animated.ScrollView>

            {/* ── STICKY FOOTER CTA ────────────────────────── */}
            <View
                style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: '#F0F4F8',
                    borderTopWidth: 1, borderTopColor: '#E8EEF4',
                    paddingTop: 12, paddingHorizontal: 20, paddingBottom: 28,
                }}
            >
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {/* Map shortcut */}
                    {(hasCoordinates || venue.location) && (
                        <TouchableOpacity
                            onPress={handleOpenMaps}
                            style={{
                                width: 52, height: 52, borderRadius: 16,
                                backgroundColor: BRAND.primaryMid,
                                borderWidth: 1.5, borderColor: BRAND.primaryBg,
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Ionicons name="map-outline" size={22} color={BRAND.primary} />
                        </TouchableOpacity>
                    )}

                    {/* AR CTA (Replaces Booking Button) */}
                    {venue.hasAR ? (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('ARVenue', {
                                venueId:   venue.id,
                                venueName: venue.name,
                                modelUrl:  venue.modelUrl,
                                price:     venue.price,
                                capacity:  venue.capacity,
                                location:  venue.location,
                            })}
                            style={{
                                flex: 1, height: 52, borderRadius: 16,
                                backgroundColor: BRAND.primary,
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                shadowColor: BRAND.primaryDark,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
                            }}
                            activeOpacity={0.88}
                        >
                            <Ionicons name="cube" size={20} color="#FFF" />
                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 15, marginLeft: 8 }}>
                                Launch AR Tour
                            </CustomText>
                            <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    ) : (
                        <View
                            style={{
                                flex: 1, height: 52, borderRadius: 16,
                                backgroundColor: '#E2E8F0', // Disabled grey state
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: '#CBD5E1',
                            }}
                        >
                            <Ionicons name="cube-outline" size={20} color="#94A3B8" />
                            <CustomText fontFamily="bold" style={{ color: '#94A3B8', fontSize: 15, marginLeft: 8 }}>
                                AR Not Available
                            </CustomText>
                        </View>
                    )}

                </View>
            </View>
        </View>
    );
}