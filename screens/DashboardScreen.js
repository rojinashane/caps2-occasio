import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Animated,
    Platform,
    UIManager,
    Dimensions,
    TouchableWithoutFeedback,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const { width } = Dimensions.get('window');

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

    // --- MODAL & MENU STATES ---
    const [menuVisible, setMenuVisible] = useState(false);
    const [notifVisible, setNotifVisible] = useState(false); // Controls the NotificationModal
    const slideAnim = useRef(new Animated.Value(width)).current;

    useEffect(() => {
        fetchUserData();
        setGreetingMessage();

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

    const fetchUserData = async () => {
        const user = auth.currentUser;
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) setUserData(userDoc.data());
        }
    };

    const setGreetingMessage = () => {
        const hour = new Date().getHours();
        setGreeting(hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening');
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
                    color: isStart || isEnd ? '#00686F' : 'rgba(0, 104, 111, 0.2)',
                    textColor: isStart || isEnd ? '#ffffff' : '#00686F',
                };
                curr.setDate(curr.getDate() + 1);
            }
        });
        return marks;
    }, [allEvents]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00686F" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <DashboardHeader
                    userData={userData}
                    greeting={greeting}
                    onPressAvatar={() => toggleMenu(true)}
                    onOpenNotifications={() => setNotifVisible(true)}
                />

                <View style={styles.content}>
                    <View style={styles.statsGrid}>
                        <StatCard value={stats.total} label="Total" />
                        <StatCard value={stats.upcoming3Months} label="Next 3M" highlight />
                        <StatCard value={stats.shared} label="Shared" />
                    </View>

                    <CustomText style={styles.sectionTitle}>Quick Access</CustomText>
                    <View style={styles.quickAccessRow}>
                        <QuickBtn icon="time-outline" label="Past Events" color="#6B7280" active={currentFilter === 'past'} onPress={() => { setCurrentFilter('past'); setViewMode('list'); }} />
                        <QuickBtn icon="calendar" label="My Events" color="#00686F" active={currentFilter === 'my'} onPress={() => { setCurrentFilter('my'); setViewMode('list'); }} />
                        <QuickBtn icon="people" label="Shared" color="#8B5CF6" active={currentFilter === 'shared'} onPress={() => { setCurrentFilter('shared'); setViewMode('list'); }} />
                        <QuickBtn icon="location-outline" label="Venue" color="#F59E0B" onPress={() => navigation.navigate('Venues')} />
                    </View>

                    <View style={styles.viewSwitcher}>
                        <TouchableOpacity style={[styles.switchBtn, viewMode === 'list' && styles.switchBtnActive]} onPress={() => setViewMode('list')}>
                            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#6B7280'} />
                            <CustomText style={[styles.switchText, viewMode === 'list' && { color: '#FFF' }]}>List View</CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.switchBtn, viewMode === 'calendar' && styles.switchBtnActive]} onPress={() => { setViewMode('calendar'); setCurrentFilter('upcoming'); }}>
                            <Ionicons name="calendar" size={18} color={viewMode === 'calendar' ? '#FFF' : '#6B7280'} />
                            <CustomText style={[styles.switchText, viewMode === 'calendar' && { color: '#FFF' }]}>Calendar</CustomText>
                        </TouchableOpacity>
                    </View>

                    {viewMode === 'calendar' ? (
                        <Animated.View style={[styles.calendarContainer, { opacity: fadeAnim }]}>
                            <Calendar markingType={'period'} theme={calendarTheme} markedDates={markedDates} />
                        </Animated.View>
                    ) : (
                        <View style={{ marginBottom: 100 }}>
                            <View style={styles.listHeader}>
                                <CustomText style={styles.sectionSubTitle}>
                                    {currentFilter === 'past' ? 'Past Events' : currentFilter === 'my' ? 'My Events' : currentFilter === 'shared' ? 'Shared with Me' : 'Upcoming Events'}
                                </CustomText>
                                {currentFilter !== 'upcoming' && (
                                    <TouchableOpacity onPress={() => setCurrentFilter('upcoming')}>
                                        <CustomText style={styles.resetFilter}>Show All Upcoming</CustomText>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {listData.length > 0 ? (
                                listData.map(item => <EventItem key={item.id} item={item} navigation={navigation} />)
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="file-tray-outline" size={40} color="#D1D5DB" />
                                    <CustomText style={styles.emptyText}>No events found in this category.</CustomText>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* INTEGRATED NOTIFICATION MODAL */}
            <NotificationModal
                visible={notifVisible}
                onClose={() => setNotifVisible(false)}
            />

            {menuVisible && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                        <View style={styles.drawerOverlay} />
                    </TouchableWithoutFeedback>

                    <Animated.View style={[styles.sideDrawer, { transform: [{ translateX: slideAnim }] }]}>
                        <SafeAreaView style={{ flex: 1 }}>
                            <View style={styles.drawerHeader}>
                                <CustomText style={styles.drawerMenuTitle}>Menu</CustomText>
                                <TouchableOpacity onPress={() => toggleMenu(false)}>
                                    <Ionicons name="close" size={28} color="#1E293B" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.drawerItems}>
                                <TouchableOpacity style={styles.drawerItem} onPress={() => { toggleMenu(false); navigation.navigate('Profile'); }}>
                                    <View style={[styles.drawerIcon, { backgroundColor: '#F0F9FA' }]}>
                                        <Ionicons name="person-outline" size={22} color="#00686F" />
                                    </View>
                                    <CustomText style={styles.drawerText}>Profile</CustomText>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
                                    <View style={[styles.drawerIcon, { backgroundColor: '#FEF2F2' }]}>
                                        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                                    </View>
                                    <CustomText style={[styles.drawerText, { color: '#EF4444' }]}>Log Out</CustomText>
                                </TouchableOpacity>
                            </View>
                        </SafeAreaView>
                    </Animated.View>
                </View>
            )}

            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddEvent')}>
                <Ionicons name="add" size={32} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

// --- SUB-COMPONENTS ---
const StatCard = ({ value, label, highlight }) => (
    <View style={[styles.statCard, highlight && { backgroundColor: '#F0F9FA' }]}>
        <CustomText style={[styles.statValue, highlight && { color: '#00686F' }]}>{value}</CustomText>
        <CustomText style={styles.statLabel}>{label}</CustomText>
    </View>
);

const QuickBtn = ({ icon, label, color, onPress, active }) => (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress}>
        <View style={[styles.quickIcon, { backgroundColor: color + '15' }, active && { backgroundColor: color }]}>
            <Ionicons name={icon} size={22} color={active ? '#FFF' : color} />
        </View>
        <CustomText style={[styles.quickLabel, active && { color: color, fontWeight: '800' }]}>{label}</CustomText>
    </TouchableOpacity>
);

const EventItem = ({ item, navigation }) => {
    const start = parseDateToObj(item.startDate);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return (
        <TouchableOpacity style={styles.eventCard} onPress={() => navigation.navigate('EventDetails', { eventId: item.id })}>
            <View style={styles.iconBox}><Ionicons name="calendar" size={20} color="#00686F" /></View>
            <View style={{ flex: 1 }}>
                <CustomText style={styles.eventTitle}>{item.title}</CustomText>
                <CustomText style={styles.eventDate}>{startStr}</CustomText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </TouchableOpacity>
    );
};

const calendarTheme = {
    calendarBackground: '#ffffff',
    todayTextColor: '#EF4444',
    dayTextColor: '#374151',
    monthTextColor: '#111827',
    arrowColor: '#00686F',
    textDayFontWeight: '500',
    textMonthFontWeight: 'bold',
    textDayHeaderFontWeight: '600',
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    content: { paddingHorizontal: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20 },
    statCard: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 18, marginHorizontal: 5, alignItems: 'center', elevation: 2 },
    statValue: { fontSize: 20, fontWeight: '800', color: '#111827' },
    statLabel: { fontSize: 10, color: '#6B7280', marginTop: 4, fontWeight: '600' },
    quickAccessRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    quickBtn: { alignItems: 'center', width: '23%' },
    quickIcon: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    quickLabel: { fontSize: 9, fontWeight: '700', color: '#374151', textAlign: 'center' },
    viewSwitcher: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 14, padding: 4, marginBottom: 20 },
    switchBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 11 },
    switchBtnActive: { backgroundColor: '#00686F' },
    switchText: { marginLeft: 8, fontSize: 13, fontWeight: 'bold', color: '#6B7280' },
    calendarContainer: { backgroundColor: '#FFF', borderRadius: 24, padding: 10, elevation: 4 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#111827' },
    sectionSubTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    resetFilter: { color: '#00686F', fontWeight: 'bold', fontSize: 11 },
    eventCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    eventTitle: { fontWeight: 'bold', fontSize: 14, color: '#111827' },
    eventDate: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#9CA3AF', marginTop: 10, fontSize: 13 },
    fab: { position: 'absolute', right: 20, bottom: 30, backgroundColor: '#00686F', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 6 },
    drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sideDrawer: {
        position: 'absolute', top: 0, right: 0, bottom: 0, width: width * 0.75,
        backgroundColor: '#FFF', paddingHorizontal: 20, elevation: 20,
        shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 10
    },
    drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    drawerMenuTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    drawerItems: { marginTop: 20 },
    drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
    drawerIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    drawerText: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
});