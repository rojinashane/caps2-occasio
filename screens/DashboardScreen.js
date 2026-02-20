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
    Image,
    StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar } from 'react-native-calendars';
import CustomText from '../components/CustomText';
import DashboardHeader from '../components/Header';
import NotificationModal from '../components/NotificationModal';
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
    where
} from 'firebase/firestore';
import tw from 'twrnc';

const { width } = Dimensions.get('window');

// --- MOCK DATA FOR FEATURED SECTION ---
const FEATURED_VENUES = [
    {
        id: '1',
        name: "Lilia's Fortune Hall",
        location: 'Ricacho Subdivision, Sorsogon City',
        coordinates: { latitude: 12.973938, longitude: 124.005313 },
        capacity: '500 Pax',
        price: '₱50,000 / day',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800', // Updated placeholder for better visual
        hasAR: true,
    },
    {
        id: '2',
        name: "Hilda's Love Function Hall",
        location: 'Quezon Street, Sorsogon City',
        coordinates: { latitude: 12.9691, longitude: 124.0044 },
        capacity: '200 Pax',
        price: '₱35,000 / day',
        image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
        hasAR: true,
    },
    {
        id: '3',
        name: 'The Clover Leaf Place',
        location: 'El Retiro, Sorsogon City',
        coordinates: { latitude: 12.9622, longitude: 123.9961 },
        capacity: '50 Pax',
        price: '₱15,000 / day',
        image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800', // Updated placeholder for better visual
        hasAR: false,
    },
];

// --- UTILITY FUNCTIONS ---
const parseDateToObj = (dateVal) => {
    if (!dateVal) return new Date();
    let d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
    if (isNaN(d.getTime())) return new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DashboardScreen({ navigation }) {
    const [userData, setUserData] = useState(null);
    const [allEvents, setAllEvents] = useState([]);
    const [viewMode, setViewMode] = useState('list');
    const [currentFilter, setCurrentFilter] = useState('upcoming');
    const [loading, setLoading] = useState(true);
    const [greeting, setGreeting] = useState('');
    const [stats, setStats] = useState({ total: 0, upcoming3Months: 0, shared: 0 });
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [menuVisible, setMenuVisible] = useState(false);
    const [notifVisible, setNotifVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(width)).current;

    useFocusEffect(
        useCallback(() => {
            fetchUserData();
            setGreetingMessage();
        }, [])
    );

    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            const q = query(
                collection(db, 'events'),
                or(
                    where('userId', '==', user.uid),
                    where('collaborators', 'array-contains', user.email.toLowerCase())
                )
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllEvents(rawData);
                calculateStats(rawData, user.uid);
                setLoading(false);
                Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            });

            return () => unsubscribe();
        }
    }, []);

    const fetchUserData = async () => {
        const user = auth.currentUser;
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                setUserData(userDoc.data());
            }
        }
    };

    const toggleMenu = (open) => {
        if (open) {
            setMenuVisible(true);
            Animated.timing(slideAnim, {
                toValue: width * 0.25,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: width,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setMenuVisible(false));
        }
    };

    const handleLogout = () => {
        toggleMenu(false);
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive', onPress: async () => {
                    try {
                        await signOut(auth);
                        navigation.replace('Landing');
                    } catch (error) {
                        Alert.alert('Error', 'Failed to logout.');
                    }
                }
            }
        ]);
    };

    const calculateStats = (events, userId) => {
        const now = new Date().getTime();
        const threeMonths = now + (90 * 24 * 60 * 60 * 1000);
        let u3m = 0, shared = 0;
        events.forEach(e => {
            const start = parseDateToObj(e.startDate).getTime();
            if (e.userId !== userId) shared++;
            if (start >= now && start <= threeMonths) u3m++;
        });
        setStats({ total: events.length, upcoming3Months: u3m, shared });
    };

    const setGreetingMessage = () => {
        const hour = new Date().getHours();
        setGreeting(hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,');
    };

    const listData = useMemo(() => {
        const today = new Date().setHours(0, 0, 0, 0);
        const user = auth.currentUser;
        if (!user) return [];
        let filtered = [...allEvents];
        if (currentFilter === 'past') {
            filtered = filtered.filter(e => {
                const end = e.endDate ? parseDateToObj(e.endDate).getTime() : parseDateToObj(e.startDate).getTime();
                return end < today;
            });
        } else if (currentFilter === 'my') {
            filtered = filtered.filter(e => e.userId === user.uid);
        } else if (currentFilter === 'shared') {
            filtered = filtered.filter(e => e.userId !== user.uid);
        } else {
            filtered = filtered.filter(e => {
                const end = e.endDate ? parseDateToObj(e.endDate).getTime() : parseDateToObj(e.startDate).getTime();
                return end >= today;
            });
        }
        return filtered.sort((a, b) => parseDateToObj(a.startDate) - parseDateToObj(b.startDate));
    }, [allEvents, currentFilter]);

    const markedDates = useMemo(() => {
        let marks = {};
        allEvents.forEach(event => {
            const start = parseDateToObj(event.startDate);
            const end = (event.isMultiDay && event.endDate) ? parseDateToObj(event.endDate) : start;
            let curr = new Date(start);
            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0];
                const isStart = curr.getTime() === start.getTime();
                const isEnd = curr.getTime() === end.getTime();
                marks[dateStr] = {
                    startingDay: isStart,
                    endingDay: isEnd,
                    color: isStart || isEnd ? '#00686F' : '#E0F2F3',
                    textColor: isStart || isEnd ? '#ffffff' : '#00686F',
                };
                curr.setDate(curr.getDate() + 1);
            }
        });
        return marks;
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
            <ScrollView showsVerticalScrollIndicator={false}>
                <DashboardHeader
                    userData={userData}
                    greeting={greeting}
                    onPressAvatar={() => toggleMenu(true)}
                    onOpenNotifications={() => setNotifVisible(true)}
                />

                <View style={tw`px-6 pt-2 pb-24`}>

                    {/* FEATURED VENUES SECTION */}
                    <View style={tw`flex-row justify-between items-end mt-6 mb-4`}>
                        <CustomText fontFamily="bold" style={tw`text-lg text-slate-800`}>Explore Venues</CustomText>
                        <TouchableOpacity onPress={() => navigation.navigate('Venues')}>
                            <CustomText fontFamily="semibold" style={tw`text-sm text-[#00686F]`}>View All</CustomText>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={tw`-mx-6 pl-6 mb-8`}
                        contentContainerStyle={{ paddingRight: 24 }}
                    >
                        {FEATURED_VENUES.map((venue) => (
                            <TouchableOpacity
                                key={venue.id}
                                style={[
                                    tw`w-[260px] h-[150px] rounded-[24px] mr-4 overflow-hidden bg-slate-200 relative`,
                                    { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }
                                ]}
                                onPress={() => navigation.navigate('ARVenue', { venueId: venue.id, venueName: venue.name })}
                            >
                                <Image source={{ uri: venue.image }} style={tw`w-full h-full absolute`} />

                                {/* Gradient Overlay */}
                                <View style={tw`absolute inset-0 bg-black/30`} />

                                {venue.hasAR && (
                                    <View style={tw`absolute top-3 right-3 bg-white/20 px-2.5 py-1.5 rounded-full flex-row items-center`}>
                                        <Ionicons name="cube" size={12} color="#FFF" />
                                        <CustomText fontFamily="bold" style={tw`text-white text-[10px] ml-1 tracking-wider`}>AR</CustomText>
                                    </View>
                                )}

                                <View style={tw`absolute bottom-0 left-0 right-0 p-4`}>
                                    <CustomText fontFamily="bold" style={tw`text-white text-[15px] mb-0.5`} numberOfLines={1}>{venue.name}</CustomText>
                                    <View style={tw`flex-row items-center opacity-90`}>
                                        <Ionicons name="location" size={12} color="#FFF" />
                                        <CustomText fontFamily="regular" style={tw`text-white text-[11px] ml-1`} numberOfLines={1}>{venue.location}</CustomText>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* QUICK ACCESS SECTION */}
                    <CustomText fontFamily="bold" style={tw`text-lg text-slate-800 mb-4`}>Quick Access</CustomText>
                    <View style={tw`flex-row justify-between mb-8`}>
                        <QuickBtn icon="time-outline" label="Past" color="#64748B" active={currentFilter === 'past'} onPress={() => { setCurrentFilter('past'); setViewMode('list'); }} />
                        <QuickBtn icon="calendar" label="My Events" color="#00686F" active={currentFilter === 'my'} onPress={() => { setCurrentFilter('my'); setViewMode('list'); }} />
                        <QuickBtn icon="people" label="Shared" color="#8B5CF6" active={currentFilter === 'shared'} onPress={() => { setCurrentFilter('shared'); setViewMode('list'); }} />
                        <QuickBtn icon="location-outline" label="Venue" color="#F59E0B" onPress={() => navigation.navigate('Venues')} />
                    </View>

                    {/* VIEW SWITCHER */}
                    <View style={tw`flex-row bg-slate-200/70 rounded-2xl p-1 mb-6`}>
                        <TouchableOpacity
                            style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                            onPress={() => setViewMode('list')}
                        >
                            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#00686F' : '#64748B'} />
                            <CustomText fontFamily="semibold" style={tw`ml-2 text-[13px] ${viewMode === 'list' ? 'text-slate-800' : 'text-slate-500'}`}>List View</CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${viewMode === 'calendar' ? 'bg-white shadow-sm' : ''}`}
                            onPress={() => { setViewMode('calendar'); setCurrentFilter('upcoming'); }}
                        >
                            <Ionicons name="calendar" size={18} color={viewMode === 'calendar' ? '#00686F' : '#64748B'} />
                            <CustomText fontFamily="semibold" style={tw`ml-2 text-[13px] ${viewMode === 'calendar' ? 'text-slate-800' : 'text-slate-500'}`}>Calendar</CustomText>
                        </TouchableOpacity>
                    </View>

                    {/* DYNAMIC CONTENT AREA */}
                    {viewMode === 'calendar' ? (
                        <Animated.View style={[{ opacity: fadeAnim }, tw`bg-white rounded-[24px] p-2 overflow-hidden shadow-sm border border-slate-100`]}>
                            <Calendar markingType={'period'} theme={calendarTheme} markedDates={markedDates} />
                        </Animated.View>
                    ) : (
                        <View>
                            <View style={tw`flex-row justify-between items-center mb-4`}>
                                <CustomText fontFamily="bold" style={tw`text-base text-slate-800`}>
                                    {currentFilter === 'past' ? 'Past Events' : currentFilter === 'my' ? 'My Events' : currentFilter === 'shared' ? 'Shared with Me' : 'Upcoming Events'}
                                </CustomText>
                                {currentFilter !== 'upcoming' && (
                                    <TouchableOpacity onPress={() => setCurrentFilter('upcoming')}>
                                        <CustomText fontFamily="semibold" style={tw`text-[#00686F] text-xs`}>Show All</CustomText>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {listData.length > 0 ? (
                                listData.map(item => <EventItem key={item.id} item={item} navigation={navigation} />)
                            ) : (
                                <View style={tw`items-center justify-center mt-10 p-6 bg-white rounded-[24px] border border-slate-100 border-dashed`}>
                                    <View style={tw`w-16 h-16 rounded-full bg-slate-50 items-center justify-center mb-3`}>
                                        <Ionicons name="folder-open-outline" size={28} color="#94A3B8" />
                                    </View>
                                    <CustomText fontFamily="medium" style={tw`text-slate-500 text-[14px]`}>No events found here.</CustomText>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            <NotificationModal
                visible={notifVisible}
                onClose={() => setNotifVisible(false)}
            />

            {/* SIDE DRAWER MENU */}
            {menuVisible && (
                <View style={tw`absolute inset-0 z-50`} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                        <View style={tw`absolute inset-0 bg-slate-900/40`} />
                    </TouchableWithoutFeedback>

                    <Animated.View style={[
                        tw`absolute top-0 right-0 bottom-0 bg-white rounded-l-[32px] px-6 pt-16`,
                        { width: width * 0.75, transform: [{ translateX: slideAnim }], shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20 }
                    ]}>
                        <View style={tw`flex-row justify-between items-center pb-6 border-b border-slate-100`}>
                            <CustomText fontFamily="extrabold" style={tw`text-2xl text-slate-800`}>Menu</CustomText>
                            <TouchableOpacity onPress={() => toggleMenu(false)} style={tw`p-2 bg-slate-50 rounded-full`}>
                                <Ionicons name="close" size={20} color="#334155" />
                            </TouchableOpacity>
                        </View>

                        <View style={tw`mt-6`}>
                            <TouchableOpacity
                                style={tw`flex-row items-center py-4`}
                                onPress={() => { toggleMenu(false); navigation.navigate('Profile'); }}
                            >
                                <View style={tw`w-12 h-12 rounded-2xl bg-[#F0F9FA] justify-center items-center mr-4`}>
                                    <Ionicons name="person-outline" size={20} color="#00686F" />
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

            {/* FLOATING ACTION BUTTON */}
            <TouchableOpacity
                style={[
                    tw`absolute right-6 bottom-8 bg-[#00686F] w-14 h-14 rounded-[20px] justify-center items-center`,
                    { shadowColor: '#00686F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }
                ]}
                onPress={() => navigation.navigate('AddEvent')}
            >
                <Ionicons name="add" size={28} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// --- SUB-COMPONENTS ---
const QuickBtn = ({ icon, label, color, onPress, active }) => (
    <TouchableOpacity style={tw`items-center w-[22%]`} onPress={onPress}>
        <View
            style={[
                tw`w-[54px] h-[54px] rounded-[20px] justify-center items-center mb-2`,
                { backgroundColor: active ? color : color + '15' }
            ]}
        >
            <Ionicons name={icon} size={24} color={active ? '#FFF' : color} />
        </View>
        <CustomText
            fontFamily={active ? "bold" : "medium"}
            style={[tw`text-[10px] text-center`, { color: active ? color : '#64748B' }]}
        >
            {label}
        </CustomText>
    </TouchableOpacity>
);

const EventItem = ({ item, navigation }) => {
    const start = parseDateToObj(item.startDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <TouchableOpacity
            style={tw`bg-white p-4 rounded-[20px] mb-3 flex-row items-center border border-slate-100`}
            onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}
        >
            <View style={tw`w-12 h-12 rounded-2xl bg-[#F0F9FA] justify-center items-center mr-4`}>
                <Ionicons name="calendar" size={20} color="#00686F" />
            </View>
            <View style={tw`flex-1`}>
                <CustomText fontFamily="bold" style={tw`text-[15px] text-slate-800 mb-0.5`}>{item.title}</CustomText>
                <CustomText fontFamily="medium" style={tw`text-[#94A3B8] text-[12px]`}>{startStr}</CustomText>
            </View>
            <View style={tw`w-8 h-8 rounded-full bg-slate-50 justify-center items-center`}>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </View>
        </TouchableOpacity>
    );
};

// Cleaned up calendar theme to match the sleek UI
const calendarTheme = {
    calendarBackground: '#ffffff',
    todayTextColor: '#00686F',
    dayTextColor: '#334155',
    monthTextColor: '#0f172a',
    arrowColor: '#00686F',
    textDayFontFamily: 'Poppins-Medium',
    textMonthFontFamily: 'Poppins-Bold',
    textDayHeaderFontFamily: 'Poppins-SemiBold',
    textMonthFontWeight: 'bold',
    textDayHeaderFontWeight: '600',
    'stylesheet.calendar.header': {
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            marginTop: 6,
            alignItems: 'center'
        }
    }
};