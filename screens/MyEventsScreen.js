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
    const fadeAnim = useRef(new Animated.Value(0)).current;

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

        return result.sort((a, b) => {
            const aDate = parseDateToObj(a.startDate);
            const bDate = parseDateToObj(b.startDate);
            if (!aDate) return 1;
            if (!bDate) return -1;
            return aDate - bDate;
        });
    }, [allEvents, activeFilter, search]);

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
            <View style={tw`flex-1 justify-center items-center bg-[#F8FAFC]`}>
                <ActivityIndicator size="large" color="#00686F" />
            </View>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`} edges={['top']}>

            {/* HEADER */}
            <View style={tw`px-6 pt-4 pb-3`}>
                <CustomText fontFamily="extrabold" style={tw`text-2xl text-slate-800 tracking-tight`}>
                    My Events
                </CustomText>
                <CustomText fontFamily="medium" style={tw`text-slate-400 text-[13px] mt-0.5`}>
                    All your upcoming and past events
                </CustomText>
            </View>

            {/* STATS ROW */}
            <Animated.View style={[{ opacity: fadeAnim }, tw`px-6 mb-4`]}>
                <View style={tw`flex-row`}>
                    <StatCard label="Total" value={stats.total} icon="layers-outline" color="#00686F" />
                    <View style={tw`w-3`} />
                    <StatCard label="Upcoming" value={stats.upcoming} icon="time-outline" color="#F59E0B" />
                    <View style={tw`w-3`} />
                    <StatCard label="Shared" value={stats.shared} icon="people-outline" color="#8B5CF6" />
                </View>
            </Animated.View>

            {/* SEARCH BAR */}
            <View style={tw`px-6 mb-4`}>
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

            {/* FILTER TABS — fixed row with consistent pill sizing */}
            <View style={tw`px-6 mb-4`}>
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

            {/* EVENT LIST */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={tw`px-6 pb-28`}
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

    const accentColor = isPast ? '#94A3B8' : isShared ? '#8B5CF6' : '#00686F';

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