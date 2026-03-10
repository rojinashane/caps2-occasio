import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    StatusBar,
    Linking,
    Platform,
    ActivityIndicator,
    Dimensions,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

const { width } = Dimensions.get('window');

const BRAND = {
    primary:      '#00686F',
    primaryDark:  '#004E54',
    primaryBg:    '#E8F5F5',
    primaryMid:   '#E0F2F3',
    primaryFaint: '#F0F9FA',
};

const FILTERS = ['All', 'AR Ready', 'No AR'];

export default function VenuesScreen({ navigation }) {
    const [searchQuery, setSearchQuery]   = useState('');
    const [venues, setVenues]             = useState([]);
    const [allVenues, setAllVenues]       = useState([]);
    const [loading, setLoading]           = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');

    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const headerAnim = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        const q = query(collection(db, 'venues'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const venueList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVenues(venueList);
            setAllVenues(venueList);
            setLoading(false);
            Animated.parallel([
                Animated.timing(fadeAnim,   { toValue: 1, duration: 420, useNativeDriver: true }),
                Animated.spring(headerAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
            ]).start();
        }, () => setLoading(false));
        return () => unsubscribe();
    }, []);

    const openInGoogleMaps = (item) => {
        if (!item.coordinates) return;
        const { latitude, longitude } = item.coordinates;
        const url = Platform.select({
            ios:     `maps:0,0?q=${item.name}@${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${item.name})`,
        });
        Linking.openURL(url);
    };

    const applyFilters = (text, filter) => {
        let result = [...allVenues];
        if (filter === 'AR Ready') result = result.filter(v => v.hasAR);
        if (filter === 'No AR')    result = result.filter(v => !v.hasAR);
        if (text.trim()) {
            result = result.filter(v =>
                v.name?.toLowerCase().includes(text.toLowerCase()) ||
                v.location?.toLowerCase().includes(text.toLowerCase())
            );
        }
        setVenues(result);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        applyFilters(text, activeFilter);
    };

    const handleFilter = (filter) => {
        setActiveFilter(filter);
        applyFilters(searchQuery, filter);
    };

    // ── VENUE CARD ────────────────────────────────────────────
    const renderVenueCard = ({ item, index }) => {
        const cardFade = new Animated.Value(0);
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => navigation.navigate('VenueDetails', { venue: item })}
                    style={{
                        backgroundColor: '#FFF',
                        borderRadius: 26,
                        marginBottom: 20,
                        overflow: 'hidden',
                        shadowColor: BRAND.primaryDark,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.1,
                        shadowRadius: 20,
                        elevation: 5,
                    }}
                >
                    {/* ── IMAGE ── */}
                    <View style={{ width: '100%', height: 210, backgroundColor: '#E2E8F0' }}>
                        {item.image ? (
                            <Image
                                source={{ uri: item.image }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="business-outline" size={48} color="#CBD5E1" />
                            </View>
                        )}

                        {/* Gradient scrim — bottom 60% */}
                        <View style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, height: 130,
                            background: 'transparent',
                        }}>
                            {/* Layered scrim using multiple views */}
                            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.01)' }} />
                            <View style={{ height: 80, backgroundColor: 'rgba(0,0,0,0.38)' }} />
                        </View>

                        {/* AR badge — top right */}
                        {item.hasAR && (
                            <View style={{
                                position: 'absolute', top: 14, right: 14,
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: BRAND.primary + 'F0',
                                borderRadius: 22, paddingHorizontal: 11, paddingVertical: 6,
                                borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                            }}>
                                <Ionicons name="cube" size={13} color="#FFF" />
                                <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 10, marginLeft: 5, letterSpacing: 0.8 }}>
                                    AR READY
                                </CustomText>
                            </View>
                        )}

                        {/* Venue name + location overlaid on image bottom */}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}>
                            <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 19, lineHeight: 24, marginBottom: 3 }} numberOfLines={1}>
                                {item.name}
                            </CustomText>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center' }}
                                onPress={(e) => { e.stopPropagation(); openInGoogleMaps(item); }}
                            >
                                <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" />
                                <CustomText fontFamily="medium" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginLeft: 4 }} numberOfLines={1}>
                                    {item.location}
                                </CustomText>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── BODY ── */}
                    <View style={{ padding: 16 }}>

                        {/* Price + capacity row */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <View>
                                <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 22 }}>
                                    {item.price ? item.price.split(' ')[0] : 'POA'}
                                </CustomText>
                                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>per day</CustomText>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    backgroundColor: BRAND.primaryFaint,
                                    borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7,
                                    borderWidth: 1, borderColor: BRAND.primaryMid,
                                }}>
                                    <Ionicons name="people" size={13} color={BRAND.primary} />
                                    <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 12, marginLeft: 5 }}>
                                        {item.capacity}
                                    </CustomText>
                                </View>
                            </View>
                        </View>

                        {/* Amenity chips preview */}
                        {item.amenities && item.amenities.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                {item.amenities.slice(0, 3).map((a, i) => (
                                    <View key={i} style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: '#F8FAFC',
                                        borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
                                        borderWidth: 1, borderColor: '#E2E8F0',
                                    }}>
                                        <Ionicons name="checkmark-circle" size={11} color={BRAND.primary} />
                                        <CustomText fontFamily="medium" style={{ color: '#475569', fontSize: 11, marginLeft: 4 }}>
                                            {a}
                                        </CustomText>
                                    </View>
                                ))}
                                {item.amenities.length > 3 && (
                                    <View style={{
                                        backgroundColor: BRAND.primaryFaint,
                                        borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
                                        borderWidth: 1, borderColor: BRAND.primaryMid,
                                    }}>
                                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 11 }}>
                                            +{item.amenities.length - 3} more
                                        </CustomText>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginBottom: 14 }} />

                        {/* Action buttons */}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={{
                                    flex: 1, paddingVertical: 13,
                                    borderRadius: 16,
                                    backgroundColor: BRAND.primaryFaint,
                                    borderWidth: 1.5, borderColor: BRAND.primaryMid,
                                    alignItems: 'center', justifyContent: 'center',
                                }}
                                onPress={() => navigation.navigate('VenueDetails', { venue: item })}
                            >
                                <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 14 }}>View Details</CustomText>
                            </TouchableOpacity>

                            {item.hasAR ? (
                                <TouchableOpacity
                                    style={{
                                        flex: 1, flexDirection: 'row', paddingVertical: 13,
                                        borderRadius: 16,
                                        backgroundColor: BRAND.primary,
                                        alignItems: 'center', justifyContent: 'center',
                                        shadowColor: BRAND.primaryDark,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
                                    }}
                                    onPress={() => navigation.navigate('ARVenue', {
                                        venueId:   item.id,
                                        venueName: item.name,
                                        modelUrl:  item.modelUrl,
                                        price:     item.price,
                                        capacity:  item.capacity,
                                        location:  item.location,
                                    })}
                                >
                                    <Ionicons name="walk" size={16} color="#FFF" />
                                    <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 14, marginLeft: 6 }}>
                                        Walk in AR
                                    </CustomText>
                                </TouchableOpacity>
                            ) : (
                                <View style={{
                                    flex: 1, paddingVertical: 13, borderRadius: 16,
                                    backgroundColor: '#F8FAFC',
                                    borderWidth: 1.5, borderColor: '#E2E8F0',
                                    borderStyle: 'dashed',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 13 }}>No AR</CustomText>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    // ── LIST HEADER ───────────────────────────────────────────
    const ListHeader = () => (
        <View style={{ marginBottom: 8 }}>
            {/* AR promo banner */}
            {allVenues.some(v => v.hasAR) && !searchQuery && activeFilter === 'All' && (
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => handleFilter('AR Ready')}
                    style={{
                        borderRadius: 22,
                        overflow: 'hidden',
                        marginBottom: 22,
                        shadowColor: BRAND.primaryDark,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.18, shadowRadius: 18, elevation: 6,
                    }}
                >
                    <View style={{ backgroundColor: BRAND.primaryDark, padding: 18 }}>
                        <View style={{ height: 3, backgroundColor: '#00868E', position: 'absolute', top: 0, left: 0, right: 0 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1, marginRight: 14 }}>
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.12)',
                                    borderRadius: 16, paddingHorizontal: 9, paddingVertical: 4,
                                    alignSelf: 'flex-start', marginBottom: 8,
                                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                                }}>
                                    <Ionicons name="cube" size={11} color="#FFF" />
                                    <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 9, marginLeft: 5, letterSpacing: 1 }}>
                                        AUGMENTED REALITY
                                    </CustomText>
                                </View>
                                <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 17, lineHeight: 22, marginBottom: 4 }}>
                                    Walk through venues
                                </CustomText>
                                <CustomText fontFamily="medium" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                                    Tap to browse AR-ready spaces →
                                </CustomText>
                            </View>
                            <View style={{
                                width: 64, height: 64, borderRadius: 20,
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
                            }}>
                                <Ionicons name="walk" size={30} color="#FFF" />
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            )}

            {/* Section label */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
                <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 17 }}>
                    {searchQuery ? `Results for "${searchQuery}"` : activeFilter === 'All' ? 'All Venues' : activeFilter}
                </CustomText>
                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12 }}>
                    {venues.length} space{venues.length !== 1 ? 's' : ''}
                </CustomText>
            </View>
            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginBottom: 14 }}>
                {searchQuery ? `${venues.length} match${venues.length !== 1 ? 'es' : ''} found` : 'Browse and explore available event spaces'}
            </CustomText>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4F8' }} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F0F4F8" />

            {/* ── HEADER ─────────────────────────────────────── */}
            <Animated.View
                style={{
                    transform: [{ translateY: headerAnim }],
                    opacity: fadeAnim,
                    paddingHorizontal: 20,
                    paddingTop: 10,
                    paddingBottom: 4,
                    backgroundColor: '#F0F4F8',
                    borderBottomWidth: 1,
                    borderBottomColor: '#E8EEF4',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={{
                            width: 40, height: 40, borderRadius: 14,
                            backgroundColor: BRAND.primaryMid,
                            alignItems: 'center', justifyContent: 'center',
                            marginRight: 12,
                            borderWidth: 1, borderColor: BRAND.primary + '28',
                        }}
                    >
                        <Ionicons name="chevron-back" size={20} color={BRAND.primary} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 10, letterSpacing: 2 }}>
                            OCCASIO
                        </CustomText>
                        <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 22, lineHeight: 26 }}>
                            Venues
                        </CustomText>
                    </View>

                    {!loading && (
                        <View style={{
                            backgroundColor: BRAND.primaryDark,
                            borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
                        }}>
                            <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 14 }}>
                                {allVenues.length}
                            </CustomText>
                        </View>
                    )}
                </View>

                {/* Search */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#FFF',
                    borderRadius: 16, paddingHorizontal: 14, height: 48,
                    borderWidth: 1, borderColor: '#E8EEF4',
                    shadowColor: '#64748B',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
                    marginBottom: 14,
                }}>
                    <Ionicons name="search" size={17} color="#94A3B8" />
                    <TextInput
                        style={{ flex: 1, marginLeft: 10, fontSize: 14, color: '#0F172A', fontFamily: 'System' }}
                        placeholder="Search venues or locations..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter tabs */}
                <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 14 }}>
                    {FILTERS.map(f => {
                        const isActive = activeFilter === f;
                        return (
                            <TouchableOpacity
                                key={f}
                                onPress={() => handleFilter(f)}
                                style={{
                                    paddingHorizontal: 16, paddingVertical: 8,
                                    borderRadius: 12,
                                    backgroundColor: isActive ? BRAND.primary : '#FFF',
                                    borderWidth: 1,
                                    borderColor: isActive ? BRAND.primary : '#E2E8F0',
                                    flexDirection: 'row', alignItems: 'center',
                                    shadowColor: isActive ? BRAND.primaryDark : 'transparent',
                                    shadowOffset: { width: 0, height: 3 },
                                    shadowOpacity: 0.2, shadowRadius: 6, elevation: isActive ? 3 : 0,
                                }}
                            >
                                {f === 'AR Ready' && (
                                    <Ionicons name="cube" size={11} color={isActive ? '#FFF' : BRAND.primary} style={{ marginRight: 5 }} />
                                )}
                                <CustomText fontFamily="bold" style={{ color: isActive ? '#FFF' : '#64748B', fontSize: 12 }}>
                                    {f}
                                </CustomText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>

            {/* ── LIST ───────────────────────────────────────── */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                        width: 56, height: 56, borderRadius: 18,
                        backgroundColor: BRAND.primaryMid,
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 12,
                    }}>
                        <ActivityIndicator size="small" color={BRAND.primary} />
                    </View>
                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13 }}>Loading venues…</CustomText>
                </View>
            ) : (
                <FlatList
                    data={venues}
                    keyExtractor={item => item.id}
                    renderItem={renderVenueCard}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={<ListHeader />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingTop: 40 }}>
                            <View style={{
                                width: 72, height: 72, borderRadius: 22,
                                backgroundColor: BRAND.primaryMid,
                                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
                            }}>
                                <Ionicons name="business-outline" size={32} color={BRAND.primary} />
                            </View>
                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 18, marginBottom: 6 }}>
                                No venues found
                            </CustomText>
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                                {searchQuery || activeFilter !== 'All'
                                    ? 'Try adjusting your search or filters.'
                                    : 'Venues added by the admin will appear here.'}
                            </CustomText>
                            {(searchQuery || activeFilter !== 'All') && (
                                <TouchableOpacity
                                    onPress={() => { handleSearch(''); handleFilter('All'); }}
                                    style={{
                                        marginTop: 16,
                                        paddingHorizontal: 20, paddingVertical: 10,
                                        backgroundColor: BRAND.primaryFaint,
                                        borderRadius: 12,
                                        borderWidth: 1, borderColor: BRAND.primaryMid,
                                    }}
                                >
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 13 }}>Clear filters</CustomText>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}