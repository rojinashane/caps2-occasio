import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Modal,
    TouchableWithoutFeedback,
    Linking,
    Animated,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

// ── SOURCE BADGE COLOURS ──────────────────────────────────────
const SOURCE_META = {
    admin:     { label: 'Official',  color: '#00686F', bg: '#E0F2F3' },
    community: { label: 'Community', color: '#7C3AED', bg: '#EDE9FE' },
};
import CustomText from '../components/CustomText';
import tw from 'twrnc';

// ── BRAND PALETTE (matches DashboardScreen) ─────────────────
const BRAND = {
    primary:     '#00686F',
    primaryDark: '#004E54',
    primaryBg:   '#E8F5F5',
    primaryMid:  '#E0F2F3',
    primaryFaint:'#F0F9FA',
};

const CATEGORY_ICONS = {
    'All':                  'grid-outline',
    'Unassigned':           'help-circle-outline',
    'Attire & Accessories': 'shirt-outline',
    'Beauty':               'sparkles-outline',
    'Music & Show':         'musical-notes-outline',
    'Photo & Video':        'camera-outline',
    'Accessories':          'diamond-outline',
    'Flower & Decor':       'flower-outline',
    'Catering':            'restaurant-outline',
};

const CATEGORIES = [
    'All',
    'Unassigned',
    'Attire & Accessories',
    'Beauty',
    'Music & Show',
    'Photo & Video',
    'Accessories',
    'Flower & Decor',
    'Catering',
];

// ── VENDOR CARD ─────────────────────────────────────────────
const VendorCard = ({ item, onPress, index }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                delay: index * 40,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 60,
                friction: 10,
                delay: index * 40,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const iconName  = CATEGORY_ICONS[item.category] || 'business-outline';
    const srcMeta   = SOURCE_META[item._source] || SOURCE_META.admin;

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={[
                    tw`bg-white rounded-[20px] mb-3 overflow-hidden flex-row items-center`,
                    {
                        shadowColor: BRAND.primary,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.08,
                        shadowRadius: 10,
                        elevation: 3,
                    },
                ]}
            >
                {/* Left accent bar */}
                <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: BRAND.primary + '60' }} />

                {/* Icon badge */}
                <View style={[
                    tw`w-12 h-12 rounded-2xl items-center justify-center ml-4 my-4`,
                    { backgroundColor: BRAND.primaryMid },
                ]}>
                    <Ionicons name={iconName} size={22} color={BRAND.primary} />
                </View>

                {/* Text */}
                <View style={tw`flex-1 px-4 py-4`}>
                    <CustomText
                        fontFamily="bold"
                        style={{ color: '#0F172A', fontSize: 15, marginBottom: 2 }}
                        numberOfLines={1}
                    >
                        {item.name}
                    </CustomText>
                    <View style={tw`flex-row items-center flex-wrap gap-1`}>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`w-1.5 h-1.5 rounded-full mr-1.5`, { backgroundColor: BRAND.primary }]} />
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12 }}>
                                {item.category || 'Vendor'}
                            </CustomText>
                        </View>
                        <View style={[tw`px-2 py-0.5 rounded-full ml-1`, { backgroundColor: srcMeta.bg }]}>
                            <CustomText fontFamily="bold" style={{ color: srcMeta.color, fontSize: 9, letterSpacing: 0.4 }}>
                                {srcMeta.label}
                            </CustomText>
                        </View>
                    </View>
                </View>

                {/* Right arrow */}
                <View style={[tw`w-8 h-8 rounded-full items-center justify-center mr-4`, { backgroundColor: BRAND.primaryFaint }]}>
                    <Ionicons name="chevron-forward" size={14} color={BRAND.primary} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ── DETAIL ROW ───────────────────────────────────────────────
const DetailRow = ({ iconName, iconSet = 'Ionicons', value, label, onPress, isLast }) => {
    const hasValue = !!value;
    const IconComponent = iconSet === 'FontAwesome' ? FontAwesome : Ionicons;
    const iconColor = hasValue ? BRAND.primary : '#CBD5E1';
    const content = (
        <View style={[
            tw`flex-row items-center px-5 py-4`,
            !isLast && { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
        ]}>
            <View style={[
                tw`w-10 h-10 rounded-2xl items-center justify-center mr-4`,
                { backgroundColor: hasValue ? BRAND.primaryMid : '#F8FAFC' },
            ]}>
                <IconComponent name={iconName} size={iconSet === 'FontAwesome' ? 18 : 18} color={iconColor} />
            </View>
            <View style={tw`flex-1`}>
                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginBottom: 1 }}>
                    {label}
                </CustomText>
                <CustomText
                    fontFamily={hasValue ? 'semibold' : 'medium'}
                    style={{ color: hasValue ? '#334155' : '#CBD5E1', fontSize: 14 }}
                    numberOfLines={1}
                >
                    {value || 'Not available'}
                </CustomText>
            </View>
            {hasValue && onPress && (
                <Ionicons name="arrow-forward-circle" size={20} color={BRAND.primary + '80'} />
            )}
        </View>
    );

    if (hasValue && onPress) {
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
                {content}
            </TouchableOpacity>
        );
    }
    return content;
};

// ── EMPTY STATE ──────────────────────────────────────────────
const EmptyState = ({ search, activeTab }) => (
    <View style={tw`flex-1 items-center justify-center pt-24 px-8`}>
        <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-4`, { backgroundColor: BRAND.primaryMid }]}>
            <Ionicons name="search-outline" size={36} color={BRAND.primary} />
        </View>
        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17, textAlign: 'center', marginBottom: 6 }}>
            No vendors found
        </CustomText>
        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
            {search
                ? `No results for "${search}"`
                : `No vendors in "${activeTab}" yet`}
        </CustomText>
    </View>
);

// ── SCREEN ───────────────────────────────────────────────────
export default function VendorScreen({ navigation }) {
    const [vendors, setVendors]               = useState([]);
    const [filteredVendors, setFilteredVendors] = useState([]);
    const [loading, setLoading]               = useState(true);
    const [search, setSearch]                 = useState('');
    const [activeTab, setActiveTab]           = useState('All');
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [modalVisible, setModalVisible]     = useState(false);
    const [searchFocused, setSearchFocused]   = useState(false);

    const listRef    = useRef(null);
    const modalSlide = useRef(new Animated.Value(400)).current;
    const modalFade  = useRef(new Animated.Value(0)).current;

    // ── FIREBASE — merge vendors + community_vendors ──────────────────────────
    useEffect(() => {
        let officialData   = [];
        let communityData  = [];
        let officialReady  = false;
        let communityReady = false;

        const merge = () => {
            if (!officialReady || !communityReady) return;

            // Deduplicate: if a community vendor shares a nameLower with an official
            // vendor, skip the community copy (official entry wins).
            const officialNamesLower = new Set(
                officialData.map(v => (v.nameLower || v.name?.toLowerCase() || ''))
            );

            const uniqueCommunity = communityData.filter(
                v => !officialNamesLower.has(v.nameLower || v.name?.toLowerCase() || '')
            );

            // Tag source so the card can show a badge
            const tagged = [
                ...officialData.map(v  => ({ ...v,  _source: 'admin'     })),
                ...uniqueCommunity.map(v => ({ ...v, _source: 'community' })),
            ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setVendors(tagged);
            setFilteredVendors(tagged);
            setLoading(false);
        };

        const qOfficial = query(collection(db, 'vendors'), orderBy('name', 'asc'));
        const unsubOfficial = onSnapshot(qOfficial, (snap) => {
            officialData  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            officialReady = true;
            merge();
        }, (err) => { console.warn('vendors snapshot error:', err); setLoading(false); });

        const qCommunity = query(collection(db, 'community_vendors'), orderBy('name', 'asc'));
        const unsubCommunity = onSnapshot(qCommunity, (snap) => {
            communityData  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            communityReady = true;
            merge();
        }, (err) => { console.warn('community_vendors snapshot error:', err); });

        return () => { unsubOfficial(); unsubCommunity(); };
    }, []);

    // ── FILTER ──
    useEffect(() => {
        let result = vendors;
        if (activeTab !== 'All') result = result.filter(v => v.category === activeTab);
        if (search) {
            const term = search.toLowerCase();
            result = result.filter(v =>
                v.name?.toLowerCase().includes(term) ||
                v.category?.toLowerCase().includes(term)
            );
        }
        setFilteredVendors(result);
        if (listRef.current && result.length > 0) {
            listRef.current.scrollToOffset({ offset: 0, animated: true });
        }
    }, [search, activeTab, vendors]);

    // ── MODAL ANIMATION ──
    const openModal = (vendor) => {
        setSelectedVendor(vendor);
        setModalVisible(true);
        Animated.parallel([
            Animated.timing(modalFade,  { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.spring(modalSlide, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        ]).start();
    };

    const closeModal = () => {
        Animated.parallel([
            Animated.timing(modalFade,  { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(modalSlide, { toValue: 400, duration: 220, useNativeDriver: true }),
        ]).start(() => setModalVisible(false));
    };

    const openFacebook = (url) => {
        if (!url) return;
        Linking.openURL(url).catch(() => alert("Couldn't open Facebook link"));
    };

    const callVendor = (phone) => {
        if (!phone) return;
        Linking.openURL(`tel:${phone}`);
    };

    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: '#F4F7FA' }]} edges={['top']}>

            {/* ── HEADER ── */}
            <View style={[
                tw`px-5 pt-3 pb-4`,
                { backgroundColor: '#F4F7FA', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
            ]}>
                <View style={tw`flex-row items-center justify-between mb-1`}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={[
                            tw`w-10 h-10 rounded-full items-center justify-center`,
                            { backgroundColor: BRAND.primaryMid, borderWidth: 1, borderColor: BRAND.primary + '30' },
                        ]}
                    >
                        <Ionicons name="chevron-back" size={20} color={BRAND.primary} />
                    </TouchableOpacity>

                    <View style={tw`items-center`}>
                        <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 11, letterSpacing: 1.5 }}>
                            OCCASIO
                        </CustomText>
                        <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 18 }}>
                            Vendor Directory
                        </CustomText>
                    </View>

                    {/* Count badge */}
                    <View style={[tw`px-3 py-1 rounded-full`, { backgroundColor: BRAND.primaryMid }]}>
                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 13 }}>
                            {filteredVendors.length}
                        </CustomText>
                    </View>
                </View>
            </View>

            {/* ── SEARCH ── */}
            <View style={tw`px-5 mt-4 mb-3`}>
                <View style={[
                    tw`flex-row items-center rounded-[16px] px-4 py-3 bg-white`,
                    {
                        shadowColor: searchFocused ? BRAND.primary : '#64748B',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: searchFocused ? 0.14 : 0.06,
                        shadowRadius: 10,
                        elevation: 3,
                        borderWidth: 1.5,
                        borderColor: searchFocused ? BRAND.primary + '40' : 'transparent',
                    },
                ]}>
                    <Ionicons name="search-outline" size={18} color={searchFocused ? BRAND.primary : '#94A3B8'} />
                    <TextInput
                        placeholder="Search vendors, categories..."
                        placeholderTextColor="#CBD5E1"
                        style={[tw`flex-1 ml-3`, { fontFamily: 'Poppins-Medium', fontSize: 14, color: '#0F172A' }]}
                        value={search}
                        onChangeText={setSearch}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── CATEGORY TABS ── */}
            <View style={tw`mb-4`}>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={CATEGORIES}
                    keyExtractor={item => item}
                    contentContainerStyle={tw`px-5`}
                    renderItem={({ item }) => {
                        const isActive = activeTab === item;
                        const icon = CATEGORY_ICONS[item] || 'grid-outline';
                        return (
                            <TouchableOpacity
                                onPress={() => setActiveTab(item)}
                                activeOpacity={0.75}
                                style={[
                                    tw`flex-row items-center px-4 py-2 rounded-[14px] mr-2`,
                                    isActive
                                        ? {
                                            backgroundColor: BRAND.primary,
                                            shadowColor: BRAND.primaryDark,
                                            shadowOffset: { width: 0, height: 3 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 6,
                                            elevation: 4,
                                        }
                                        : { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8EEF4' },
                                ]}
                            >
                                <Ionicons
                                    name={icon}
                                    size={13}
                                    color={isActive ? '#FFFFFF' : '#94A3B8'}
                                    style={{ marginRight: 5 }}
                                />
                                <CustomText
                                    fontFamily="semibold"
                                    style={{ fontSize: 13, color: isActive ? '#FFFFFF' : '#64748B' }}
                                >
                                    {item}
                                </CustomText>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {/* ── SECTION LABEL ── */}
            {!loading && filteredVendors.length > 0 && (
                <View style={tw`px-5 mb-2 flex-row items-center`}>
                    <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 11, letterSpacing: 0.8 }}>
                        {filteredVendors.length} VENDOR{filteredVendors.length !== 1 ? 'S' : ''}
                    </CustomText>
                </View>
            )}

            {/* ── LIST ── */}
            {loading ? (
                <View style={tw`flex-1 items-center justify-center`}>
                    <ActivityIndicator size="large" color={BRAND.primary} />
                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, marginTop: 12 }}>
                        Loading vendors...
                    </CustomText>
                </View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={filteredVendors}
                    keyExtractor={item => item.id}
                    renderItem={({ item, index }) => (
                        <VendorCard
                            item={item}
                            index={index}
                            onPress={() => openModal(item)}
                        />
                    )}
                    contentContainerStyle={[tw`px-5 pb-28`, filteredVendors.length === 0 && tw`flex-1`]}
                    ListEmptyComponent={<EmptyState search={search} activeTab={activeTab} />}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* ── VENDOR DETAIL MODAL ── */}
            <Modal
                animationType="none"
                transparent
                visible={modalVisible}
                onRequestClose={closeModal}
                statusBarTranslucent
            >
                <TouchableWithoutFeedback onPress={closeModal}>
                    <Animated.View style={[tw`flex-1 justify-end`, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: modalFade }]}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    tw`bg-white rounded-t-[36px]`,
                                    {
                                        transform: [{ translateY: modalSlide }],
                                        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: -8 },
                                        shadowOpacity: 0.12,
                                        shadowRadius: 24,
                                        elevation: 24,
                                    },
                                ]}
                            >
                                {/* Drag handle */}
                                <View style={tw`items-center pt-4 pb-2`}>
                                    <View style={[tw`w-10 h-1 rounded-full`, { backgroundColor: '#E2E8F0' }]} />
                                </View>

                                {/* Vendor identity */}
                                <View style={[tw`mx-5 mt-3 mb-5 p-5 rounded-[24px]`, { backgroundColor: BRAND.primaryFaint }]}>
                                    <View style={tw`flex-row items-center`}>
                                        <View style={[tw`w-14 h-14 rounded-2xl items-center justify-center mr-4`, { backgroundColor: BRAND.primaryMid }]}>
                                            <Ionicons
                                                name={CATEGORY_ICONS[selectedVendor?.category] || 'business-outline'}
                                                size={26}
                                                color={BRAND.primary}
                                            />
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 20, lineHeight: 24 }} numberOfLines={2}>
                                                {selectedVendor?.name || '—'}
                                            </CustomText>
                                            <View style={[tw`flex-row items-center mt-1 self-start px-2.5 py-0.5 rounded-full`, { backgroundColor: BRAND.primaryMid }]}>
                                                <View style={[tw`w-1.5 h-1.5 rounded-full mr-1.5`, { backgroundColor: BRAND.primary }]} />
                                                <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 11 }}>
                                                    {selectedVendor?.category || 'Vendor'}
                                                </CustomText>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Contact details card */}
                                <View style={[tw`mx-5 mb-5 rounded-[24px] bg-white overflow-hidden`, {
                                    borderWidth: 1,
                                    borderColor: '#F1F5F9',
                                    shadowColor: '#64748B',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 8,
                                    elevation: 2,
                                }]}>
                                    <DetailRow
                                        iconName="call"
                                        label="Phone"
                                        value={selectedVendor?.phone}
                                        onPress={() => callVendor(selectedVendor?.phone)}
                                    />
                                    <DetailRow
                                        iconName="location"
                                        label="Location"
                                        value={selectedVendor?.location}
                                    />
                                    <DetailRow
                                        iconName="facebook-square"
                                        iconSet="FontAwesome"
                                        label="Facebook"
                                        value={selectedVendor?.facebook ? 'Visit Facebook Page' : null}
                                        onPress={() => openFacebook(selectedVendor?.facebook)}
                                        isLast
                                    />
                                </View>

                                {/* Close button */}
                                <TouchableOpacity
                                    onPress={closeModal}
                                    activeOpacity={0.8}
                                    style={[
                                        tw`mx-5 py-4 rounded-[16px] items-center`,
                                        { backgroundColor: BRAND.primaryMid, borderWidth: 1, borderColor: BRAND.primary + '30' },
                                    ]}
                                >
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 15 }}>
                                        Close
                                    </CustomText>
                                </TouchableOpacity>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}