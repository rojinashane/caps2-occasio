/**
 * VenuePicker.js
 * 
 * A bottom-sheet style modal that lets the planner:
 *   1. Browse / search venues from the Firestore "venues" collection
 *   2. Pin one as the event venue (saves name + venueId)
 *   3. Or just type a custom venue name and save that instead
 * 
 * Props:
 *   visible        {bool}
 *   onClose        {() => void}
 *   onSelect       {({ name: string, venueId: string|null }) => void}
 *   currentValue   {string}  – currently saved location string
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
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

export default function VenuePicker({ visible, onClose, onSelect, currentValue }) {
    const [venues, setVenues]           = useState([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [customText, setCustomText]   = useState('');
    const [tab, setTab]                 = useState('browse'); // 'browse' | 'custom'
    const [pinnedId, setPinnedId]       = useState(null);

    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    // Animate in/out
    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
                Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    // Load venues from Firestore
    useEffect(() => {
        const q = query(collection(db, 'venues'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setVenues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    // Pre-fill custom text if current value isn't a DB venue
    useEffect(() => {
        if (visible && currentValue && currentValue !== 'To be decided') {
            setCustomText(currentValue);
        }
    }, [visible]);

    const filtered = venues.filter(v =>
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.location?.toLowerCase().includes(search.toLowerCase())
    );

    const handlePinVenue = (venue) => {
        if (pinnedId === venue.id) {
            // Deselect
            setPinnedId(null);
        } else {
            setPinnedId(venue.id);
        }
    };

    const handleConfirm = () => {
        if (tab === 'browse' && pinnedId) {
            const v = venues.find(v => v.id === pinnedId);
            if (v) onSelect({ name: v.name, venueId: v.id });
        } else if (tab === 'custom' && customText.trim()) {
            onSelect({ name: customText.trim(), venueId: null });
        } else if (!pinnedId && !customText.trim()) {
            // Clear
            onSelect({ name: '', venueId: null });
        }
        handleClose();
    };

    const handleClose = () => {
        setSearch('');
        setPinnedId(null);
        setTab('browse');
        onClose();
    };

    const canConfirm = (tab === 'browse' && pinnedId) || (tab === 'custom' && customText.trim().length > 0);

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

            {/* Sheet */}
            <KeyboardAvoidingView
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === 'android' ? -500 : 0}
                style={{ flex: 1, justifyContent: 'flex-end' }}
                pointerEvents="box-none"
            >
                <Animated.View style={{
                    transform: [{ translateY: slideAnim }],
                    backgroundColor: '#F0F4F8',
                    borderTopLeftRadius: 32,
                    borderTopRightRadius: 32,
                    maxHeight: SCREEN_HEIGHT * 0.88,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 20,
                    elevation: 20,
                }}>
                    {/* Top accent stripe */}
                    <View style={{ height: 4, backgroundColor: BRAND.primary, borderTopLeftRadius: 32, borderTopRightRadius: 32 }} />

                    {/* Drag handle */}
                    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                    </View>

                    {/* Header */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: 20, paddingVertical: 12,
                    }}>
                        <View>
                            <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 11, letterSpacing: 1.5 }}>
                                OCCASIO
                            </CustomText>
                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 20 }}>
                                Choose Venue
                            </CustomText>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={{
                                width: 36, height: 36, borderRadius: 18,
                                backgroundColor: BRAND.primaryMid,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: BRAND.primary + '30',
                            }}
                        >
                            <Ionicons name="close" size={18} color={BRAND.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Tab switcher */}
                    <View style={{
                        flexDirection: 'row',
                        marginHorizontal: 20, marginBottom: 12,
                        backgroundColor: '#E2E8F0',
                        borderRadius: 16, padding: 4,
                    }}>
                        {[
                            { key: 'browse', icon: 'business-outline', label: 'Our Venues' },
                            { key: 'custom', icon: 'create-outline',   label: 'Custom' },
                        ].map(t => (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => setTab(t.key)}
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center',
                                    justifyContent: 'center', paddingVertical: 9, borderRadius: 12,
                                    backgroundColor: tab === t.key ? '#FFF' : 'transparent',
                                    shadowColor: tab === t.key ? '#94A3B8' : 'transparent',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1, shadowRadius: 4,
                                    elevation: tab === t.key ? 2 : 0,
                                }}
                            >
                                <Ionicons
                                    name={t.icon} size={14}
                                    color={tab === t.key ? BRAND.primary : '#94A3B8'}
                                    style={{ marginRight: 5 }}
                                />
                                <CustomText
                                    fontFamily={tab === t.key ? 'bold' : 'semibold'}
                                    style={{ color: tab === t.key ? BRAND.primary : '#94A3B8', fontSize: 13 }}
                                >
                                    {t.label}
                                </CustomText>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── BROWSE TAB ─────────────────────────── */}
                    {tab === 'browse' && (
                        <>
                            {/* Search bar */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: '#FFF',
                                marginHorizontal: 20, marginBottom: 10,
                                borderRadius: 14, paddingHorizontal: 12, height: 46,
                                borderWidth: 1, borderColor: '#E8EEF4',
                            }}>
                                <Ionicons name="search" size={16} color="#94A3B8" />
                                <TextInput
                                    style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0F172A' }}
                                    placeholder="Search venues..."
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

                            {loading ? (
                                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                    <ActivityIndicator color={BRAND.primary} />
                                </View>
                            ) : (
                                <FlatList
                                    data={filtered}
                                    keyExtractor={item => item.id}
                                    style={{ maxHeight: SCREEN_HEIGHT * 0.46 }}
                                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    ListEmptyComponent={
                                        <View style={{ alignItems: 'center', paddingTop: 30 }}>
                                            <View style={{
                                                width: 56, height: 56, borderRadius: 16,
                                                backgroundColor: BRAND.primaryMid,
                                                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                                            }}>
                                                <Ionicons name="search-outline" size={24} color={BRAND.primary} />
                                            </View>
                                            <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 15, marginBottom: 4 }}>
                                                No venues found
                                            </CustomText>
                                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                                                Try the Custom tab to type your own venue.
                                            </CustomText>
                                        </View>
                                    }
                                    renderItem={({ item }) => {
                                        const isPinned = pinnedId === item.id;
                                        const priceDisplay = item.price ? item.price.split(' ')[0] : null;
                                        return (
                                            <TouchableOpacity
                                                onPress={() => handlePinVenue(item)}
                                                activeOpacity={0.85}
                                                style={{
                                                    backgroundColor: '#FFF',
                                                    borderRadius: 20, marginBottom: 10,
                                                    overflow: 'hidden',
                                                    borderWidth: isPinned ? 2 : 1,
                                                    borderColor: isPinned ? BRAND.primary : '#E8EEF4',
                                                    shadowColor: isPinned ? BRAND.primary : '#94A3B8',
                                                    shadowOffset: { width: 0, height: isPinned ? 5 : 2 },
                                                    shadowOpacity: isPinned ? 0.15 : 0.06,
                                                    shadowRadius: isPinned ? 10 : 6,
                                                    elevation: isPinned ? 5 : 2,
                                                }}
                                            >
                                                {/* Top accent stripe */}
                                                <View style={{ height: 3, backgroundColor: isPinned ? BRAND.primary : '#E2E8F0' }} />

                                                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                                                    {/* Venue thumbnail */}
                                                    <View style={{
                                                        width: 64, height: 64, borderRadius: 14,
                                                        backgroundColor: BRAND.primaryMid, overflow: 'hidden',
                                                        marginRight: 12,
                                                    }}>
                                                        {item.image ? (
                                                            <Image
                                                                source={{ uri: item.image }}
                                                                style={{ width: '100%', height: '100%' }}
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                                                <Ionicons name="business" size={26} color={BRAND.primary} />
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Text info */}
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                                                            <CustomText
                                                                fontFamily="extrabold"
                                                                style={{ color: '#0F172A', fontSize: 14, flex: 1 }}
                                                                numberOfLines={1}
                                                            >
                                                                {item.name}
                                                            </CustomText>
                                                            {item.hasAR && (
                                                                <View style={{
                                                                    flexDirection: 'row', alignItems: 'center',
                                                                    backgroundColor: BRAND.primaryFaint,
                                                                    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
                                                                    borderWidth: 1, borderColor: BRAND.primaryMid,
                                                                    marginLeft: 6,
                                                                }}>
                                                                    <Ionicons name="cube" size={10} color={BRAND.primary} />
                                                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 9, marginLeft: 3 }}>
                                                                        AR
                                                                    </CustomText>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                            <Ionicons name="location" size={11} color={BRAND.primary} />
                                                            <CustomText
                                                                fontFamily="medium"
                                                                style={{ color: BRAND.primary, fontSize: 11, marginLeft: 3, flex: 1 }}
                                                                numberOfLines={1}
                                                            >
                                                                {item.location}
                                                            </CustomText>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                            {item.capacity && (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="people" size={10} color="#94A3B8" />
                                                                    <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 10, marginLeft: 3 }}>
                                                                        {item.capacity}
                                                                    </CustomText>
                                                                </View>
                                                            )}
                                                            {priceDisplay && (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 11 }}>
                                                                        {priceDisplay}
                                                                    </CustomText>
                                                                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 10 }}>
                                                                        /day
                                                                    </CustomText>
                                                                </View>
                                                            )}
                                                        </View>
                                                    </View>

                                                    {/* Pin indicator */}
                                                    <View style={{
                                                        width: 32, height: 32, borderRadius: 16,
                                                        backgroundColor: isPinned ? BRAND.primary : BRAND.primaryFaint,
                                                        alignItems: 'center', justifyContent: 'center',
                                                        borderWidth: isPinned ? 0 : 1,
                                                        borderColor: BRAND.primaryMid,
                                                        marginLeft: 8,
                                                    }}>
                                                        <Ionicons
                                                            name={isPinned ? 'checkmark' : 'location-outline'}
                                                            size={16}
                                                            color={isPinned ? '#FFF' : BRAND.primary}
                                                        />
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            )}
                        </>
                    )}

                    {/* ── CUSTOM TAB ─────────────────────────── */}
                    {tab === 'custom' && (
                        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
                                Can't find your venue in our list? Type the name or address below and we'll save it for your event.
                            </CustomText>

                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: '#FFF',
                                borderRadius: 16, paddingHorizontal: 14,
                                borderWidth: 1.5,
                                borderColor: customText.trim() ? BRAND.primary + '60' : '#E8EEF4',
                                marginBottom: 12,
                            }}>
                                <View style={{
                                    width: 32, height: 32, borderRadius: 10,
                                    backgroundColor: BRAND.primaryMid,
                                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                                }}>
                                    <Ionicons name="location-outline" size={15} color={BRAND.primary} />
                                </View>
                                <TextInput
                                    style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                                    value={customText}
                                    onChangeText={setCustomText}
                                    placeholder="e.g. SM City Legazpi Function Hall"
                                    placeholderTextColor="#CBD5E1"
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={() => customText.trim() && handleConfirm()}
                                />
                                {customText.length > 0 && (
                                    <TouchableOpacity onPress={() => setCustomText('')} style={{ padding: 4 }}>
                                        <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Info note */}
                            <View style={{
                                flexDirection: 'row', alignItems: 'flex-start',
                                backgroundColor: BRAND.primaryFaint,
                                borderRadius: 12, padding: 12,
                                borderWidth: 1, borderColor: BRAND.primaryMid,
                            }}>
                                <Ionicons name="information-circle-outline" size={15} color={BRAND.primary} style={{ marginTop: 1 }} />
                                <CustomText fontFamily="medium" style={{ color: BRAND.primary + 'BB', fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 }}>
                                    This venue won't have AR features. Browse "Our Venues" to find AR-ready spaces.
                                </CustomText>
                            </View>
                        </View>
                    )}

                    {/* ── CONFIRM BUTTON ──────────────────────── */}
                    <View style={{
                        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32,
                        borderTopWidth: 1, borderTopColor: '#E8EEF4',
                        backgroundColor: '#F0F4F8',
                    }}>
                        {/* Selected venue preview */}
                        {tab === 'browse' && pinnedId && (() => {
                            const v = venues.find(x => x.id === pinnedId);
                            return v ? (
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    backgroundColor: BRAND.primaryFaint,
                                    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
                                    borderWidth: 1, borderColor: BRAND.primaryMid,
                                    marginBottom: 12,
                                }}>
                                    <Ionicons name="location" size={15} color={BRAND.primary} />
                                    <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13, marginLeft: 8, flex: 1 }} numberOfLines={1}>
                                        {v.name}
                                    </CustomText>
                                    <TouchableOpacity onPress={() => setPinnedId(null)} style={{ padding: 2 }}>
                                        <Ionicons name="close-circle" size={16} color={BRAND.primary + '80'} />
                                    </TouchableOpacity>
                                </View>
                            ) : null;
                        })()}

                        <TouchableOpacity
                            onPress={handleConfirm}
                            disabled={!canConfirm}
                            activeOpacity={0.88}
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                paddingVertical: 15, borderRadius: 18,
                                backgroundColor: canConfirm ? BRAND.primary : '#CBD5E1',
                                shadowColor: canConfirm ? BRAND.primaryDark : 'transparent',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.28, shadowRadius: 10, elevation: canConfirm ? 5 : 0,
                            }}
                        >
                            <Ionicons name="location" size={17} color="#FFF" style={{ marginRight: 8 }} />
                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 15 }}>
                                {canConfirm ? 'Pin this Venue' : 'Select a Venue'}
                            </CustomText>
                            {canConfirm && (
                                <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
                            )}
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}