import React, { useState, useEffect, useRef } from 'react';
import { 
    View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, 
    TextInput, StatusBar, Modal, Pressable, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import CustomText from '../components/CustomText';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RSVPTrackerScreen({ route, navigation }) {
    const { eventId, eventTitle } = route?.params || {};
    const insets = useSafeAreaInsets();

    // States
    const [responses, setResponses] = useState([]);
    const [filteredResponses, setFilteredResponses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    
    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState(null);
    
    const isFirstRun = useRef(true);

    const COLORS = {
        primary: '#00686F',
        primaryLight: '#00858E',
        textMuted: '#64748B',
        danger: '#FF4D4D',
        overlay: 'rgba(0,0,0,0.5)'
    };

    useEffect(() => {
        if (!eventId) return;
        const rsvpRef = collection(db, 'events', eventId, 'rsvps');
        const q = query(rsvpRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (!isFirstRun.current && data.length > responses.length) {
                triggerLocalNotification(data[0].guestName, data[0].status);
            }
            setResponses(data);
            applyFilters(data, searchQuery, activeFilter);
            setLoading(false);
            isFirstRun.current = false;
        });
        return () => unsubscribe();
    }, [eventId]);

    const triggerLocalNotification = async (name, status) => {
        await Notifications.scheduleNotificationAsync({
            content: { title: "New RSVP Logged", body: `${name}: ${status.toUpperCase()}` },
            trigger: null,
        });
    };

    const applyFilters = (data, queryText, filter) => {
        let result = [...data];
        if (filter !== 'All') {
            result = result.filter(item => {
                const status = item.status?.toLowerCase() || '';
                const target = filter.toLowerCase();
                return target === 'declined' ? (status === 'declined' || status === 'not going') : status === target;
            });
        }
        if (queryText) {
            result = result.filter(item => item.guestName?.toLowerCase().includes(queryText.toLowerCase()));
        }
        setFilteredResponses(result);
    };

    // --- DELETE LOGIC ---
    const requestDelete = (item) => {
        setSelectedGuest(item);
        setModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!selectedGuest || !eventId) return;
        try {
            setIsDeleting(true);
            await deleteDoc(doc(db, 'events', eventId, 'rsvps', selectedGuest.id));
            setModalVisible(false);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
            setSelectedGuest(null);
        }
    };

    const exportToCSV = async () => {
        if (responses.length === 0) return;
        try {
            const fileName = `RSVP_${eventTitle?.replace(/[^a-z0-9]/gi, '_') || 'List'}.csv`;
            const fileUri = FileSystem.documentDirectory + fileName;
            let csv = "Guest Name,Status\n" + responses.map(r => `"${r.guestName}","${r.status}"`).join("\n");
            await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
            await Sharing.shareAsync(fileUri);
        } catch (error) { console.log(error); }
    };

    const totalCount = responses.length;
    const goingCount = responses.filter(r => r.status?.toLowerCase() === 'going').length;
    const rate = totalCount > 0 ? Math.round((goingCount / totalCount) * 100) : 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Header Section */}
            <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
                <View style={styles.navbar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navIcon}>
                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.navCenter}>
                        <CustomText style={styles.navTitle}>{eventTitle || 'Tracker'}</CustomText>
                        <CustomText style={styles.liveLabel}>LIVE GUEST LIST</CustomText>
                    </View>
                    <View style={{ width: 42 }} /> 
                </View>

                <View style={styles.metricsContainer}>
                    <View style={styles.metricBox}><CustomText style={styles.mValue}>{totalCount}</CustomText><CustomText style={styles.mLabel}>TOTAL</CustomText></View>
                    <View style={styles.vDivider} />
                    <View style={styles.metricBox}><CustomText style={styles.mValue}>{goingCount}</CustomText><CustomText style={styles.mLabel}>GOING</CustomText></View>
                    <View style={styles.vDivider} />
                    <View style={styles.metricBox}><CustomText style={styles.mValue}>{rate}%</CustomText><CustomText style={styles.mLabel}>RATE</CustomText></View>
                </View>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={COLORS.textMuted} />
                    <TextInput 
                        placeholder="Search guests..."
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={(t) => {setSearchQuery(t); applyFilters(responses, t, activeFilter);}}
                    />
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.filterBar}>
                    {['All', 'Going', 'Declined'].map((f) => (
                        <TouchableOpacity 
                            key={f} 
                            onPress={() => {setActiveFilter(f); applyFilters(responses, searchQuery, f);}}
                            style={[styles.filterChip, activeFilter === f && { backgroundColor: COLORS.primary }]}
                        >
                            <CustomText style={[styles.filterChipText, activeFilter === f && { color: '#FFF' }]}>{f}</CustomText>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <ActivityIndicator style={{marginTop: 50}} color={COLORS.primary} size="large" />
                ) : (
                    <FlatList
                        data={filteredResponses}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.card}>
                                <View style={styles.cardMain}>
                                    <View style={[styles.avatar, { backgroundColor: item.status?.toLowerCase() === 'going' ? COLORS.primary : '#E2E8F0' }]}>
                                        <CustomText style={styles.avatarText}>{item.guestName?.charAt(0).toUpperCase()}</CustomText>
                                    </View>
                                    <View style={styles.guestInfo}>
                                        <CustomText style={styles.guestName}>{item.guestName}</CustomText>
                                        <View style={[styles.statusTag, { backgroundColor: item.status?.toLowerCase() === 'going' ? '#E0F2F1' : '#F1F5F9' }]}>
                                            <CustomText style={[styles.tagText, { color: item.status?.toLowerCase() === 'going' ? COLORS.primary : COLORS.textMuted }]}>{item.status}</CustomText>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => requestDelete(item)} style={styles.trashBtn}>
                                    <Ionicons name="trash-outline" size={20} color="#CBD5E1" />
                                </TouchableOpacity>
                            </View>
                        )}
                        contentContainerStyle={[styles.list, { paddingBottom: 120 }]}
                    />
                )}
            </View>

            {/* Custom Themed Delete Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <Animated.View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View style={styles.warningCircle}>
                                <Ionicons name="alert" size={30} color={COLORS.danger} />
                            </View>
                            <CustomText style={styles.modalTitle}>Remove Guest?</CustomText>
                            <CustomText style={styles.modalSub}>
                                You are about to remove <CustomText style={{fontWeight: 'bold'}}>{selectedGuest?.guestName}</CustomText>. This action cannot be undone.
                            </CustomText>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={() => setModalVisible(false)}
                            >
                                <CustomText style={styles.cancelBtnText}>Keep Guest</CustomText>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.confirmBtn} 
                                onPress={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <CustomText style={styles.confirmBtnText}>Yes, Remove</CustomText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Pressable>
            </Modal>

            {/* Export FAB */}
            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom || 30 }]} onPress={exportToCSV}>
                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.fabGradient}>
                    <Ionicons name="download-outline" size={20} color="#FFF" />
                    <CustomText style={styles.fabText}>EXPORT CSV</CustomText>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFB' },
    header: { backgroundColor: '#00686F', paddingHorizontal: 20, paddingBottom: 30, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    navIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    navCenter: { alignItems: 'center', flex: 1 },
    navTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    liveLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 9, letterSpacing: 1, fontWeight: '700', marginTop: 2 },
    metricsContainer: { flexDirection: 'row', marginTop: 25, alignItems: 'center', justifyContent: 'space-evenly' },
    metricBox: { alignItems: 'center', flex: 1 },
    mValue: { color: '#FFF', fontSize: 22, fontWeight: '800' },
    mLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '600', marginTop: 4 },
    vDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', height: 45, borderRadius: 12, marginTop: 25, paddingHorizontal: 15 },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#000' },
    content: { flex: 1, paddingHorizontal: 20 },
    filterBar: { flexDirection: 'row', marginTop: 20, gap: 8 },
    filterChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E2E8F0' },
    filterChipText: { color: '#64748B', fontWeight: '700', fontSize: 11 },
    list: { paddingTop: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 15, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 1 },
    cardMain: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    guestInfo: { marginLeft: 12 },
    guestName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    tagText: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
    trashBtn: { padding: 10 },
    
    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center' },
    modalHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 10, marginBottom: 20 },
    warningCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 20 },
    modalFooter: { flexDirection: 'row', marginTop: 30, gap: 15, width: '100%' },
    cancelBtn: { flex: 1, height: 55, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    cancelBtnText: { color: '#64748B', fontWeight: '700' },
    confirmBtn: { flex: 1, height: 55, borderRadius: 15, backgroundColor: '#FF4D4D', alignItems: 'center', justifyContent: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: '700' },

    fab: { position: 'absolute', left: 20, right: 20 },
    fabGradient: { height: 55, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    fabText: { color: '#FFF', fontSize: 14, fontWeight: '800' }
});