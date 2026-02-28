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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
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
    Others:         '#8B5CF6',
};

// ── SCREEN ─────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
    const [userData, setUserData]   = useState(null);
    const [allEvents, setAllEvents] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [greeting, setGreeting]   = useState('');
    const [emoji, setEmoji]         = useState('');
    const [notifVisible, setNotifVisible] = useState(false);
    const [menuVisible, setMenuVisible]   = useState(false);

    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const slideAnim  = useRef(new Animated.Value(width)).current;
    const heroSlide  = useRef(new Animated.Value(24)).current;

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

        const q = query(
            collection(db, 'events'),
            or(
                where('userId', '==', user.uid),
                where('collaborators', 'array-contains', user.email?.toLowerCase() || '')
            )
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllEvents(data);
            setLoading(false);
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(heroSlide, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
            ]).start();
        });

        return () => unsubscribe();
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
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive', onPress: async () => {
                    try { await signOut(auth); navigation.replace('Landing'); }
                    catch { Alert.alert('Error', 'Failed to logout.'); }
                },
            },
        ]);
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

    const markedDates = useMemo(() => {
        const marks = {};
        allEvents.forEach(event => {
            const start = parseDateToObj(event.startDate);
            const end   = event.isMultiDay && event.endDate ? parseDateToObj(event.endDate) : start;
            const color = EVENT_COLORS[event.eventType] || BRAND.primary;
            let curr = new Date(start);
            while (curr <= end) {
                const key     = curr.toISOString().split('T')[0];
                const isStart = curr.getTime() === start.getTime();
                const isEnd   = curr.getTime() === end.getTime();
                marks[key] = {
                    startingDay: isStart,
                    endingDay:   isEnd,
                    color:       isStart || isEnd ? color : color + '40',
                    textColor:   isStart || isEnd ? '#fff' : color,
                };
                curr.setDate(curr.getDate() + 1);
            }
        });
        return marks;
    }, [allEvents]);

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

                {/* Notification bell */}
                <TouchableOpacity
                    onPress={() => setNotifVisible(true)}
                    style={[
                        tw`w-10 h-10 rounded-full justify-center items-center`,
                        { backgroundColor: BRAND.primaryMid, borderWidth: 1, borderColor: BRAND.primary + '30' },
                    ]}
                >
                    <Ionicons name="notifications-outline" size={20} color={BRAND.primary} />
                </TouchableOpacity>
            </View>

            {/* ── SCROLLABLE CONTENT ─────────────────────────── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 20, paddingTop: 20 }}
            >

                {/* ── NEXT EVENT HERO ─────────────────────────── */}
                <Animated.View style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: heroSlide }],
                    marginBottom: 16,
                }}>
                    {nextEvent ? (
                        <TouchableOpacity
                            activeOpacity={0.93}
                            onPress={() => navigation.navigate('EventDetails', { eventId: nextEvent.id })}
                            style={[
                                tw`rounded-[26px] overflow-hidden`,
                                {
                                    shadowColor: BRAND.primary,
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.18,
                                    shadowRadius: 20,
                                    elevation: 6,
                                },
                            ]}
                        >
                            <View style={{ backgroundColor: BRAND.primaryBg, borderRadius: 26 }}>
                                <View style={{
                                    height: 5,
                                    backgroundColor: BRAND.primary,
                                    borderTopLeftRadius: 26,
                                    borderTopRightRadius: 26,
                                }} />

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
                                            <Ionicons
                                                name={EVENT_ICONS[nextEvent.eventType] || 'star'}
                                                size={13}
                                                color={EVENT_COLORS[nextEvent.eventType] || BRAND.primary}
                                            />
                                        </View>
                                        <CustomText fontFamily="semibold" style={{ color: '#64748B', fontSize: 12 }}>
                                            {typeof nextEvent.eventType === 'string' ? nextEvent.eventType : 'Event'}
                                        </CustomText>
                                    </View>

                                    <CustomText
                                        fontFamily="extrabold"
                                        style={{ color: '#0F172A', fontSize: 21, lineHeight: 27, marginBottom: 10 }}
                                        numberOfLines={2}
                                    >
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
                                            <CustomText
                                                fontFamily="semibold"
                                                style={{ color: '#334155', fontSize: 13, marginLeft: 7, flex: 1 }}
                                                numberOfLines={1}
                                            >
                                                {typeof nextEvent.location === 'string' ? nextEvent.location : ''}
                                            </CustomText>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('EventDetails', { eventId: nextEvent.id })}
                                        style={[
                                            tw`flex-row items-center justify-center py-3 rounded-[14px]`,
                                            {
                                                backgroundColor: BRAND.primary,
                                                shadowColor: BRAND.primaryDark,
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 8,
                                                elevation: 4,
                                            },
                                        ]}
                                    >
                                        <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 14 }}>
                                            View Details
                                        </CustomText>
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
                                {
                                    borderWidth: 2,
                                    borderColor: BRAND.primary,
                                    borderStyle: 'dashed',
                                    backgroundColor: BRAND.primaryFaint,
                                    minHeight: 140,
                                },
                            ]}
                        >
                            <View style={[tw`w-14 h-14 rounded-full justify-center items-center mb-3`, { backgroundColor: BRAND.primaryMid }]}>
                                <Ionicons name="add" size={28} color={BRAND.primary} />
                            </View>
                            <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 16 }}>
                                Plan Your First Event
                            </CustomText>
                            <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 13, marginTop: 3 }}>
                                Tap to get started
                            </CustomText>
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
                                {
                                    backgroundColor: '#FFFFFF',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    borderStyle: 'dashed',
                                },
                            ]}>
                                <Ionicons name="calendar-outline" size={28} color="#CBD5E1" style={{ marginBottom: 8 }} />
                                <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 13 }}>
                                    No more events scheduled
                                </CustomText>
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('AddEvent')}
                                    style={[tw`mt-3 px-5 py-2 rounded-full`, { backgroundColor: BRAND.primaryMid }]}
                                >
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 12 }}>
                                        + Add Event
                                    </CustomText>
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </Animated.View>

                {/* ── EXPLORE VENDORS ───────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, marginTop: 16 }}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>
                            Explore Vendors
                        </CustomText>
                        <TouchableOpacity onPress={() => navigation.navigate('VendorScreen')}>
                            <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13 }}>
                                View All
                            </CustomText>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('VendorScreen')}
                        style={[
                            tw`bg-white rounded-[22px] flex-row items-center p-4`,
                            {
                                shadowColor: BRAND.primary,
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.09,
                                shadowRadius: 12,
                                elevation: 3,
                            },
                        ]}
                    >
                        <View style={[tw`w-14 h-14 rounded-2xl justify-center items-center mr-4`, { backgroundColor: BRAND.primaryMid }]}>
                            <Ionicons name="storefront-outline" size={26} color={BRAND.primary} />
                        </View>
                        
                        <View style={tw`flex-1`}>
                            <CustomText fontFamily="bold" style={tw`text-[16px] text-slate-800`}>
                                Vendor Directory
                            </CustomText>
                            <CustomText fontFamily="medium" style={tw`text-[12px] text-slate-500 mt-0.5`}>
                                Find trusted vendors for your event needs
                            </CustomText>
                        </View>

                        <View style={[tw`w-8 h-8 rounded-full justify-center items-center`, { backgroundColor: BRAND.primaryBg }]}>
                            <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* ── CALENDAR ────────────────────────────────── */}
                <Animated.View style={{ opacity: fadeAnim, marginTop: 16 }}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 17 }}>
                            Event Calendar
                        </CustomText>
                    </View>

                    <View style={[
                        tw`bg-white rounded-[24px] overflow-hidden`,
                        {
                            shadowColor: '#64748B',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.07,
                            shadowRadius: 12,
                            elevation: 3,
                        },
                    ]}>
                        <Calendar
                            markingType="period"
                            theme={calendarTheme}
                            markedDates={markedDates}
                        />

                        {/* Color legend */}
                        <View style={tw`px-4 pb-4`}>
                            <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
                                <CustomText fontFamily="semibold" style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 0.8, marginBottom: 7 }}>
                                    EVENT TYPES
                                </CustomText>
                                <View style={tw`flex-row flex-wrap`}>
                                    {Object.entries(EVENT_COLORS).map(([type, color]) => (
                                        <View key={type} style={tw`flex-row items-center mr-4 mb-1`}>
                                            <View style={[tw`w-2 h-2 rounded-full mr-1.5`, { backgroundColor: color }]} />
                                            <CustomText fontFamily="medium" style={{ color: '#64748B', fontSize: 11 }}>
                                                {type}
                                            </CustomText>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>
                </Animated.View>

            </ScrollView>

            <NotificationModal visible={notifVisible} onClose={() => setNotifVisible(false)} />

            {/* ── SIDE DRAWER ─────────────────────────────────── */}
            {menuVisible && (
                <View style={tw`absolute inset-0 z-50`} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                        <View style={tw`absolute inset-0 bg-slate-900/40`} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[
                        tw`absolute top-0 right-0 bottom-0 bg-white rounded-l-[32px] px-6 pt-16`,
                        {
                            width: width * 0.75,
                            transform: [{ translateX: slideAnim }],
                            shadowColor: '#000',
                            shadowOffset: { width: -10, height: 0 },
                            shadowOpacity: 0.1,
                            shadowRadius: 20,
                        },
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
                            <TouchableOpacity
                                style={tw`flex-row items-center py-4`}
                                onPress={() => { toggleMenu(false); navigation.navigate('Profile'); }}
                            >
                                <View style={[tw`w-12 h-12 rounded-2xl justify-center items-center mr-4`, { backgroundColor: BRAND.primaryMid }]}>
                                    <Ionicons name="person-outline" size={20} color={BRAND.primary} />
                                </View>
                                <CustomText fontFamily="semibold" style={tw`text-[16px] text-slate-700`}>
                                    Profile Settings
                                </CustomText>
                            </TouchableOpacity>
                            <TouchableOpacity style={tw`flex-row items-center py-4`} onPress={handleLogout}>
                                <View style={tw`w-12 h-12 rounded-2xl bg-red-50 justify-center items-center mr-4`}>
                                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                                </View>
                                <CustomText fontFamily="semibold" style={tw`text-[16px] text-red-500`}>
                                    Log Out
                                </CustomText>
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
    const accentColor = isShared
        ? '#8B5CF6'
        : EVENT_COLORS[event.eventType] || BRAND.primary;

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
                {
                    shadowColor: '#64748B',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                },
            ]}
        >
            {/* Left color bar */}
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: accentColor }} />

            {/* Day countdown box */}
            <View style={[
                tw`items-center justify-center mx-4`,
                { width: 44, height: 44, borderRadius: 12, backgroundColor: accentColor + '15' },
            ]}>
                <CustomText fontFamily="extrabold" style={{ fontSize: 16, color: accentColor, lineHeight: 19 }}>
                    {days === 0 ? '🎉' : String(days)}
                </CustomText>
                {days !== 0 && (
                    <CustomText fontFamily="medium" style={{ fontSize: 9, color: accentColor }}>
                        {days === 1 ? 'day' : 'days'}
                    </CustomText>
                )}
            </View>

            {/* Event info */}
            <View style={tw`flex-1 py-3.5 pr-3`}>
                <CustomText
                    fontFamily="bold"
                    style={{ color: '#0F172A', fontSize: 14, marginBottom: 3 }}
                    numberOfLines={1}
                >
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
                        <CustomText
                            fontFamily="medium"
                            style={{ color: '#94A3B8', fontSize: 11, marginLeft: 4 }}
                            numberOfLines={1}
                        >
                            {event.location}
                        </CustomText>
                    </View>
                )}
            </View>

            {/* Right: type badge + shared label */}
            <View style={tw`items-end pr-4`}>
                <View style={[tw`px-2.5 py-1 rounded-full mb-1.5`, { backgroundColor: accentColor + '15' }]}>
                    <CustomText fontFamily="bold" style={{ fontSize: 10, color: accentColor }}>
                        {typeof event.eventType === 'string' ? event.eventType : 'Event'}
                    </CustomText>
                </View>
                {isShared && (
                    <View style={tw`flex-row items-center`}>
                        <Ionicons name="people-outline" size={11} color="#8B5CF6" />
                        <CustomText fontFamily="medium" style={{ fontSize: 10, color: '#8B5CF6', marginLeft: 3 }}>
                            Shared
                        </CustomText>
                    </View>
                )}
            </View>

            <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginRight: 12 }} />
        </TouchableOpacity>
    );
};

// ── CALENDAR THEME ──────────────────────────────────────────
const calendarTheme = {
    calendarBackground:         '#ffffff',
    todayTextColor:             BRAND.primary,
    todayBackgroundColor:       BRAND.primaryMid,
    dayTextColor:               '#334155',
    monthTextColor:             '#0f172a',
    arrowColor:                 BRAND.primary,
    textDayFontFamily:          'Poppins-Medium',
    textMonthFontFamily:        'Poppins-Bold',
    textDayHeaderFontFamily:    'Poppins-SemiBold',
    textMonthFontWeight:        'bold',
    textDayHeaderFontWeight:    '600',
    selectedDayBackgroundColor: BRAND.primary,
    selectedDayTextColor:       '#ffffff',
    'stylesheet.calendar.header': {
        header: {
            flexDirection:  'row',
            justifyContent: 'space-between',
            paddingLeft:    10,
            paddingRight:   10,
            marginTop:      6,
            alignItems:     'center',
        },
    },
};