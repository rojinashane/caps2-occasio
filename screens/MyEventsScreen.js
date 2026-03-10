import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    TextInput,
    RefreshControl,
    Alert,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebase';
import {
    collection,
    query,
    onSnapshot,
    or,
    where,
    doc,
    deleteDoc,
} from 'firebase/firestore';
import tw from 'twrnc';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── BRAND ────────────────────────────────────────────────────
const BRAND = {
    primary:      '#00686F',
    primaryDark:  '#004E54',
    primaryMid:   '#E0F2F3',
    primaryFaint: '#F0F9FA',
};

// ── EVENT TYPE COLORS (mirrors AddEvent.js exactly) ──────────
const EVENT_TYPE_COLORS = {
    'Wedding':        '#E8626A',
    'Birthday Party': '#F59E0B',
    'Corporate':      '#3B82F6',
    'Charity':        '#10B981',
    'Others':         '#f65cb3',
};
const DEFAULT_EVENT_COLOR = BRAND.primary;

const getEventColor = (eventType) =>
    EVENT_TYPE_COLORS[eventType] || DEFAULT_EVENT_COLOR;

// ── CALENDAR HELPERS ─────────────────────────────────────────
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES  = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
];

// --- UTILITY ---
const toDate = (val) => {
    if (!val) return null;
    if (val && typeof val === 'object' && 'seconds' in val) {
        return new Date(val.seconds * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

const parseDateToObj = (val) => {
    const d = toDate(val);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const formatDate = (val) => {
    const d = toDate(val);
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'shared', label: 'Shared' },
];

export default function MyEventsScreen({ navigation }) {
    const [allEvents, setAllEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [calendarVisible, setCalendarVisible] = useState(true);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(null);
    const calendarAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const toggleCalendar = () => {
        const toVal = calendarVisible ? 0 : 1;
        setCalendarVisible(v => !v);
        Animated.spring(calendarAnim, {
            toValue: toVal, tension: 70, friction: 14, useNativeDriver: false,
        }).start();
    };

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
            const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllEvents(rawData);
            setLoading(false);
            setRefreshing(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        });

        return () => unsubscribe();
    }, []);

    // Map: 'YYYY-MM-DD' → array of events on that date
    const eventsByDate = useMemo(() => {
        const map = {};
        allEvents.forEach(e => {
            const start = parseDateToObj(e.startDate);
            if (!start) return;
            // For multi-day events, fill every date in the range
            const end = e.isMultiDay && e.endDate ? parseDateToObj(e.endDate) : start;
            const cur = new Date(start);
            while (cur <= end) {
                const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
                if (!map[key]) map[key] = [];
                map[key].push(e);
                cur.setDate(cur.getDate() + 1);
            }
        });
        return map;
    }, [allEvents]);

    const filteredEvents = useMemo(() => {
        const todayMs = new Date().setHours(0, 0, 0, 0);
        const user = auth.currentUser;
        if (!user) return [];

        let result = [...allEvents];

        if (activeFilter === 'upcoming') {
            result = result.filter(e => {
                const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
                return end && end.getTime() >= todayMs;
            });
        } else if (activeFilter === 'past') {
            result = result.filter(e => {
                const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
                return end && end.getTime() < todayMs;
            });
        } else if (activeFilter === 'shared') {
            result = result.filter(e => e.userId !== user.uid);
        }

        if (search.trim()) {
            const sq = search.toLowerCase();
            result = result.filter(e =>
                (e.title || '').toLowerCase().includes(sq) ||
                (e.eventType || '').toLowerCase().includes(sq) ||
                (e.location || '').toLowerCase().includes(sq)
            );
        }

        // If user tapped a day on the calendar, filter to events on that day
        if (selectedDay) {
            const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
            const ids = new Set((eventsByDate[key] || []).map(e => e.id));
            result = result.filter(e => ids.has(e.id));
        }

        return result.sort((a, b) => {
            const aDate = parseDateToObj(a.startDate);
            const bDate = parseDateToObj(b.startDate);
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });
    }, [allEvents, activeFilter, search, selectedDay, eventsByDate]);

    const stats = useMemo(() => {
        const todayMs = new Date().setHours(0, 0, 0, 0);
        const user = auth.currentUser;
        const upcoming = allEvents.filter(e => {
            const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
            return end && end.getTime() >= todayMs;
        }).length;
        const shared = allEvents.filter(e => e.userId !== user?.uid).length;
        return { total: allEvents.length, upcoming, shared };
    }, [allEvents]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F8' }}>
                <ActivityIndicator size="large" color={BRAND.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4F8' }} edges={['top']}>

            {/* ── HEADER ──────────────────────────────────── */}
            <View style={{
                paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F0F4F8',
                borderBottomWidth: 1, borderBottomColor: '#E8EEF4',
            }}>
                <View style={{ flex: 1 }}>
                    <CustomText fontFamily="extrabold" style={{ color: BRAND.primary, fontSize: 11, letterSpacing: 1.5 }}>
                        OCCASIO
                    </CustomText>
                    <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 20 }}>
                        My Events
                    </CustomText>
                </View>
                {/* Calendar toggle — pill with animated icon */}
                <TouchableOpacity
                    onPress={toggleCalendar}
                    activeOpacity={0.8}
                    style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: calendarVisible ? BRAND.primary : '#FFF',
                        borderWidth: 1.5,
                        borderColor: calendarVisible ? BRAND.primary : BRAND.primaryMid,
                        shadowColor: BRAND.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: calendarVisible ? 0.25 : 0.06,
                        shadowRadius: 6, elevation: calendarVisible ? 3 : 1,
                    }}
                >
                    <Ionicons
                        name={calendarVisible ? 'calendar' : 'calendar-outline'}
                        size={14}
                        color={calendarVisible ? '#FFF' : BRAND.primary}
                    />
                    <CustomText
                        fontFamily="bold"
                        style={{ color: calendarVisible ? '#FFF' : BRAND.primary, fontSize: 12, marginLeft: 6 }}
                    >
                        {calendarVisible ? 'Hide' : 'Calendar'}
                    </CustomText>
                </TouchableOpacity>
            </View>

            {/* ── COLLAPSIBLE CALENDAR ────────────────────── */}
            <Animated.View style={{
                overflow: 'hidden',
                maxHeight: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 700] }),
                opacity: calendarAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
            }}>
                <EventCalendar
                    events={allEvents}
                    eventsByDate={eventsByDate}
                    calendarDate={calendarDate}
                    setCalendarDate={setCalendarDate}
                    selectedDay={selectedDay}
                    setSelectedDay={(day) => {
                        if (selectedDay && day &&
                            selectedDay.getFullYear() === day.getFullYear() &&
                            selectedDay.getMonth() === day.getMonth() &&
                            selectedDay.getDate() === day.getDate()) {
                            setSelectedDay(null);
                        } else {
                            setSelectedDay(day);
                        }
                    }}
                />
            </Animated.View>

            {/* STATS ROW */}
            <Animated.View style={[{ opacity: fadeAnim }, { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 }]}>
                <View style={tw`flex-row`}>
                    <StatCard label="Total" value={stats.total} icon="layers-outline" color="#00686F" />
                    <View style={tw`w-3`} />
                    <StatCard label="Upcoming" value={stats.upcoming} icon="time-outline" color="#F59E0B" />
                    <View style={tw`w-3`} />
                    <StatCard label="Shared" value={stats.shared} icon="people-outline" color="#8B5CF6" />
                </View>
            </Animated.View>

            {/* SEARCH BAR */}
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
                <View style={[
                    tw`flex-row items-center bg-white border border-slate-100 rounded-[16px] px-4 py-3`,
                    { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }
                ]}>
                    <Ionicons name="search-outline" size={18} color="#94A3B8" />
                    <TextInput
                        style={[tw`flex-1 ml-3 text-[14px] text-slate-700`, { fontFamily: 'Poppins-Medium' }]}
                        placeholder="Search events..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* FILTER TABS */}
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 }}>
                <View style={tw`flex-row`}>
                    {FILTERS.map((filter, index) => {
                        const isActive = activeFilter === filter.key;
                        return (
                            <TouchableOpacity
                                key={filter.key}
                                onPress={() => setActiveFilter(filter.key)}
                                style={[
                                    {
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        borderRadius: 999,
                                        marginRight: index < FILTERS.length - 1 ? 8 : 0,
                                        backgroundColor: isActive ? '#00686F' : '#FFFFFF',
                                        borderWidth: 1,
                                        borderColor: isActive ? '#00686F' : '#E2E8F0',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }
                                ]}
                            >
                                <CustomText
                                    fontFamily={isActive ? 'bold' : 'medium'}
                                    style={{
                                        fontSize: 12,
                                        lineHeight: 16,
                                        color: isActive ? '#FFFFFF' : '#64748B',
                                    }}
                                >
                                    {filter.label}
                                </CustomText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* SELECTED DAY BANNER */}
            {selectedDay && (
                <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    marginHorizontal: 20, marginBottom: 6,
                    paddingHorizontal: 14, paddingVertical: 9,
                    backgroundColor: BRAND.primaryFaint,
                    borderRadius: 14,
                    borderWidth: 1, borderColor: BRAND.primaryMid,
                }}>
                    <Ionicons name="calendar" size={14} color={BRAND.primary} />
                    <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 13, marginLeft: 7, flex: 1 }}>
                        {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </CustomText>
                    <TouchableOpacity onPress={() => setSelectedDay(null)} style={{ padding: 2 }}>
                        <Ionicons name="close-circle" size={16} color={BRAND.primary + '88'} />
                    </TouchableOpacity>
                </View>
            )}

            {/* EVENT LIST */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110, paddingTop: 4 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => setRefreshing(true)}
                        tintColor="#00686F"
                    />
                }
            >
                {filteredEvents.length > 0 ? (
                    <>
                        <CustomText fontFamily="medium" style={tw`text-slate-400 text-[12px] mb-3`}>
                            {`${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''} found`}
                        </CustomText>
                        {filteredEvents.map(item => (
                            <EventCard
                                key={item.id}
                                item={item}
                                navigation={navigation}
                                onDelete={async () => {
                                    Alert.alert(
                                        'Delete Event',
                                        `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
                                        [
                                            { text: 'Cancel', style: 'cancel' },
                                            {
                                                text: 'Delete',
                                                style: 'destructive',
                                                onPress: async () => {
                                                    try {
                                                        await deleteDoc(doc(db, 'events', item.id));
                                                    } catch (e) {
                                                        Alert.alert('Error', 'Could not delete the event. Please try again.');
                                                    }
                                                },
                                            },
                                        ]
                                    );
                                }}
                            />
                        ))}
                    </>
                ) : (
                    <View style={tw`items-center justify-center mt-10 p-8 bg-white rounded-[24px] border border-slate-200 border-dashed`}>
                        <View style={tw`w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-4`}>
                            <Ionicons name="calendar-clear-outline" size={32} color="#94A3B8" />
                        </View>
                        <CustomText fontFamily="bold" style={tw`text-slate-700 text-[16px] mb-1`}>
                            No Events Found
                        </CustomText>
                        <CustomText fontFamily="medium" style={tw`text-slate-400 text-[13px] text-center`}>
                            {search
                                ? 'Try a different search term.'
                                : 'Tap the + button to create a new event.'}
                        </CustomText>
                    </View>
                )}
            </ScrollView>

            <BottomNav navigation={navigation} activeRoute="MyEvents" />
        </SafeAreaView>
    );
}

// --- SUB-COMPONENTS ---

// ── EVENT CALENDAR ───────────────────────────────────────────
const EventCalendar = ({ events: allEvents, eventsByDate, calendarDate, setCalendarDate, selectedDay, setSelectedDay }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const year  = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    // Only upcoming events shown on calendar
    const upcomingEvents = allEvents.filter(e => {
        const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
        return end && end.getTime() >= today.getTime();
    });

    // Build grid
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth     = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ date: new Date(year, month, d), outside: false });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        cells.push({ date: new Date(year, month + 1, d), outside: true });
    }

    const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

    const cellSize = Math.floor((SCREEN_WIDTH - 40 - 32) / 7);

    // Upcoming events on selected day (for popup)
    const selectedDayEvents = selectedDay
        ? (() => {
            const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
            return (eventsByDate[key] || []).filter(e => {
                const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
                return end && end.getTime() >= today.getTime();
            });
        })()
        : [];

    return (
        <View style={{
            marginHorizontal: 16, marginTop: 12, marginBottom: 4,
            backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden',
            shadowColor: BRAND.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
        }}>
            {/* Top accent stripe */}
            <View style={{ height: 4, backgroundColor: BRAND.primary }} />

            <View style={{ padding: 16 }}>
                {/* Month navigation */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <TouchableOpacity
                        onPress={prevMonth}
                        style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: BRAND.primaryFaint,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: BRAND.primaryMid,
                        }}
                    >
                        <Ionicons name="chevron-back" size={16} color={BRAND.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setCalendarDate(new Date())}>
                        <View style={{ alignItems: 'center' }}>
                            <CustomText fontFamily="extrabold" style={{ color: '#0F172A', fontSize: 15 }}>
                                {MONTH_NAMES[month]}
                            </CustomText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 11 }}>
                                    {year}
                                </CustomText>
                                <View style={{
                                    marginLeft: 6, backgroundColor: BRAND.primaryMid,
                                    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
                                }}>
                                    <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 8, letterSpacing: 0.5 }}>
                                        TAP TO RESET
                                    </CustomText>
                                </View>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={nextMonth}
                        style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: BRAND.primaryFaint,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 1, borderColor: BRAND.primaryMid,
                        }}
                    >
                        <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
                    </TouchableOpacity>
                </View>

                {/* Day-of-week headers */}
                <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                    {DAYS_OF_WEEK.map(d => (
                        <View key={d} style={{ width: cellSize, alignItems: 'center' }}>
                            <CustomText fontFamily="bold" style={{ color: '#94A3B8', fontSize: 10, letterSpacing: 0.5 }}>
                                {d}
                            </CustomText>
                        </View>
                    ))}
                </View>

                {/* Calendar grid — 6 rows × 7 cols */}
                {Array.from({ length: 6 }).map((_, rowIdx) => {
                    const rowCells = cells.slice(rowIdx * 7, rowIdx * 7 + 7);

                    // Only upcoming multi-day spans
                    const multiDaySpans = [];
                    const seenIds = new Set();

                    upcomingEvents.forEach(e => {
                        if (!e.isMultiDay || !e.endDate) return;
                        const evStart = parseDateToObj(e.startDate);
                        const evEnd   = parseDateToObj(e.endDate);
                        if (!evStart || !evEnd) return;

                        // Find which cols in this row this event occupies
                        let colStart = -1, colEnd = -1;
                        rowCells.forEach((cell, ci) => {
                            if (cell.outside) return;
                            if (cell.date >= evStart && cell.date <= evEnd) {
                                if (colStart === -1) colStart = ci;
                                colEnd = ci;
                            }
                        });
                        if (colStart === -1) return;
                        if (seenIds.has(e.id)) return;
                        seenIds.add(e.id);

                        // Is this the true first/last day of the event?
                        const isFirstDay = rowCells[colStart]?.date?.getTime() === evStart.getTime();
                        const isLastDay  = rowCells[colEnd]?.date?.getTime() === evEnd.getTime();

                        multiDaySpans.push({
                            id: e.id,
                            color: getEventColor(e.eventType),
                            colStart,
                            colEnd,
                            isFirstDay,
                            isLastDay,
                            title: e.title,
                        });
                    });

                    const BAR_HEIGHT = 14;
                    const BAR_GAP    = 2;
                    const visibleSpans = multiDaySpans.slice(0, 2);
                    const rowHasBars   = visibleSpans.length > 0;
                    const barsHeight   = rowHasBars ? visibleSpans.length * (BAR_HEIGHT + BAR_GAP) + 4 : 0;

                    return (
                        <View key={rowIdx} style={{ marginBottom: 2 }}>
                            {/* Day number row */}
                            <View style={{ flexDirection: 'row' }}>
                                {rowCells.map((cell, colIdx) => {
                                    const { date, outside } = cell;
                                    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                                    const eventsOnDay = eventsByDate[dateKey] || [];
                                    const isPastDay = !outside && date.getTime() < today.getTime();

                                    // Only upcoming single-day events get dots
                                    const upcomingOnDay = eventsOnDay.filter(e => {
                                        const end = parseDateToObj(e.endDate) || parseDateToObj(e.startDate);
                                        return end && end.getTime() >= today.getTime();
                                    });
                                    const singleDayUpcoming = upcomingOnDay.filter(e => !e.isMultiDay || !e.endDate);
                                    const dotColors = [...new Map(
                                        singleDayUpcoming.map(e => [e.eventType, getEventColor(e.eventType)])
                                    ).values()].slice(0, 3);

                                    const isToday =
                                        date.getFullYear() === today.getFullYear() &&
                                        date.getMonth()    === today.getMonth() &&
                                        date.getDate()     === today.getDate();

                                    const isSelected = selectedDay &&
                                        date.getFullYear() === selectedDay.getFullYear() &&
                                        date.getMonth()    === selectedDay.getMonth() &&
                                        date.getDate()     === selectedDay.getDate();

                                    return (
                                        <TouchableOpacity
                                            key={colIdx}
                                            onPress={() => !outside && setSelectedDay(date)}
                                            activeOpacity={outside ? 1 : 0.7}
                                            style={{ width: cellSize, alignItems: 'center', paddingTop: 3, paddingBottom: 2 }}
                                        >
                                            {/* Day number circle */}
                                            <View style={{
                                                width: 28, height: 28, borderRadius: 14,
                                                alignItems: 'center', justifyContent: 'center',
                                                backgroundColor: isSelected ? BRAND.primary
                                                    : isToday ? BRAND.primaryMid : 'transparent',
                                                borderWidth: isToday && !isSelected ? 1.5 : 0,
                                                borderColor: BRAND.primary,
                                            }}>
                                                <CustomText
                                                    fontFamily={isToday || isSelected ? 'bold' : 'medium'}
                                                    style={{
                                                        fontSize: 12,
                                                        color: isSelected ? '#FFF'
                                                            : outside ? '#CBD5E1'
                                                            : isPastDay ? '#CBD5E1'
                                                            : isToday ? BRAND.primary
                                                            : '#334155',
                                                    }}
                                                >
                                                    {date.getDate()}
                                                </CustomText>
                                            </View>

                                            {/* Upcoming event dots */}
                                            {dotColors.length > 0 && !outside && (
                                                <View style={{ flexDirection: 'row', marginTop: 2, gap: 2 }}>
                                                    {dotColors.map((color, i) => (
                                                        <View key={i} style={{
                                                            width: isSelected ? 5 : 4,
                                                            height: isSelected ? 5 : 4,
                                                            borderRadius: 3,
                                                            backgroundColor: isSelected ? '#FFF' : color,
                                                        }} />
                                                    ))}
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Multi-day span bars */}
                            {rowHasBars && (
                                <View style={{ paddingHorizontal: 0, marginBottom: 2 }}>
                                    {visibleSpans.map((span, laneIdx) => {
                                        const barLeft  = span.colStart * cellSize;
                                        const barWidth = (span.colEnd - span.colStart + 1) * cellSize;
                                        const isFirst  = span.isFirstDay;
                                        const isLast   = span.isLastDay;
                                        const top      = laneIdx * (BAR_HEIGHT + BAR_GAP);

                                        return (
                                            <TouchableOpacity
                                                key={span.id}
                                                onPress={() => {
                                                    const e = upcomingEvents.find(ev => ev.id === span.id);
                                                    if (e) setSelectedDay(parseDateToObj(e.startDate));
                                                }}
                                                activeOpacity={0.75}
                                                style={{
                                                    position: 'absolute',
                                                    top,
                                                    left: barLeft + (isFirst ? 3 : 0),
                                                    width: barWidth - (isFirst ? 3 : 0) - (isLast ? 3 : 0),
                                                    height: BAR_HEIGHT,
                                                    backgroundColor: span.color,
                                                    borderTopLeftRadius:     isFirst ? 7 : 0,
                                                    borderBottomLeftRadius:  isFirst ? 7 : 0,
                                                    borderTopRightRadius:    isLast  ? 7 : 0,
                                                    borderBottomRightRadius: isLast  ? 7 : 0,
                                                    justifyContent: 'center',
                                                    paddingHorizontal: 5,
                                                    overflow: 'hidden',
                                                    opacity: 0.88,
                                                }}
                                            >
                                                {isFirst && (
                                                    <CustomText
                                                        fontFamily="bold"
                                                        numberOfLines={1}
                                                        style={{ color: '#FFF', fontSize: 8, letterSpacing: 0.2 }}
                                                    >
                                                        {span.title}
                                                    </CustomText>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {/* Spacer so bars don't overlap next row */}
                                    <View style={{ height: barsHeight }} />
                                </View>
                            )}
                        </View>
                    );
                })}


                {/* ── SELECTED DAY EVENT POPUP ─────────────── */}
                {selectedDay && selectedDayEvents.length > 0 && (
                    <View style={{
                        marginTop: 10,
                        backgroundColor: BRAND.primaryFaint,
                        borderRadius: 14,
                        borderWidth: 1, borderColor: BRAND.primaryMid,
                        overflow: 'hidden',
                    }}>
                        <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: BRAND.primaryMid,
                            paddingHorizontal: 12, paddingVertical: 7,
                        }}>
                            <Ionicons name="calendar" size={12} color={BRAND.primary} />
                            <CustomText fontFamily="bold" style={{ color: BRAND.primary, fontSize: 11, marginLeft: 6, flex: 1 }}>
                                {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </CustomText>
                            <View style={{ backgroundColor: BRAND.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 9 }}>
                                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
                                </CustomText>
                            </View>
                        </View>
                        {selectedDayEvents.map((e, i) => {
                            const color = getEventColor(e.eventType);
                            return (
                                <View key={e.id} style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    paddingHorizontal: 12, paddingVertical: 8,
                                    borderTopWidth: i === 0 ? 0 : 1,
                                    borderTopColor: BRAND.primaryMid,
                                }}>
                                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, marginRight: 10 }} />
                                    <CustomText fontFamily="semibold" style={{ flex: 1, color: '#1E293B', fontSize: 12 }} numberOfLines={1}>
                                        {e.title}
                                    </CustomText>
                                    <View style={{
                                        backgroundColor: color + '20', borderRadius: 8,
                                        paddingHorizontal: 8, paddingVertical: 3,
                                        borderWidth: 1, borderColor: color + '40',
                                    }}>
                                        <CustomText fontFamily="bold" style={{ color, fontSize: 9 }}>
                                            {e.eventType || 'Event'}
                                        </CustomText>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* ── LEGEND ────────────────────────────────── */}
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <CustomText fontFamily="bold" style={{ color: '#94A3B8', fontSize: 9, letterSpacing: 1.2, marginBottom: 8 }}>
                        EVENT TYPES
                    </CustomText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => {
                            const count = upcomingEvents.filter(e => getEventColor(e.eventType) === color).length;
                            return (
                                <View key={type} style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                                    backgroundColor: color + '14', borderWidth: 1, borderColor: color + '35',
                                }}>
                                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, marginRight: 5 }} />
                                    <CustomText fontFamily="semibold" style={{ color, fontSize: 11 }}>{type}</CustomText>
                                    {count > 0 && (
                                        <View style={{ marginLeft: 5, backgroundColor: color + '25', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                            <CustomText fontFamily="bold" style={{ color, fontSize: 9 }}>{count}</CustomText>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#64748B14', borderWidth: 1, borderColor: '#64748B35' }}>
                            <View style={{ width: 16, height: 7, borderRadius: 4, backgroundColor: '#64748B', marginRight: 5 }} />
                            <CustomText fontFamily="semibold" style={{ color: '#64748B', fontSize: 11 }}>Multi-day</CustomText>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: BRAND.primaryFaint, borderWidth: 1.5, borderColor: BRAND.primary }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: BRAND.primary, marginRight: 5 }} />
                            <CustomText fontFamily="semibold" style={{ color: BRAND.primary, fontSize: 11 }}>Today</CustomText>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: BRAND.primary }}>
                            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFF', marginRight: 5 }} />
                            <CustomText fontFamily="semibold" style={{ color: '#FFF', fontSize: 11 }}>Selected</CustomText>
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
};

const StatCard = ({ label, value, icon, color }) => (
    <View style={[
        tw`flex-1 bg-white rounded-[16px] p-3 items-center border border-slate-100`,
        { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }
    ]}>
        <View style={[tw`w-9 h-9 rounded-full justify-center items-center mb-1.5`, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={18} color={color} />
        </View>
        <CustomText fontFamily="extrabold" style={{ fontSize: 18, color }}>{String(value)}</CustomText>
        <CustomText fontFamily="medium" style={tw`text-slate-400 text-[10px] mt-0.5`}>{label}</CustomText>
    </View>
);

const EventCard = ({ item, navigation, onDelete }) => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const user = auth.currentUser;

    const startDate = parseDateToObj(item.startDate);
    const endDate = item.endDate ? parseDateToObj(item.endDate) : null;

    const isPast = (endDate || startDate)
        ? (endDate || startDate).getTime() < todayMs
        : false;
    const isShared = item.userId !== user?.uid;

    const startStr = formatDate(item.startDate);
    const endStr = item.endDate ? formatDate(item.endDate) : null;
    const dateLabel = endStr ? `${startStr} → ${endStr}` : startStr;
    const timeLabel = typeof item.startTime === 'string' ? item.startTime : '';
    const locationLabel = typeof item.location === 'string' ? item.location : '';
    const typeLabel = typeof item.eventType === 'string' ? item.eventType : 'Event';
    const titleLabel = typeof item.title === 'string' ? item.title : '';

    const accentColor = isPast ? '#94A3B8' : isShared ? '#8B5CF6' : getEventColor(item.eventType);

    return (
        <TouchableOpacity
            style={[
                tw`bg-white rounded-[20px] mb-3 overflow-hidden border border-slate-100`,
                { shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }
            ]}
            onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}
            activeOpacity={0.8}
        >
            {/* Top accent bar */}
            <View style={[tw`h-1 w-full`, { backgroundColor: accentColor }]} />

            <View style={tw`p-4`}>
                <View style={tw`flex-row items-start justify-between`}>
                    <View style={tw`flex-1 mr-3`}>
                        <CustomText fontFamily="bold" style={tw`text-[15px] text-slate-800 tracking-tight mb-1`} numberOfLines={1}>
                            {titleLabel}
                        </CustomText>

                        {dateLabel ? (
                            <View style={tw`flex-row items-center mb-1`}>
                                <Ionicons name="calendar-outline" size={13} color="#64748B" />
                                <CustomText fontFamily="medium" style={tw`text-slate-500 text-[12px] ml-1.5`}>
                                    {dateLabel}
                                </CustomText>
                            </View>
                        ) : null}

                        {timeLabel ? (
                            <View style={tw`flex-row items-center mb-1`}>
                                <Ionicons name="time-outline" size={13} color="#64748B" />
                                <CustomText fontFamily="medium" style={tw`text-slate-500 text-[12px] ml-1.5`}>
                                    {timeLabel}
                                </CustomText>
                            </View>
                        ) : null}

                        {locationLabel && locationLabel !== 'To be decided' ? (
                            <View style={tw`flex-row items-center`}>
                                <Ionicons name="location-outline" size={13} color="#64748B" />
                                <CustomText fontFamily="medium" style={tw`text-slate-500 text-[12px] ml-1.5`} numberOfLines={1}>
                                    {locationLabel}
                                </CustomText>
                            </View>
                        ) : null}
                    </View>

                    <View style={tw`items-end`}>
                        <View style={[tw`px-3 py-1 rounded-full mb-2`, { backgroundColor: accentColor + '15' }]}>
                            <CustomText fontFamily="bold" style={{ fontSize: 10, color: accentColor }}>
                                {typeLabel}
                            </CustomText>
                        </View>
                        <View style={tw`flex-row items-center gap-2`}>
                            {/* Delete button — only for event owner */}
                            {!isShared && (
                                <TouchableOpacity
                                    onPress={onDelete}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={tw`w-7 h-7 rounded-full bg-red-50 justify-center items-center`}
                                >
                                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                            <View style={tw`w-7 h-7 rounded-full bg-slate-50 justify-center items-center`}>
                                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Tags */}
                <View style={tw`flex-row flex-wrap mt-3 pt-3 border-t border-slate-50`}>
                    {isPast && (
                        <View style={[tw`flex-row items-center bg-slate-50 rounded-full`, { paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 }]}>
                            <Ionicons name="checkmark-circle-outline" size={11} color="#94A3B8" />
                            <CustomText fontFamily="medium" style={tw`text-slate-400 text-[10px] ml-1`}>Past</CustomText>
                        </View>
                    )}
                    {isShared && (
                        <View style={[tw`flex-row items-center bg-purple-50 rounded-full`, { paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 }]}>
                            <Ionicons name="people-outline" size={11} color="#8B5CF6" />
                            <CustomText fontFamily="medium" style={tw`text-purple-400 text-[10px] ml-1`}>Shared with me</CustomText>
                        </View>
                    )}
                    {item.isMultiDay && (
                        <View style={[tw`flex-row items-center bg-blue-50 rounded-full`, { paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 }]}>
                            <Ionicons name="calendar-outline" size={11} color="#3B82F6" />
                            <CustomText fontFamily="medium" style={tw`text-blue-400 text-[10px] ml-1`}>Multi-day</CustomText>
                        </View>
                    )}
                    {!isPast && !isShared && (
                        <View style={[tw`flex-row items-center rounded-full`, { backgroundColor: '#E0F2F3', paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 }]}>
                            <Ionicons name="time-outline" size={11} color="#00686F" />
                            <CustomText fontFamily="medium" style={tw`text-[#00686F] text-[10px] ml-1`}>Upcoming</CustomText>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};