import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Platform,
    UIManager,
    Dimensions,
    TouchableWithoutFeedback,
    Alert,
    Modal,
    Image, // Added Image for venue cards
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import CustomText from '../components/CustomText';
import NotificationModal from '../components/NotificationModal';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import {
    doc,
    getDoc,
    collection,
    query,
    onSnapshot,
    or,
    where,
    limit,
} from 'firebase/firestore';

import tw from 'twrnc';

const { width } = Dimensions.get('window');

// ── BRAND PALETTE ───────────────────────────────────────────
const BRAND = {
    primary:     '#00686F',   // Occasio teal
    primaryDark: '#004E54',   // deeper teal for shadows/pressed
    primaryBg:   '#E8F5F5',   // light teal wash
    primaryMid:  '#E0F2F3',   // mid teal bg
    primaryFaint:'#F0F9FA',   // faintest teal tint
};

// ── UTILITIES ──────────────────────────────────────────────
const toDate = (val) => {
    if (!val) return new Date();
    if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
};

const parseDateToObj = (val) => {
    const d = toDate(val);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatDate = (val) => {
    const d = toDate(val);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatDateShort = (val) => {
    const d = toDate(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysUntil = (val) => {
    const target = parseDateToObj(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EVENT_ICONS = {
    Wedding: 'heart',
    'Birthday Party': 'gift',
    Corporate: 'briefcase',
    Charity: 'ribbon',
    Others: 'star',
};

const EVENT_COLORS = {
    Wedding:        '#E8626A',
    'Birthday Party':'#F59E0B',
    Corporate:      '#3B82F6',
    Charity:        '#059669',
    Others:         '#00686F',
};

// ── SCREEN ─────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
    const [userData, setUserData]   = useState(null);
    const [allEvents, setAllEvents] = useState([]);
    const [arVenues, setArVenues]   = useState([]); // State for venues
    const [loading, setLoading]     = useState(true);
    const [greeting, setGreeting]   = useState('');
    const [emoji, setEmoji]         = useState('');
    const [notifVisible, setNotifVisible] = useState(false);
    const [unreadCount, setUnreadCount]   = useState(0);
    const [menuVisible, setMenuVisible]   = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const slideAnim  = useRef(new Animated.Value(width)).current;
    const heroSlide  = useRef(new Animated.Value(24)).current;

    // ── Listen for unread notification count ──
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        // Query all pending notifications — the 'viewed' field may be missing
        // on newly created docs, so filtering where('viewed','==',false) in
        // Firestore misses them. We fetch all pending and filter client-side.
        const q = query(
            collection(db, 'notifications'),
            where('recipientId', '==', user.uid),
            where('status', '==', 'pending')
        );
        const unsub = onSnapshot(q, (snap) => {
            const count = snap.docs.filter(d => !d.data().viewed).length;
            setUnreadCount(count);
        });
        return () => unsub();
    }, []);

    useFocusEffect(useCallback(() => {
        fetchUserData();
        const h = new Date().getHours();
        if (h < 12) { setGreeting('Good morning');   setEmoji('☀️'); }
        else if (h < 18) { setGreeting('Good afternoon'); setEmoji('👋'); }
        else { setGreeting('Good evening');  setEmoji('🌙'); }
    }, []));

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        // Fetch User's Events
        const qEvents = query(
            collection(db, 'events'),
            or(
                where('userId', '==', user.uid),
                where('collaborators', 'array-contains', user.email?.toLowerCase() || '')
            )
        );

        const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllEvents(data);
            setLoading(false);
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(heroSlide, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
            ]).start();
        });

        // Fetch Featured Venues for the dashboard
        const qVenues = query(collection(db, 'venues'), limit(5));
        const unsubscribeVenues = onSnapshot(qVenues, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setArVenues(data);
        });

        return () => {
            unsubscribeEvents();
            unsubscribeVenues();
        };
    }, []);

    const fetchUserData = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            setUserData(snap.data());
        } else {
            setUserData({
                name: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
            });
        }
    };

    const toggleMenu = (open) => {
        if (open) {
            setMenuVisible(true);
            Animated.timing(slideAnim, { toValue: width * 0.25, duration: 300, useNativeDriver: true }).start();
        } else {
            Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true })
                .start(() => setMenuVisible(false));
        }
    };

    const handleLogout = () => {
        toggleMenu(false);
        setTimeout(() => setLogoutModalVisible(true), 280);
    };

    const confirmLogout = async () => {
        setLoggingOut(true);
        try {
            await signOut(auth);
            navigation.replace('Landing');
        } catch {
            Alert.alert('Error', 'Failed to logout.');
        } finally {
            setLoggingOut(false);
            setLogoutModalVisible(false);
        }
    };

    // ── derived data ──
    const upcomingEvents = useMemo(() => {
        const today = new Date().setHours(0, 0, 0, 0);
        return [...allEvents]
            .filter(e => {
                const end = e.endDate
                    ? parseDateToObj(e.endDate).getTime()
                    : parseDateToObj(e.startDate).getTime();
                return end >= today;
            })
            .sort((a, b) => parseDateToObj(a.startDate) - parseDateToObj(b.startDate));
    }, [allEvents]);

    const nextEvent     = upcomingEvents[0] || null;
    const previewEvents = upcomingEvents.slice(1, 4);

    if (loading) {
        return (
            <View style={tw`flex-1 justify-center items-center bg-[#F0F4F8]`}>
                <ActivityIndicator size="large" color={BRAND.primary} />
            </View>
        );
    }

    const fullName =
        userData?.name ||
        userData?.displayName ||
        userData?.fullName ||
        userData?.username ||
        userData?.firstName ||
        auth.currentUser?.displayName ||
        '';
    const firstName = fullName.trim().split(' ')[0] || 'there';

    const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F0F4F8]`} edges={['top']}>

            {/* ── FIXED HEADER ───────────────────────────────── */}
            <View style={[
                tw`px-5 pt-3 pb-3 flex-row items-center justify-between`,
                {
                    backgroundColor: '#F0F4F8',
                    borderBottomWidth: 1,
                    borderBottomColor: '#E8EEF4',
                },
            ]}>
                <View style={tw`flex-1`}>
                    {/* Occasio brand name */}
                    <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 13, letterSpacing: 1.5 }}>
                        OCCASIO
                    </CustomText>
                    <View style={tw`flex-row items-center mt-0.5`}>
                        <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 21 }}>
                            {greeting},{' '}
                        </CustomText>
                        <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 21 }}>
                            {firstName}
                        </CustomText>
                        <CustomText style={{ fontSize: 19, marginLeft: 6 }}>{emoji}</CustomText>
                    </View>
                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>
                        {todayStr}
                    </CustomText>
                </View>

                <View style={tw`flex-row items-center gap-2`}>
                    <TouchableOpacity
                        onPress={() => { setNotifVisible(true); }}
                        style={[
                            tw`w-10 h-10 rounded-full justify-center items-center`,
                            { backgroundColor: BRAND.primaryMid, borderWidth: 1, borderColor: BRAND.primary + '30' },
                        ]}
                    >
                        <Ionicons name={unreadCount > 0 ? "notifications" : "notifications-outline"} size={20} color={BRAND.primary} />
                        {unreadCount > 0 && (
                            <View style={{
                                position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16,
                                borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center',
                                justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#F0F4F8',
                            }}>
                                <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 9, lineHeight: 12 }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </CustomText>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => toggleMenu(true)}
                        style={[
                            tw`w-10 h-10 rounded-full justify-center items-center`,
                            { backgroundColor: BRAND.primaryMid, borderWidth: 1, borderColor: BRAND.primary + '30' },
                        ]}
                    >
                        <Ionicons name="menu-outline" size={22} color={BRAND.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── SCROLLABLE CONTENT ─────────────────────────── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 20, paddingTop: 20 }}
            >

                {/* ── NEXT EVENT HERO ─────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: heroSlide }], marginBottom: 16 }}>
                    {nextEvent ? (
                        <TouchableOpacity
                            activeOpacity={0.93}
                            onPress={() => navigation.navigate('EventDetails', { eventId: nextEvent.id })}
                            style={[
                                tw`rounded-[26px] overflow-hidden`,
                                { shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 6 },
                            ]}
                        >
                            <View style={{ backgroundColor: BRAND.primaryBg, borderRadius: 26 }}>
                                <View style={{ height: 5, backgroundColor: BRAND.primary, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} />
                                <View style={tw`p-5`}>
                                    <View style={tw`flex-row justify-between items-center mb-3`}>
                                        <View style={[tw`flex-row items-center px-3 py-1 rounded-full`, { backgroundColor: BRAND.primary + '18' }]}>
                                            <View style={[tw`w-1.5 h-1.5 rounded-full mr-1.5`, { backgroundColor: BRAND.primary }]} />
                                            <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 10, letterSpacing: 1 }}>
                                                NEXT EVENT
                                            </CustomText>
                                        </View>
                                        <CountdownBadge date={nextEvent.startDate} />
                                    </View>

                                    <View style={tw`flex-row items-center mb-2`}>
                                        <View style={[
                                            tw`w-6 h-6 rounded-full justify-center items-center mr-2`,
                                            { backgroundColor: (EVENT_COLORS[nextEvent.eventType] || BRAND.primary) + '22' },
                                        ]}>
                                            <Ionicons name={EVENT_ICONS[nextEvent.eventType] || 'star'} size={13} color={EVENT_COLORS[nextEvent.eventType] || BRAND.primary} />
                                        </View>
                                        <CustomText fontFamily="semibold" style={{ color: '#64748B', fontSize: 12 }}>
                                            {typeof nextEvent.eventType === 'string' ? nextEvent.eventType : 'Event'}
                                        </CustomText>
                                    </View>

                                    <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 21, lineHeight: 27, marginBottom: 10 }} numberOfLines={2}>
                                        {typeof nextEvent.title === 'string' ? nextEvent.title : ''}
                                    </CustomText>

                                    <View style={{ height: 1, backgroundColor: BRAND.primary + '1A', marginBottom: 12 }} />

                                    <View style={tw`flex-row items-center mb-2`}>
                                        <Ionicons name="calendar-outline" size={13} color={BRAND.primary} />
                                        <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 13, marginLeft: 7 }}>
                                            {formatDate(nextEvent.startDate)}
                                            {nextEvent.startTime ? `  ·  ${nextEvent.startTime}` : ''}
                                        </CustomText>
                                    </View>

                                    {nextEvent.location && nextEvent.location !== 'To be decided' && (
                                        <View style={tw`flex-row items-center mb-4`}>
                                            <Ionicons name="location-outline" size={13} color={BRAND.primary} />
                                            <CustomText fontFamily="semibold" style={{ color: '#334155', fontSize: 13, marginLeft: 7, flex: 1 }} numberOfLines={1}>
                                                {typeof nextEvent.location === 'string' ? nextEvent.location : ''}
                                            </CustomText>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('EventDetails', { eventId: nextEvent.id })}
                                        style={[
                                            tw`flex-row items-center justify-center py-3 rounded-[14px]`,
                                            { backgroundColor: BRAND.primary, shadowColor: BRAND.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
                                        ]}
                                    >
                                        <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 14 }}>View Details</CustomText>
                                        <Ionicons name="arrow-forward" size={15} color="#FFF" style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => navigation.navigate('AddEvent')}
                            style={[
                                tw`rounded-[26px] p-6 items-center justify-center`,
                                { borderWidth: 2, borderColor: BRAND.primary, borderStyle: 'dashed', backgroundColor: BRAND.primaryFaint, minHeight: 140 },
                            ]}
                        >
                            <View style={[tw`w-14 h-14 rounded-full justify-center items-center mb-3`, { backgroundColor: BRAND.primaryMid }]}>
                                <Ionicons name="add" size={28} color={BRAND.primary} />
                            </View>
                            <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 16 }}>Plan Your First Event</CustomText>
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, marginTop: 3 }}>Tap to get started</CustomText>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* ── AR VENUE TOURS (DYNAMIC DUAL DISPLAY) ────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, marginBottom: 20 }}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <View>
                            <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>AR Venue Tours</CustomText>
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>Walk through our AR Venue Viewing Feature</CustomText>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('Venues')}>
                            <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13 }}>View All</CustomText>
                        </TouchableOpacity>
                    </View>

                    {arVenues.length > 0 ? (
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            style={{ overflow: 'visible' }}
                            contentContainerStyle={{ gap: 14 }}
                        >
                            {arVenues.map((venue) => (
                                <TouchableOpacity
                                    key={venue.id}
                                    activeOpacity={0.88}
                                    onPress={() => navigation.navigate('VenueDetails', { venue })}
                                    style={[
                                        tw`bg-white rounded-[22px] overflow-hidden`,
                                        {
                                            width: width * 0.68,
                                            shadowColor: BRAND.primary,
                                            shadowOffset: { width: 0, height: 6 },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 12,
                                            elevation: 4,
                                        },
                                    ]}
                                >
                                    <View style={tw`relative w-full h-32 bg-slate-200`}>
                                        {venue.image && (
                                            <Image source={{ uri: venue.image }} style={tw`w-full h-full absolute`} resizeMode="cover" />
                                        )}
                                        {venue.hasAR !== false && (
                                            <View style={tw`absolute top-3 right-3 bg-[#00686F]/90 flex-row items-center px-2 py-1.5 rounded-full`}>
                                                <Ionicons name="cube" size={12} color="#FFF" />
                                                <CustomText fontFamily="bold" style={tw`text-white text-[10px] ml-1.5 uppercase tracking-wide`}>AR Ready</CustomText>
                                            </View>
                                        )}
                                    </View>
                                    <View style={tw`p-4`}>
                                        <CustomText fontFamily="extrabold" style={tw`text-[16px] text-slate-800 mb-1.5`} numberOfLines={1}>
                                            {venue.name}
                                        </CustomText>
                                        <View style={tw`flex-row items-center justify-between`}>
                                            <View style={tw`flex-row items-center flex-1 mr-2`}>
                                                <Ionicons name="location" size={12} color={BRAND.primary} />
                                                <CustomText fontFamily="medium" style={tw`text-[11px] text-[#00686F] ml-1 flex-1`} numberOfLines={1}>
                                                    {venue.location}
                                                </CustomText>
                                            </View>
                                            <View style={tw`flex-row items-center bg-[#F0F9FA] px-2 py-1 rounded-lg border border-[#E0F2F3]`}>
                                                <Ionicons name="people" size={11} color={BRAND.primary} />
                                                <CustomText fontFamily="bold" style={tw`text-[10px] text-[#00686F] ml-1`}>
                                                    {venue.capacity || 'N/A'}
                                                </CustomText>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : (
                        /* Fallback strictly matching original static design just in case venues take a second to load or DB is empty */
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => navigation.navigate('Venues')}
                            style={[
                                tw`rounded-[24px] overflow-hidden`,
                                { shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 6 },
                            ]}
                        >
                            <View style={{ backgroundColor: BRAND.primaryDark, borderRadius: 24 }}>
                                <View style={{ height: 4, backgroundColor: '#00868E', borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
                                <View style={{ padding: 20 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                                        <View style={{
                                            flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
                                            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
                                        }}>
                                            <Ionicons name="cube-outline" size={13} color="#FFF" />
                                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 10, marginLeft: 5, letterSpacing: 1 }}>AR READY VENUES</CustomText>
                                        </View>
                                    </View>
                                    <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 22, lineHeight: 28, marginBottom: 6 }}>
                                        Walk Through{'\n'}Before You Book
                                    </CustomText>
                                    <CustomText fontFamily="medium" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 19, marginBottom: 20 }}>
                                        Explore venues in augmented reality — see the space, feel the scale, all from your phone.
                                    </CustomText>
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                                        {[{ icon: 'walk-outline', label: 'Virtual Tour' }, { icon: 'people-outline', label: 'Capacity Info' }, { icon: 'location-outline', label: 'Map View' }]
                                            .map((f) => (
                                            <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }}>
                                                <Ionicons name={f.icon} size={12} color="rgba(255,255,255,0.85)" />
                                                <CustomText fontFamily="semibold" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginLeft: 5 }}>{f.label}</CustomText>
                                            </View>
                                        ))}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 13 }}>
                                        <Ionicons name="cube" size={16} color={BRAND.primary} />
                                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 14, marginLeft: 7 }}>Browse AR Venues</CustomText>
                                        <Ionicons name="arrow-forward" size={15} color={BRAND.primary} style={{ marginLeft: 6 }} />
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                {/* ── COMING UP PREVIEW ───────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim}}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>
                            Coming Up
                        </CustomText>
                    </View>

                    {previewEvents.length > 0 ? (
                        previewEvents.map((event, index) => (
                            <UpcomingEventRow
                                key={event.id}
                                event={event}
                                onPress={() => navigation.navigate('EventDetails', { eventId: event.id })}
                                isLast={index === previewEvents.length - 1}
                            />
                        ))
                    ) : (
                        upcomingEvents.length <= 1 && (
                            <View style={[
                                tw`items-center py-6 rounded-[20px]`,
                                { borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
                            ]}>
                                <Ionicons name="calendar-outline" size={28} color="#CBD5E1" style={{ marginBottom: 8 }} />
                                <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 13 }}>
                                    No more events scheduled
                                </CustomText>
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('AddEvent')}
                                    style={[tw`mt-3 px-5 py-2 rounded-full`, { backgroundColor: BRAND.primaryMid }]}
                                >
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 12 }}>+ Add Event</CustomText>
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </Animated.View>

                {/* ── RSVP SNEAK PEEK ─────────────────────────── */}
                {nextEvent && (
                    <Animated.View style={{ opacity: fadeAnim, marginTop: 20 }}>
                        <View style={tw`flex-row justify-between items-center mb-3`}>
                            <View>
                                <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>Guest Tracker</CustomText>
                                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>Track RSVPs for your upcoming event</CustomText>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('RSVPTrackerScreen', { eventId: nextEvent.id, eventTitle: nextEvent.title })}>
                                <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13 }}>Open</CustomText>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => navigation.navigate('RSVPTrackerScreen', { eventId: nextEvent.id, eventTitle: nextEvent.title })}
                            style={[
                                tw`bg-white rounded-[24px] overflow-hidden`,
                                { shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4 },
                            ]}
                        >
                            <View style={{ height: 4, backgroundColor: BRAND.primary }} />
                            <View style={{ padding: 18 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                                    <View style={{
                                        backgroundColor: BRAND.primaryBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center',
                                    }}>
                                        <Ionicons name="calendar-outline" size={12} color={BRAND.primary} />
                                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 11, marginLeft: 5 }} numberOfLines={1}>
                                            {nextEvent.title}
                                        </CustomText>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                                    {[
                                        { icon: 'people',           label: 'Total Guests',  color: BRAND.primary,  bg: BRAND.primaryBg },
                                        { icon: 'checkmark-circle', label: 'Attending',     color: '#10B981',      bg: '#D1FAE5' },
                                        { icon: 'close-circle',     label: 'Declined',      color: '#EF4444',      bg: '#FEE2E2' },
                                    ].map((s) => (
                                        <View key={s.label} style={{ flex: 1, alignItems: 'center', backgroundColor: s.bg, borderRadius: 14, paddingVertical: 12 }}>
                                            <Ionicons name={s.icon} size={20} color={s.color} />
                                            <CustomText fontFamily="bold" style={{ color: s.color, fontSize: 10, marginTop: 5, textAlign: 'center' }}>{s.label}</CustomText>
                                        </View>
                                    ))}
                                </View>

                                {[
                                    { icon: 'search-outline',   text: 'Search & filter guests by status' },
                                    { icon: 'share-outline',    text: 'Export guest list as CSV' },
                                    { icon: 'notifications-outline', text: 'Get notified on new RSVPs' },
                                ].map((f) => (
                                    <View key={f.text} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: BRAND.primaryFaint, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                            <Ionicons name={f.icon} size={13} color={BRAND.primary} />
                                        </View>
                                        <CustomText fontFamily="medium" style={{ color: '#475569', fontSize: 13 }}>{f.text}</CustomText>
                                    </View>
                                ))}

                                <View style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND.primaryBg,
                                    borderRadius: 14, paddingVertical: 12, marginTop: 10, borderWidth: 1, borderColor: BRAND.primary + '30',
                                }}>
                                    <Ionicons name="list-outline" size={15} color={BRAND.primary} />
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 13, marginLeft: 7 }}>View Full RSVP List</CustomText>
                                    <Ionicons name="arrow-forward" size={14} color={BRAND.primary} style={{ marginLeft: 6 }} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ── EXPLORE VENDORS ───────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, marginTop: 20 }}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>Explore Vendors</CustomText>
                        <TouchableOpacity onPress={() => navigation.navigate('VendorScreen')}>
                            <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13 }}>View All</CustomText>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('VendorScreen')}
                        style={[
                            tw`bg-white rounded-[22px] flex-row items-center p-4`,
                            { shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 12, elevation: 3 },
                        ]}
                    >
                        <View style={[tw`w-14 h-14 rounded-2xl justify-center items-center mr-4`, { backgroundColor: BRAND.primaryMid }]}>
                            <Ionicons name="storefront-outline" size={26} color={BRAND.primary} />
                        </View>
                        <View style={tw`flex-1`}>
                            <CustomText fontFamily="bold" style={tw`text-[16px] text-slate-800`}>Vendor Directory</CustomText>
                            <CustomText fontFamily="medium" style={tw`text-[12px] text-slate-500 mt-0.5`}>Find trusted vendors for your event needs</CustomText>
                        </View>
                        <View style={[tw`w-8 h-8 rounded-full justify-center items-center`, { backgroundColor: BRAND.primaryBg }]}>
                            <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

            </ScrollView>

            <NotificationModal visible={notifVisible} onClose={() => setNotifVisible(false)} />

            {/* ── LOGOUT CONFIRMATION MODAL ─────────────────── */}
            <Modal
                visible={logoutModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => !loggingOut && setLogoutModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => !loggingOut && setLogoutModalVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
                        <TouchableWithoutFeedback>
                            <View style={{ width: '100%', backgroundColor: '#FFF', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 24 }}>
                                <View style={{ flexDirection: 'row', height: 5 }}>
                                    <View style={{ flex: 1, backgroundColor: BRAND.primary }} />
                                    <View style={{ flex: 1, backgroundColor: '#EF4444' }} />
                                </View>
                                <View style={{ paddingHorizontal: 28, paddingTop: 30, paddingBottom: 26, alignItems: 'center' }}>
                                    <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 22, borderWidth: 1.5, borderColor: '#FECACA' }}>
                                        <Ionicons name="log-out-outline" size={36} color="#EF4444" />
                                    </View>
                                    <CustomText fontFamily="extrabold" style={{ fontSize: 23, color: '#0F172A', letterSpacing: -0.5, marginBottom: 10 }}>Leaving so soon?</CustomText>
                                    <CustomText fontFamily="medium" style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 4 }}>
                                        You'll need to sign in again to access your events and workspace.
                                    </CustomText>
                                    <TouchableOpacity
                                        onPress={confirmLogout}
                                        disabled={loggingOut}
                                        activeOpacity={0.85}
                                        style={{
                                            width: '100%', height: 54, borderRadius: 17, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: 11, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 8, opacity: loggingOut ? 0.75 : 1,
                                        }}
                                    >
                                        {loggingOut ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Ionicons name="log-out-outline" size={19} color="#FFF" />
                                                <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 15, letterSpacing: 0.2 }}>Yes, Log Out</CustomText>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setLogoutModalVisible(false)}
                                        disabled={loggingOut}
                                        activeOpacity={0.8}
                                        style={{ width: '100%', height: 54, borderRadius: 17, backgroundColor: BRAND.primaryBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: BRAND.primary + '35' }}
                                    >
                                        <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 15 }}>Stay Signed In</CustomText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ── SIDE DRAWER ─────────────────────────────────── */}
            {menuVisible && (
                <View style={tw`absolute inset-0 z-50`} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                        <View style={tw`absolute inset-0 bg-slate-900/40`} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[
                        tw`absolute top-0 right-0 bottom-0 bg-white rounded-l-[32px] px-6 pt-16`,
                        { width: width * 0.75, transform: [{ translateX: slideAnim }], shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, marginRight: 20 },
                    ]}>
                        <View style={tw`flex-row justify-between items-center pb-6 border-b border-slate-100`}>
                            <View>
                                <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 11, letterSpacing: 1.5 }}>OCCASIO</CustomText>
                                <CustomText fontFamily="extrabold" style={tw`text-xl text-slate-800`}>Menu</CustomText>
                            </View>
                            <TouchableOpacity onPress={() => toggleMenu(false)} style={[tw`p-2 rounded-full`, { backgroundColor: BRAND.primaryFaint }]}>
                                <Ionicons name="close" size={20} color={BRAND.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={tw`mt-6`}>
                            <TouchableOpacity style={tw`flex-row items-center py-4`} onPress={() => { toggleMenu(false); navigation.navigate('Profile'); }}>
                                <View style={[tw`w-12 h-12 rounded-2xl justify-center items-center mr-4`, { backgroundColor: BRAND.primaryMid }]}>
                                    <Ionicons name="person-outline" size={20} color={BRAND.primary} />
                                </View>
                                <CustomText fontFamily="semibold" style={tw`text-[16px] text-slate-700`}>Profile Settings</CustomText>
                            </TouchableOpacity>
                            <TouchableOpacity style={tw`flex-row items-center py-4`} onPress={handleLogout}>
                                <View style={tw`w-12 h-12 rounded-2xl bg-red-50 justify-center items-center mr-4`}>
                                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                                </View>
                                <CustomText fontFamily="semibold" style={tw`text-[16px] text-red-500`}>Log Out</CustomText>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            )}

            <BottomNav navigation={navigation} activeRoute="Dashboard" userData={userData} />
        </SafeAreaView>
    );
}

// ── SUB-COMPONENTS ──────────────────────────────────────────

const CountdownBadge = ({ date }) => {
    const days = daysUntil(date);
    let bg = BRAND.primaryBg, color = BRAND.primary, text = `${days}d away`;
    if (days === 0)      { bg = '#FEF3C7'; color = '#D97706'; text = 'Today! 🎉'; }
    else if (days === 1) { bg = '#EDE9FE'; color = '#7C3AED'; text = 'Tomorrow'; }
    else if (days <= 7)  { bg = '#DCFCE7'; color = '#16A34A'; text = `In ${days} days`; }
    return (
        <View style={[tw`flex-row items-center px-3 py-1 rounded-full`, { backgroundColor: bg }]}>
            <Ionicons name="time-outline" size={12} color={color} />
            <CustomText fontFamily="bold" style={{ color, fontSize: 12, marginLeft: 4 }}>{text}</CustomText>
        </View>
    );
};

// ── UPCOMING EVENT ROW ──────────────────────────────────────
const UpcomingEventRow = ({ event, onPress, isLast }) => {
    const user = auth.currentUser;
    const isShared = event.userId !== user?.uid;
    const accentColor = isShared ? '#8B5CF6' : EVENT_COLORS[event.eventType] || BRAND.primary;
    const days = daysUntil(event.startDate);
    const startStr  = formatDateShort(event.startDate);
    const endStr    = event.isMultiDay && event.endDate ? formatDateShort(event.endDate) : null;
    const dateLabel = endStr ? `${startStr} → ${endStr}` : startStr;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[
                tw`bg-white rounded-[18px] flex-row items-center overflow-hidden`,
                !isLast && { marginBottom: 10 },
                { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
            ]}
        >
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: accentColor }} />
            <View style={[tw`items-center justify-center mx-4`, { width: 44, height: 44, borderRadius: 12, backgroundColor: accentColor + '15' }]}>
                <CustomText fontFamily="extrabold" style={{ fontSize: 16, color: accentColor, lineHeight: 19 }}>
                    {days === 0 ? '🎉' : String(days)}
                </CustomText>
                {days !== 0 && (
                    <CustomText fontFamily="medium" style={{ fontSize: 9, color: accentColor }}>
                        {days === 1 ? 'day' : 'days'}
                    </CustomText>
                )}
            </View>
            <View style={tw`flex-1 py-3.5 pr-3`}>
                <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 14, marginBottom: 3 }} numberOfLines={1}>
                    {typeof event.title === 'string' ? event.title : ''}
                </CustomText>
                <View style={tw`flex-row items-center`}>
                    <Ionicons name="calendar-outline" size={11} color="#94A3B8" />
                    <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginLeft: 4 }}>
                        {dateLabel}
                    </CustomText>
                </View>
                {typeof event.location === 'string' && event.location && event.location !== 'To be decided' && (
                    <View style={tw`flex-row items-center mt-1`}>
                        <Ionicons name="location-outline" size={11} color="#94A3B8" />
                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11, marginLeft: 4 }} numberOfLines={1}>
                            {event.location}
                        </CustomText>
                    </View>
                )}
            </View>
            <View style={tw`items-end pr-4`}>
                <View style={[tw`px-2.5 py-1 rounded-full mb-1.5`, { backgroundColor: accentColor + '15' }]}>
                    <CustomText fontFamily="bold" style={{ fontSize: 10, color: accentColor }}>
                        {typeof event.eventType === 'string' ? event.eventType : 'Event'}
                    </CustomText>
                </View>
                {isShared && (
                    <View style={tw`flex-row items-center`}>
                        <Ionicons name="people-outline" size={11} color="#8B5CF6" />
                        <CustomText fontFamily="medium" style={{ fontSize: 10, color: '#8B5CF6', marginLeft: 3 }}>Shared</CustomText>
                    </View>
                )}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginRight: 12 }} />
        </TouchableOpacity>
    );
};