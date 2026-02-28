import React, { useState, useEffect, useRef } from 'react';
import {
    View, FlatList, ActivityIndicator, TouchableOpacity,
    TextInput, StatusBar, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import CustomText from '../components/CustomText';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function RSVPTrackerScreen({ route, navigation }) {
    const { eventId, eventTitle } = route?.params || {};

    const [responses, setResponses]                 = useState([]);
    const [filteredResponses, setFilteredResponses] = useState([]);
    const [loading, setLoading]                     = useState(true);
    const [isDeleting, setIsDeleting]               = useState(false);
    const [searchQuery, setSearchQuery]             = useState('');
    const [activeFilter, setActiveFilter]           = useState('All');
    const [modalVisible, setModalVisible]           = useState(false);
    const [selectedGuest, setSelectedGuest]         = useState(null);
    const isFirstRun = useRef(true);

    useEffect(() => {
        if (!eventId) return;
        const q = query(collection(db, 'events', eventId, 'rsvps'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            if (!isFirstRun.current && data.length > responses.length) {
                const newGuest = data[0];
                const s = newGuest.status?.toLowerCase() === 'going' ? 'Attending' : 'Declined';
                triggerLocalNotification(newGuest.guestName, s);
            }
            setResponses(data);
            applyFilters(data, searchQuery, activeFilter);
            setLoading(false);
            isFirstRun.current = false;
        });
        return () => unsubscribe();
    }, [eventId, responses.length]);

    const triggerLocalNotification = async (name, status) => {
        await Notifications.scheduleNotificationAsync({
            content: { title: 'New RSVP Logged', body: `${name}: ${status.toUpperCase()}` },
            trigger: null,
        });
    };

    const applyFilters = (data, queryText, filter) => {
        let result = [...data];
        if (filter !== 'All') {
            result = result.filter(item => {
                const s = item.status?.toLowerCase() || '';
                if (filter === 'Attending') return s === 'going' || s === 'attending';
                if (filter === 'Declined')  return s === 'declined' || s === 'not going';
                return true;
            });
        }
        if (queryText) {
            result = result.filter(item =>
                item.guestName?.toLowerCase().includes(queryText.toLowerCase())
            );
        }
        setFilteredResponses(result);
    };

    const requestDelete = (item) => { setSelectedGuest(item); setModalVisible(true); };

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
            const fileUri  = FileSystem.documentDirectory + fileName;
            const csv = 'Guest Name,Status\n' + responses.map(r => {
                const s = r.status?.toLowerCase() === 'going' ? 'Attending' : 'Declined';
                return `"${r.guestName}","${s}"`;
            }).join('\n');
            await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
            await Sharing.shareAsync(fileUri);
        } catch (e) { console.log(e); }
    };

    const totalCount     = responses.length;
    const attendingCount = responses.filter(r =>
        r.status?.toLowerCase() === 'going' || r.status?.toLowerCase() === 'attending'
    ).length;
    const declinedCount  = totalCount - attendingCount;
    const rate           = totalCount > 0 ? Math.round((attendingCount / totalCount) * 100) : 0;

    const isAttending = (item) =>
        item.status?.toLowerCase() === 'going' || item.status?.toLowerCase() === 'attending';

    // ── Guest row ─────────────────────────────────────────────────────────────
    const renderItem = ({ item }) => {
        const attending = isAttending(item);
        return (
            <View style={{
                backgroundColor: '#FFF',
                borderRadius: 16,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                shadowColor: '#00686F',
                shadowOpacity: 0.05,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 2,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    {/* Avatar */}
                    <View style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: attending ? '#E8F5F5' : '#F1F5F9',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: attending ? '#99D6D9' : '#E2E8F0',
                        marginRight: 13,
                    }}>
                        <CustomText style={{ color: attending ? '#00686F' : '#94A3B8', fontSize: 17, fontWeight: '800' }}>
                            {item.guestName?.charAt(0).toUpperCase()}
                        </CustomText>
                    </View>

                    {/* Name + status badge */}
                    <View style={{ flex: 1 }}>
                        <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 5 }}>
                            {item.guestName}
                        </CustomText>
                        <View style={{
                            alignSelf: 'flex-start',
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: attending ? '#E8F5F5' : '#F1F5F9',
                            borderRadius: 20,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor: attending ? '#99D6D9' : '#E2E8F0',
                        }}>
                            <Ionicons
                                name={attending ? 'checkmark-circle' : 'close-circle'}
                                size={10}
                                color={attending ? '#00686F' : '#94A3B8'}
                            />
                            <CustomText style={{
                                fontSize: 9,
                                fontWeight: '800',
                                color: attending ? '#00686F' : '#94A3B8',
                                marginLeft: 4,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                            }}>
                                {attending ? 'Attending' : 'Declined'}
                            </CustomText>
                        </View>
                    </View>
                </View>

                {/* Delete */}
                <TouchableOpacity
                    onPress={() => requestDelete(item)}
                    style={{
                        width: 34, height: 34, borderRadius: 10,
                        backgroundColor: '#F8FAFC',
                        alignItems: 'center', justifyContent: 'center',
                        marginLeft: 8,
                    }}
                >
                    <Ionicons name="trash-outline" size={15} color="#CBD5E1" />
                </TouchableOpacity>
            </View>
        );
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    const renderEmpty = () => (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{
                width: 64, height: 64, borderRadius: 20,
                backgroundColor: '#E8F5F5',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
            }}>
                <Ionicons name="people-outline" size={28} color="#00686F" />
            </View>
            <CustomText style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>
                No responses yet
            </CustomText>
            <CustomText style={{ fontSize: 12, color: '#94A3B8', fontWeight: '500', textAlign: 'center', lineHeight: 18 }}>
                Guests who RSVP via your{'\n'}invitation link will appear here.
            </CustomText>
        </View>
    );

    // ── Main ──────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#F4F6F9' }}>
            <StatusBar barStyle="light-content" backgroundColor="#00686F" />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

                {/* ── HEADER ─────────────────────────────────────────────── */}
                <View style={{ backgroundColor: '#00686F', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 }}>

                    {/* Top bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Ionicons name="chevron-back" size={20} color="#FFF" />
                        </TouchableOpacity>

                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                            <CustomText style={{ color: '#FFF', fontSize: 17, fontWeight: '800', lineHeight: 22 }} numberOfLines={1}>
                                {eventTitle || 'Guest List'}
                            </CustomText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                                    <Ionicons name="radio-outline" size={9} color="rgba(255,255,255,0.85)" />
                                    <CustomText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>
                                        LIVE TRACKER
                                    </CustomText>
                                </View>
                            </View>
                        </View>

                        {/* Export CSV */}
                        <TouchableOpacity
                            onPress={exportToCSV}
                            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Ionicons name="download-outline" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Stats card — mirrors EventDetailsScreen's progress card */}
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 18, padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginBottom: 14 }}>
                            {[
                                { value: totalCount,     label: 'TOTAL'     },
                                { value: attendingCount, label: 'ATTENDING' },
                                { value: declinedCount,  label: 'DECLINED'  },
                                { value: `${rate}%`,     label: 'RATE'      },
                            ].map((m, i, arr) => (
                                <React.Fragment key={m.label}>
                                    <View style={{ alignItems: 'center' }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 22, fontWeight: '900', lineHeight: 26 }}>
                                            {m.value}
                                        </CustomText>
                                        <CustomText style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 }}>
                                            {m.label}
                                        </CustomText>
                                    </View>
                                    {i < arr.length - 1 && (
                                        <View style={{ width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </View>

                        {/* Progress bar */}
                        <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                            <View style={{
                                height: '100%',
                                width: `${rate}%`,
                                backgroundColor: rate === 100 ? '#6EE7B7' : '#FFF',
                                borderRadius: 3,
                            }} />
                        </View>
                        <CustomText style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' }}>
                            {totalCount === 0
                                ? 'No responses yet'
                                : `${attendingCount} of ${totalCount} guests attending`}
                        </CustomText>
                    </View>
                </View>

                {/* ── BODY ───────────────────────────────────────────────── */}
                <View style={{ flex: 1, paddingHorizontal: 16 }}>

                    {/* Search + filter card */}
                    <View style={{
                        backgroundColor: '#FFF',
                        borderRadius: 20,
                        marginTop: 14,
                        padding: 14,
                        shadowColor: '#00686F',
                        shadowOpacity: 0.06,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 2,
                        marginBottom: 4,
                    }}>
                        {/* Search */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: '#F8FAFC', borderRadius: 12,
                            paddingHorizontal: 12, height: 42,
                            borderWidth: 1, borderColor: '#EEF2F7',
                            marginBottom: 12,
                        }}>
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                placeholder="Search guests..."
                                placeholderTextColor="#CBD5E1"
                                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#0F172A' }}
                                value={searchQuery}
                                onChangeText={(t) => { setSearchQuery(t); applyFilters(responses, t, activeFilter); }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => { setSearchQuery(''); applyFilters(responses, '', activeFilter); }}>
                                    <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Filter chips with counts */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {[
                                { label: 'All',       icon: 'people-outline',           count: totalCount     },
                                { label: 'Attending', icon: 'checkmark-circle-outline', count: attendingCount },
                                { label: 'Declined',  icon: 'close-circle-outline',     count: declinedCount  },
                            ].map((f) => {
                                const active = activeFilter === f.label;
                                return (
                                    <TouchableOpacity
                                        key={f.label}
                                        onPress={() => { setActiveFilter(f.label); applyFilters(responses, searchQuery, f.label); }}
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: active ? '#00686F' : '#F8FAFC',
                                            borderWidth: 1.5,
                                            borderColor: active ? '#00686F' : '#EEF2F7',
                                            gap: 5,
                                        }}
                                    >
                                        <Ionicons name={f.icon} size={11} color={active ? '#FFF' : '#94A3B8'} />
                                        <CustomText style={{ fontSize: 11, fontWeight: '700', color: active ? '#FFF' : '#64748B' }}>
                                            {f.label}
                                        </CustomText>
                                        <View style={{
                                            backgroundColor: active ? 'rgba(255,255,255,0.25)' : '#E8EEF4',
                                            borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1,
                                        }}>
                                            <CustomText style={{ fontSize: 9, fontWeight: '800', color: active ? '#FFF' : '#94A3B8' }}>
                                                {f.count}
                                            </CustomText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Section label */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginTop: 14, marginBottom: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                            <Ionicons name="list-outline" size={13} color="#00686F" />
                        </View>
                        <CustomText style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                            Guest Responses
                        </CustomText>
                        <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginLeft: 6 }}>
                            ({filteredResponses.length})
                        </CustomText>
                    </View>

                    {/* List */}
                    {loading ? (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color="#00686F" size="large" />
                            <CustomText style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 12 }}>
                                Loading responses...
                            </CustomText>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredResponses}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            ListEmptyComponent={renderEmpty}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        />
                    )}
                </View>
            </SafeAreaView>

            {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────── */}
            <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    onPress={() => setModalVisible(false)}
                >
                    <Pressable onPress={e => e.stopPropagation()}>
                        <View style={{
                            backgroundColor: '#FFF',
                            borderTopLeftRadius: 28, borderTopRightRadius: 28,
                            padding: 28, alignItems: 'center',
                        }}>
                            <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 24 }} />

                            <View style={{
                                width: 60, height: 60, borderRadius: 20,
                                backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center',
                                marginBottom: 16, borderWidth: 1.5, borderColor: '#FECACA',
                            }}>
                                <Ionicons name="trash-outline" size={26} color="#EF4444" />
                            </View>

                            <CustomText style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                                Remove Guest?
                            </CustomText>
                            <CustomText style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, fontWeight: '500', marginBottom: 28 }}>
                                This will permanently remove{'\n'}
                                <CustomText style={{ fontWeight: '700', color: '#334155' }}>
                                    {selectedGuest?.guestName}
                                </CustomText>
                                {' '}from the guest list.
                            </CustomText>

                            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                                <TouchableOpacity
                                    onPress={() => setModalVisible(false)}
                                    style={{
                                        flex: 1, height: 52, borderRadius: 14,
                                        backgroundColor: '#F8FAFC',
                                        borderWidth: 1.5, borderColor: '#EEF2F7',
                                        alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <CustomText style={{ color: '#64748B', fontWeight: '700', fontSize: 14 }}>Keep</CustomText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={confirmDelete}
                                    disabled={isDeleting}
                                    style={{
                                        flex: 1, height: 52, borderRadius: 14,
                                        backgroundColor: '#EF4444',
                                        alignItems: 'center', justifyContent: 'center',
                                        shadowColor: '#EF4444', shadowOpacity: 0.3,
                                        shadowRadius: 8, elevation: 4,
                                    }}
                                >
                                    {isDeleting
                                        ? <ActivityIndicator color="#FFF" size="small" />
                                        : <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Remove</CustomText>
                                    }
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}