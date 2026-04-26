import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    TextInput,
    FlatList,
    ScrollView,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import CustomText from './CustomText';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BRAND = {
    primary:      '#00686F',
    primaryDark:  '#004E54',
    primaryBg:    '#E8F5F5',
    primaryMid:   '#E0F2F3',
    primaryFaint: '#F0F9FA',
};

const CATEGORY_ICONS = {
    'Unassigned':           'help-circle-outline',
    'Attire & Accessories': 'shirt-outline',
    'Beauty':               'sparkles-outline',
    'Music & Show':         'musical-notes-outline',
    'Photo & Video':        'camera-outline',
    'Accessories':          'diamond-outline',
    'Flower & Decor':       'flower-outline',
    'Catering':             'restaurant-outline',
    'Custom':               'person-outline',
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
    'Custom',
];

// Categories available for custom vendor selection (excludes 'All' and 'Unassigned')
const CUSTOM_VENDOR_CATEGORIES = [
    'Attire & Accessories',
    'Beauty',
    'Music & Show',
    'Photo & Video',
    'Accessories',
    'Flower & Decor',
    'Catering',
];

export default function VendorPicker({ visible, onClose, pinnedVendors = [], onPin, onUnpin, communityVendors = [] }) {
    const [vendorOwnerList, setVendorOwnerList] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [tab, setTab]                 = useState('browse'); // 'browse' | 'pinned' | 'custom'
    const [activeCategory, setCategory] = useState('All');

    // Custom vendor form
    const [customName, setCustomName]         = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [customPhone, setCustomPhone]       = useState('');
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [savingCustom, setSavingCustom]     = useState(false);

    const slideAnim   = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    // ── Animate in / out ──────────────────────────────────────────────────────
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim,   { toValue: 0,    tension: 60, friction: 12, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 1,   duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim,    { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 0,             duration: 220, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    // ── Load vendors from Firestore ───────────────────────────────────────────
    useEffect(() => {
        // Load venue-owner vendors from /vendors
        const q = query(collection(db, 'vendors'), orderBy('name', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setVendorOwnerList(snap.docs.map(d => ({ id: d.id, ...d.data(), fromCommunity: false })));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    const handleClose = () => {
        setSearch('');
        setCategory('All');
        setTab('browse');
        setCustomName('');
        setCustomCategory('');
        setCustomPhone('');
        setShowCategoryPicker(false);
        onClose();
    };

    const isPinned = (id) => pinnedVendors.some(v => v.id === id);

    const handleTogglePin = (vendor) => {
        if (isPinned(vendor.id)) {
            onUnpin(vendor.id);
        } else {
            onPin(vendor);
        }
    };

    const handleSaveCustom = async () => {
        if (!customName.trim()) return;
        setSavingCustom(true);
        // isCustom: true  → tells pinVendor to save to community_vendors
        // fromCommunity: false → tells pinVendor this is new (not yet in Firestore)
        const newVendor = {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            category: customCategory.trim() || 'Unassigned',
            phone: customPhone.trim() || '',
            facebook: '',
            location: '',
            isCustom: true,
            fromCommunity: false,
        };
        try {
            await onPin(newVendor); // waits for community_vendors write to finish
        } catch (e) {
            console.warn('Pin failed:', e);
        }
        setCustomName('');
        setCustomCategory('');
        setCustomPhone('');
        setShowCategoryPicker(false);
        setSavingCustom(false);
        setTab('pinned');
    };

    // ── Filtered list ─────────────────────────────────────────────────────────
    // Merge venue-owner vendors with planner-contributed community vendors.
    // Deduplicate by id so venue-owner entries mirrored to community_vendors
    // don't appear twice (community copy takes precedence since it has fromCommunity: true).
    const allVendors = [
        ...vendorOwnerList,
        ...communityVendors.filter(cv => !vendorOwnerList.some(v => v.id === cv.id)),
    ];

    const filtered = allVendors.filter(v => {
        const matchesSearch = !search ||
            v.name?.toLowerCase().includes(search.toLowerCase()) ||
            v.category?.toLowerCase().includes(search.toLowerCase()) ||
            v.location?.toLowerCase().includes(search.toLowerCase());
        const matchesCat = activeCategory === 'All' || v.category === activeCategory;
        return matchesSearch && matchesCat;
    });

    const canSaveCustom = customName.trim().length > 0;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
            {/* Backdrop */}
            <TouchableWithoutFeedback onPress={handleClose}>
                <Animated.View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15,23,42,0.55)',
                    opacity: backdropAnim,
                }} />
            </TouchableWithoutFeedback>

            {/* Sheet Container */}
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
                <Animated.View style={{
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: '#F0F4F8',
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    height: SCREEN_HEIGHT * 0.90,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                    elevation: 20,
                    flexDirection: 'column',
                }}>
                    {/* ── FIXED HEADER — always visible, never pushed by keyboard ── */}
                    <View>
                    {/* Top accent stripe */}
                    <View style={{ height: 4, backgroundColor: BRAND.primary }} />

                    {/* Drag handle */}
                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                    </View>

                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
                        <View>
                            <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 11, letterSpacing: 1.5 }}>
                                OCCASIO
                            </CustomText>
                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 20 }}>
                                Vendor Directory
                            </CustomText>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BRAND.primary + '30' }}
                        >
                            <Ionicons name="close" size={18} color={BRAND.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Tab switcher */}
                    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: '#E2E8F0', borderRadius: 16, padding: 4 }}>
                        {[
                            { key: 'browse', icon: 'storefront-outline', label: 'Browse' },
                            { key: 'pinned', icon: 'pin-outline',         label: `Pinned${pinnedVendors.length > 0 ? ` (${pinnedVendors.length})` : ''}` },
                            { key: 'custom', icon: 'create-outline',      label: 'Custom' },
                        ].map(t => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setTab(t.key)}
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingVertical: 9, borderRadius: 12,
                                    backgroundColor: tab === t.key ? '#FFF' : 'transparent',
                                    shadowColor: tab === t.key ? '#94A3B8' : 'transparent',
                                    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
                                    elevation: tab === t.key ? 2 : 0,
                                }}
                            >
                                <Ionicons name={t.icon} size={13} color={tab === t.key ? BRAND.primary : '#94A3B8'} style={{ marginRight: 4 }} />
                                <CustomText fontFamily={tab === t.key ? 'bold' : 'semibold'} style={{ color: tab === t.key ? BRAND.primary : '#94A3B8', fontSize: 12 }}>
                                    {t.label}
                                </CustomText>
                            </TouchableOpacity>
                        ))}
                    </View>

                    </View>{/* end fixed header */}

                    {/* TAB CONTENT — flex:1 fills remaining space below the fixed header */}
                    <View style={{ flex: 1 }}>
                        {/* ── BROWSE TAB ──────────────────────────────────────────── */}
                        {tab === 'browse' && (
                            <View style={{ flex: 1 }}>
                                {/* Search bar */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 10, borderRadius: 14, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: '#E8EEF4' }}>
                                    <Ionicons name="search" size={16} color="#94A3B8" />
                                    <TextInput
                                        style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0F172A' }}
                                        placeholder="Search vendors..."
                                        placeholderTextColor="#94A3B8"
                                        value={search}
                                        onChangeText={setSearch}
                                    />
                                    {search.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearch('')}>
                                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Category filter chips — scrollable inline style */}
                                <View>
                                    <ScrollView 
                                        horizontal 
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={{ 
                                            paddingHorizontal: 20, 
                                            paddingBottom: 8, 
                                            gap: 6 
                                        }}
                                    >
                                        {CATEGORIES.map((item) => {
                                            const active = activeCategory === item;
                                            return (
                                                <TouchableOpacity
                                                    key={item} 
                                                    onPress={() => setCategory(item)}
                                                    style={{
                                                        flexDirection: 'row', alignItems: 'center',
                                                        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100,
                                                        backgroundColor: active ? BRAND.primary : '#F1F5F9',
                                                        borderWidth: 1, borderColor: active ? BRAND.primary : '#E2E8F0',
                                                    }}
                                                >
                                                    <Ionicons 
                                                        name={CATEGORY_ICONS[item] || 'grid-outline'} 
                                                        size={10} 
                                                        color={active ? '#FFF' : '#94A3B8'} 
                                                        style={{ marginRight: 4 }} 
                                                    />
                                                    <CustomText 
                                                        fontFamily="semibold" 
                                                        style={{ color: active ? '#FFF' : '#64748B', fontSize: 10 }}
                                                    >
                                                        {item}
                                                    </CustomText>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                {/* Vendor list */}
                                {loading ? (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                        <ActivityIndicator color={BRAND.primary} />
                                    </View>
                                ) : (
                                    <FlatList
                                        data={filtered}
                                        keyExtractor={item => item.id}
                                        style={{ flex: 1 }}
                                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, flexGrow: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                        ListEmptyComponent={
                                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
                                                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                                    <Ionicons name="search-outline" size={24} color={BRAND.primary} />
                                                </View>
                                                <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 15, marginBottom: 4 }}>No vendors found</CustomText>
                                                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                                                    Try the Custom tab to add your own.
                                                </CustomText>
                                            </View>
                                        }
                                        renderItem={({ item }) => {
                                            const pinned = isPinned(item.id);
                                            const iconName = CATEGORY_ICONS[item.category] || 'storefront-outline';
                                            return (
                                                <TouchableOpacity
                                                    onPress={() => handleTogglePin(item)}
                                                    activeOpacity={0.85}
                                                    style={{
                                                        backgroundColor: '#FFF',
                                                        borderRadius: 20, marginBottom: 10,
                                                        overflow: 'hidden',
                                                        borderWidth: pinned ? 2 : 1,
                                                        borderColor: pinned ? BRAND.primary : '#E8EEF4',
                                                        shadowColor: pinned ? BRAND.primary : '#94A3B8',
                                                        shadowOffset: { width: 0, height: pinned ? 5 : 2 },
                                                        shadowOpacity: pinned ? 0.15 : 0.06,
                                                        shadowRadius: pinned ? 10 : 6,
                                                        elevation: pinned ? 5 : 2,
                                                    }}
                                                >
                                                    <View style={{ height: 3, backgroundColor: pinned ? BRAND.primary : '#E2E8F0' }} />
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                                                        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: pinned ? BRAND.primaryMid : '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                            <Ionicons name={iconName} size={24} color={pinned ? BRAND.primary : '#94A3B8'} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 14, marginBottom: 3 }} numberOfLines={1}>
                                                                {item.name}
                                                            </CustomText>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                                                <View style={{ backgroundColor: pinned ? BRAND.primaryFaint : '#F1F5F9', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: pinned ? BRAND.primaryMid : '#E8EEF4' }}>
                                                                    <CustomText fontFamily="bold" style={{ color: pinned ? BRAND.primary : '#64748B', fontSize: 10 }}>
                                                                        {item.category || 'Vendor'}
                                                                    </CustomText>
                                                                </View>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                                                {item.location ? (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                        <Ionicons name="location" size={11} color={BRAND.primary} />
                                                                        <CustomText fontFamily="medium" style={{ color: '#64748B', fontSize: 11, marginLeft: 3 }} numberOfLines={1}>
                                                                            {item.location}
                                                                        </CustomText>
                                                                    </View>
                                                                ) : null}
                                                                {item.phone ? (
                                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                        <Ionicons name="call" size={11} color="#94A3B8" />
                                                                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginLeft: 3 }}>
                                                                            {item.phone}
                                                                        </CustomText>
                                                                    </View>
                                                                ) : null}
                                                            </View>
                                                        </View>
                                                        <View style={{
                                                            width: 36, height: 36, borderRadius: 18,
                                                            backgroundColor: pinned ? BRAND.primary : BRAND.primaryFaint,
                                                            alignItems: 'center', justifyContent: 'center',
                                                            borderWidth: pinned ? 0 : 1, borderColor: BRAND.primaryMid,
                                                            marginLeft: 8,
                                                        }}>
                                                            <Ionicons name={pinned ? 'checkmark' : 'add'} size={18} color={pinned ? '#FFF' : BRAND.primary} />
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        }}
                                    />
                                )}
                            </View>
                        )}

                        {/* ── PINNED TAB ──────────────────────────────────────────── */}
                        {tab === 'pinned' && (
                            <View style={{ flex: 1, justifyContent: 'space-between' }}>
                                <FlatList
                                    data={pinnedVendors}
                                    keyExtractor={item => item.id}
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 }}
                                    showsVerticalScrollIndicator={false}
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                                            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                                <Ionicons name="pin-outline" size={28} color={BRAND.primary} />
                                            </View>
                                            <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 15, marginBottom: 6 }}>
                                                No vendors pinned yet
                                            </CustomText>
                                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                                                Browse the directory or add a custom vendor.
                                            </CustomText>
                                            <TouchableOpacity
                                                onPress={() => setTab('browse')}
                                                style={{ marginTop: 16, backgroundColor: BRAND.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16 }}
                                            >
                                                <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 13 }}>Browse Vendors</CustomText>
                                            </TouchableOpacity>
                                        </View>
                                    }
                                    renderItem={({ item }) => {
                                        const iconName = CATEGORY_ICONS[item.category] || 'storefront-outline';
                                        return (
                                            <View style={{
                                                backgroundColor: '#FFF', borderRadius: 20, marginBottom: 10,
                                                borderWidth: 2, borderColor: BRAND.primaryMid,
                                                overflow: 'hidden',
                                                shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 3 },
                                                shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
                                            }}>
                                                <View style={{ height: 3, backgroundColor: BRAND.primary }} />
                                                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                                                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                        <Ionicons name={iconName} size={22} color={BRAND.primary} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 14 }} numberOfLines={1}>
                                                                {item.name}
                                                            </CustomText>
                                                            {item.isCustom && (
                                                                <View style={{ backgroundColor: '#FFF7ED', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FED7AA' }}>
                                                                    <CustomText fontFamily="bold" style={{ color: '#F97316', fontSize: 9 }}>CUSTOM</CustomText>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                            <View style={{ backgroundColor: BRAND.primaryFaint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: BRAND.primaryMid }}>
                                                                <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 10 }}>
                                                                    {item.category || 'Vendor'}
                                                                </CustomText>
                                                            </View>
                                                            {item.phone ? (
                                                                <TouchableOpacity
                                                                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                                                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                                                >
                                                                    <Ionicons name="call" size={11} color={BRAND.primary} />
                                                                    <CustomText fontFamily="medium" style={{ color: BRAND.primary, fontSize: 11, marginLeft: 3 }}>
                                                                        {item.phone}
                                                                    </CustomText>
                                                                </TouchableOpacity>
                                                            ) : null}
                                                            {item.email ? (
                                                                <TouchableOpacity
                                                                    onPress={() => Linking.openURL(`mailto:${item.email}`)}
                                                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                                                >
                                                                    <Ionicons name="mail" size={11} color={BRAND.primary} />
                                                                    <CustomText fontFamily="medium" style={{ color: BRAND.primary, fontSize: 11, marginLeft: 3 }} numberOfLines={1}>
                                                                        {item.email}
                                                                    </CustomText>
                                                                </TouchableOpacity>
                                                            ) : null}
                                                            {item.location ? (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="location" size={11} color="#94A3B8" />
                                                                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginLeft: 3 }} numberOfLines={1}>
                                                                        {item.location}
                                                                    </CustomText>
                                                                </View>
                                                            ) : null}
                                                            {item.notes ? (
                                                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                                                                    <Ionicons name="document-text-outline" size={11} color="#94A3B8" style={{ marginTop: 1 }} />
                                                                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginLeft: 3, flex: 1 }} numberOfLines={2}>
                                                                        {item.notes}
                                                                    </CustomText>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => onUnpin(item.id)}
                                                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                                                    >
                                                        <Ionicons name="close" size={16} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    }}
                                />
                                {/* Pinned Tab Footer inside the wrapper */}
                                {pinnedVendors.length > 0 && (
                                    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1, borderTopColor: '#E8EEF4', backgroundColor: '#F0F4F8' }}>
                                        <TouchableOpacity
                                            onPress={handleClose}
                                            activeOpacity={0.88}
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 18, backgroundColor: BRAND.primary, shadowColor: BRAND.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 }}
                                        >
                                            <Ionicons name="checkmark-circle" size={17} color="#FFF" style={{ marginRight: 8 }} />
                                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 15 }}>
                                                Done · {pinnedVendors.length} vendor{pinnedVendors.length !== 1 ? 's' : ''} pinned
                                            </CustomText>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ── CUSTOM TAB ──────────────────────────────────────────── */}
                        {tab === 'custom' && (
                            <KeyboardAvoidingView
                                style={{ flex: 1 }}
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                            >
                                <ScrollView 
                                    style={{ flex: 1 }} 
                                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 32 : 24 }} 
                                    showsVerticalScrollIndicator={false} 
                                    keyboardShouldPersistTaps="handled"
                                    keyboardDismissMode="interactive"
                                >
                                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                                        Can't find your vendor in the directory? Add them manually and pin them to this event.
                                    </CustomText>

                                    <CustomText fontFamily="bold" style={{ color: '#475569', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>VENDOR NAME *</CustomText>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: customName.trim() ? BRAND.primary + '60' : '#E8EEF4', marginBottom: 12 }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                            <Ionicons name="storefront-outline" size={15} color={BRAND.primary} />
                                        </View>
                                        <TextInput
                                            style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: '#0F172A' }}
                                            value={customName}
                                            onChangeText={setCustomName}
                                            placeholder="e.g. Juan's Photography Studio"
                                            placeholderTextColor="#CBD5E1"
                                            returnKeyType="next"
                                        />
                                        {customName.length > 0 && (
                                            <TouchableOpacity onPress={() => setCustomName('')}>
                                                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <CustomText fontFamily="bold" style={{ color: '#475569', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>CATEGORY</CustomText>
                                    <TouchableOpacity
                                        onPress={() => setShowCategoryPicker(v => !v)}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: customCategory ? BRAND.primary + '60' : '#E8EEF4', marginBottom: showCategoryPicker ? 8 : 12, minHeight: 54 }}
                                    >
                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                            <Ionicons name={CATEGORY_ICONS[customCategory] || 'grid-outline'} size={15} color={BRAND.primary} />
                                        </View>
                                        <CustomText fontFamily={customCategory ? 'semibold' : 'regular'} style={{ flex: 1, color: customCategory ? '#0F172A' : '#CBD5E1', fontSize: 14 }}>
                                            {customCategory || 'Unassigned (tap to change)'}
                                        </CustomText>
                                        <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                    {showCategoryPicker && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12, paddingHorizontal: 2 }}>
                                            {CUSTOM_VENDOR_CATEGORIES.map(cat => {
                                                const active = customCategory === cat;
                                                return (
                                                    <TouchableOpacity
                                                        key={cat}
                                                        onPress={() => { setCustomCategory(cat); setShowCategoryPicker(false); }}
                                                        style={{
                                                            flexDirection: 'row', alignItems: 'center',
                                                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
                                                            backgroundColor: active ? BRAND.primary : '#F1F5F9',
                                                            borderWidth: 1, borderColor: active ? BRAND.primary : '#E2E8F0',
                                                        }}
                                                    >
                                                        <Ionicons name={CATEGORY_ICONS[cat] || 'grid-outline'} size={11} color={active ? '#FFF' : '#94A3B8'} style={{ marginRight: 5 }} />
                                                        <CustomText fontFamily="semibold" style={{ color: active ? '#FFF' : '#64748B', fontSize: 11 }}>
                                                            {cat}
                                                        </CustomText>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    )}

                                    <CustomText fontFamily="bold" style={{ color: '#475569', fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>PHONE NUMBER</CustomText>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1.5, borderColor: customPhone ? BRAND.primary + '60' : '#E8EEF4', marginBottom: 12 }}>
                                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: BRAND.primaryMid, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                            <Ionicons name="call-outline" size={15} color={BRAND.primary} />
                                        </View>
                                        <TextInput
                                            style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: '#0F172A' }}
                                            value={customPhone}
                                            onChangeText={setCustomPhone}
                                            placeholder="+63 9XX XXX XXXX"
                                            placeholderTextColor="#CBD5E1"
                                            keyboardType="phone-pad"
                                            returnKeyType="done"
                                        />
                                        {customPhone.length > 0 && (
                                            <TouchableOpacity onPress={() => setCustomPhone('')}>
                                                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: BRAND.primaryFaint, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: BRAND.primaryMid, marginBottom: 20 }}>
                                        <Ionicons name="information-circle-outline" size={15} color={BRAND.primary} style={{ marginTop: 1 }} />
                                        <CustomText fontFamily="medium" style={{ color: BRAND.primary + 'BB', fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 }}>
                                            Custom vendors are pinned to this event and shared to the vendor directory so other planners can discover them too.
                                        </CustomText>
                                    </View>

                                    {/* ── Save button lives INSIDE the scroll so it's always reachable ── */}
                                    <TouchableOpacity
                                        onPress={handleSaveCustom}
                                        disabled={!canSaveCustom || savingCustom}
                                        activeOpacity={0.88}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                            paddingVertical: 15, borderRadius: 18,
                                            backgroundColor: canSaveCustom ? BRAND.primary : '#CBD5E1',
                                            shadowColor: canSaveCustom ? BRAND.primaryDark : 'transparent',
                                            shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10,
                                            elevation: canSaveCustom ? 5 : 0,
                                        }}
                                    >
                                        <Ionicons name="pin" size={17} color="#FFF" style={{ marginRight: 8 }} />
                                        <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 15 }}>
                                            {canSaveCustom ? 'Pin this Vendor' : 'Enter Vendor Name'}
                                        </CustomText>
                                        {canSaveCustom && <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />}
                                    </TouchableOpacity>
                                </ScrollView>
                            </KeyboardAvoidingView>
                        )}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}