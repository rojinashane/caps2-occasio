import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, TouchableOpacity, Dimensions,
    ActivityIndicator, StatusBar, TextInput, Modal, KeyboardAvoidingView,
    Platform, Alert, Linking, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth, storage } from '../firebase';
import {
    doc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs, addDoc, serverTimestamp, limit
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import CustomText from '../components/CustomText';
import CustomModal from '../components/CustomModal';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable, ScrollView } from 'react-native-gesture-handler';
import tw from 'twrnc';

const { width, height } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.85;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateVal) => {
    if (!dateVal) return 'TBD';
    let d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : new Date(dateVal);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (timeVal) => {
    if (!timeVal) return 'Not set';
    let t = timeVal.seconds ? new Date(timeVal.seconds * 1000) : new Date(timeVal);
    if (isNaN(t.getTime())) return 'Invalid Time';
    return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getPriorityColor = (p) =>
    p === 'A' ? '#EF4444' : p === 'B' ? '#F59E0B' : '#10B981';

const getPriorityLabel = (p) =>
    p === 'A' ? 'High' : p === 'B' ? 'Medium' : 'Low';

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value }) => (
    <View style={tw`flex-row items-start py-3 border-b border-slate-100`}>
        <View style={tw`w-8 h-8 rounded-xl bg-teal-50 items-center justify-center mr-3 mt-0.5`}>
            <Ionicons name={icon} size={15} color="#00686F" />
        </View>
        <View style={tw`flex-1`}>
            <CustomText style={tw`text-xs font-bold text-slate-400 tracking-widest mb-0.5`}>{label}</CustomText>
            <CustomText style={tw`text-sm text-slate-600 font-medium leading-5`}>{value || 'Not set'}</CustomText>
        </View>
    </View>
);

const CollabChip = ({ email, isOwnerChip }) => (
    <View style={[
        tw`flex-row items-center rounded-2xl px-3 py-1.5 mr-2 mb-2`,
        isOwnerChip
            ? tw`bg-teal-50 border border-teal-200`
            : tw`bg-slate-100 border border-slate-200`
    ]}>
        <View style={[
            tw`w-5 h-5 rounded-full items-center justify-center mr-1.5`,
            isOwnerChip ? tw`bg-teal-600` : tw`bg-slate-400`
        ]}>
            {isOwnerChip
                ? <Ionicons name="star" size={9} color="#FFF" />
                : <CustomText style={tw`text-white text-xs font-bold`}>{email.charAt(0).toUpperCase()}</CustomText>
            }
        </View>
        <CustomText
            style={[tw`text-xs font-semibold`, isOwnerChip ? tw`text-teal-700` : tw`text-slate-600`]}
            numberOfLines={1}
        >
            {isOwnerChip ? 'Owner' : email}
        </CustomText>
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EventDetailsScreen({ route, navigation }) {
    const { eventId } = route.params;
    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingWorkspace, setDeletingWorkspace] = useState(false);
    const [deletingList, setDeletingList] = useState(false);
    const [sendingInvite, setSendingInvite] = useState(false);
    const [submittingModal, setSubmittingModal] = useState(false);
    const [savingTask, setSavingTask] = useState(false);
    const [columns, setColumns] = useState([]);
    const [foundUsers, setFoundUsers] = useState([]);

    const [modalVisible, setModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [collabModalVisible, setCollabModalVisible] = useState(false);
    const [workspaceDeleteVisible, setWorkspaceDeleteVisible] = useState(false);
    const submitLock = useRef(false);

    const [modalConfig, setModalConfig] = useState({ type: '', columnId: '', taskId: '', title: '' });
    const [listToDelete, setListToDelete] = useState(null);
    const [inputText, setInputText] = useState('');
    const [subtaskText, setSubtaskText] = useState('');
    const [collabEmail, setCollabEmail] = useState('');

    const [activeTask, setActiveTask] = useState(null);
    const [activeColumnId, setActiveColumnId] = useState(null);

    const isOwner = useMemo(() => eventData?.userId === auth.currentUser?.uid, [eventData]);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const fetchEvent = async () => {
                try {
                    const docRef = doc(db, 'events', eventId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists() && isActive) {
                        const data = docSnap.data();
                        setEventData(data);
                        if (data.columns) setColumns(data.columns);
                    }
                } catch (error) {
                    console.error('Fetch Error:', error);
                } finally {
                    if (isActive) setLoading(false);
                }
            };
            fetchEvent();
            return () => { isActive = false; };
        }, [eventId])
    );

    // ── Notifications ──────────────────────────────────────────────────────────
    const sendUniversalNotification = async (type, detail) => {
        const user = auth.currentUser;
        if (!user || !eventData) return;

        const allParticipantEmails = new Set([
            eventData.userId ? await getOwnerEmail(eventData.userId) : null,
            ...(eventData.collaborators || []).map(email => email.toLowerCase())
        ]);

        for (const email of allParticipantEmails) {
            if (!email) continue;
            try {
                const userQ = query(collection(db, 'users'), where('email', '==', email), limit(1));
                const userSnap = await getDocs(userQ);
                if (!userSnap.empty) {
                    const recipientId = userSnap.docs[0].id;
                    const isSelf = email === user.email.toLowerCase();
                    await addDoc(collection(db, 'notifications'), {
                        recipientId,
                        senderName: isSelf ? 'You' : (eventData?.firstName || user.email),
                        type,
                        body: isSelf ? `You ${detail}` : `${eventData?.firstName || 'A collaborator'} ${detail}`,
                        status: 'pending',
                        eventId,
                        eventTitle: eventData?.title || 'Workspace Update',
                        createdAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.error('Failed to notify participant:', email, err);
            }
        }
    };

    // ── Firebase Sync ──────────────────────────────────────────────────────────
    const syncToFirebase = async (updatedColumns) => {
        try {
            await updateDoc(doc(db, 'events', eventId), { columns: updatedColumns });
        } catch (error) {
            console.error('Sync Error:', error);
        }
    };

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleShareInvitation = async () => {
        const link = `https://occasio-866c3.web.app/index.html?id=${eventId}`;
        const message = `YOU'RE INVITED!\n\nEvent: ${eventData?.title}\nDate: ${formatDate(eventData?.startDate)}\nLocation: ${eventData?.location || 'TBD'}\n\nRSVP here:\n${link}`;
        try {
            await Share.share({ title: 'Event Invitation', message, url: link });
        } catch {
            Alert.alert('Error', 'Could not share invitation.');
        }
    };

    const openRSVPTracker = () =>
        navigation.navigate('RSVPTrackerScreen', { eventId, eventTitle: eventData?.title });

    const confirmDeleteWorkspace = async () => {
        try {
            setDeletingWorkspace(true);
            await deleteDoc(doc(db, 'events', eventId));
            setWorkspaceDeleteVisible(false);
            navigation.navigate('Dashboard');
        } catch {
            Alert.alert('Error', 'Could not delete workspace.');
        } finally {
            setDeletingWorkspace(false);
        }
    };

    const handleAddCollaborator = async () => {
        if (!collabEmail.trim()) {
            Alert.alert('Required', 'Please enter a valid email address.');
            return;
        }
        if (collabEmail.trim().toLowerCase() === auth.currentUser?.email?.toLowerCase()) {
            Alert.alert('Wait', 'You are already the owner of this workspace!');
            setCollabEmail('');
            setFoundUsers([]);
            return;
        }
        setActionLoading(true);
        setSendingInvite(true);
        try {
            const q = query(collection(db, 'users'), where('email', '==', collabEmail.trim().toLowerCase()));
            const snap = await getDocs(q);
            if (snap.empty) {
                Alert.alert('User Not Found', 'This email is not registered with Occasio.');
                return;
            }
            await addDoc(collection(db, 'notifications'), {
                type: 'COLLAB_REQUEST',
                senderName: auth.currentUser?.displayName || 'A user',
                senderEmail: auth.currentUser?.email,
                eventId,
                eventTitle: eventData?.title,
                recipientId: snap.docs[0].id,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            setCollabModalVisible(false);
            setCollabEmail('');
            setFoundUsers([]);
            Alert.alert('Invitation Sent', 'The collaboration request has been sent.');
        } catch {
            Alert.alert('Error', 'Failed to send invitation.');
        } finally {
            setActionLoading(false);
            setSendingInvite(false);
        }
    };

    const updateColumnTitle = async (columnId, newTitle) => {
        const updated = columns.map(col => col.id === columnId ? { ...col, title: newTitle } : col);
        setColumns(updated);
        await syncToFirebase(updated);
    };

    const triggerDeleteList = (columnId) => {
        setListToDelete(columnId);
        setDeleteConfirmVisible(true);
    };

    const confirmDeleteList = async () => {
        setDeletingList(true);
        try {
            const updated = columns.filter(col => col.id !== listToDelete);
            setColumns(updated);
            await syncToFirebase(updated);
            setDeleteConfirmVisible(false);
        } finally {
            setDeletingList(false);
        }
    };

    const toggleCardCompletion = async (columnId, taskId) => {
        let taskTitle = 'a card';
        let isNowCompleted = false;
        const updatedColumns = columns.map(col => {
            if (col.id === columnId) {
                return {
                    ...col,
                    tasks: col.tasks.map(t => {
                        if (t.id === taskId) {
                            taskTitle = t.title;
                            isNowCompleted = !t.completed;
                            return { ...t, completed: isNowCompleted };
                        }
                        return t;
                    })
                };
            }
            return col;
        });
        setColumns(updatedColumns);
        await syncToFirebase(updatedColumns);
        await sendUniversalNotification('item_checked', `marked "${taskTitle}" as ${isNowCompleted ? 'completed' : 'uncompleted'}`);
    };

    const openTaskDetails = (columnId, task) => {
        setActiveColumnId(columnId);
        setActiveTask({
            ...task,
            description: task.description || '',
            priority: task.priority || 'C',
            subtasks: task.subtasks || [],
            attachments: task.attachments || []
        });
        setDetailModalVisible(true);
    };

    const saveTaskDetails = async () => {
        setSavingTask(true);
        try {
            const updatedColumns = columns.map(col => {
                if (col.id === activeColumnId) {
                    return { ...col, tasks: col.tasks.map(t => t.id === activeTask.id ? activeTask : t) };
                }
                return col;
            });
            setColumns(updatedColumns);
            await syncToFirebase(updatedColumns);
            setDetailModalVisible(false);
        } finally {
            setSavingTask(false);
        }
    };

    const deleteSubtask = (subtaskId) => {
        setActiveTask({ ...activeTask, subtasks: activeTask.subtasks.filter(s => s.id !== subtaskId) });
    };

    const addSubtask = () => {
        if (!subtaskText.trim()) return;
        setActiveTask({
            ...activeTask,
            subtasks: [...(activeTask.subtasks || []), { id: Date.now().toString(), text: subtaskText, completed: false }]
        });
        setSubtaskText('');
    };

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled) return;
            setUploading(true);
            const file = result.assets[0];
            const blob = await (await fetch(file.uri)).blob();
            const fileRef = ref(storage, `event_files/${eventId}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, blob);
            const downloadUrl = await getDownloadURL(fileRef);
            setActiveTask({
                ...activeTask,
                attachments: [...(activeTask.attachments || []), { id: Date.now().toString(), url: downloadUrl, name: file.name, size: file.size }]
            });
            Alert.alert('Success', 'File uploaded successfully');
        } catch {
            Alert.alert('Error', 'Failed to upload file.');
        } finally {
            setUploading(false);
        }
    };

    const handleModalSubmit = async () => {
        // If it's already locked or empty, completely ignore the tap
        if (!inputText.trim() || submitLock.current) return; 
        
        submitLock.current = true; // Instantly lock the function
        setSubmittingModal(true);
        
        try {
            let newColumns = [...columns];
            let notificationType = '';
            let notificationDetail = '';

            if (modalConfig.type === 'ADD_COLUMN') {
                newColumns.push({ id: Date.now().toString(), title: inputText, tasks: [] });
                notificationType = 'list_added';
                notificationDetail = `added a new list: "${inputText}"`;
            } else if (modalConfig.type === 'ADD_TASK') {
                newColumns = columns.map(col => {
                    if (col.id === modalConfig.columnId) {
                        notificationDetail = `added a card "${inputText}" to ${col.title}`;
                        return {
                            ...col,
                            tasks: [...col.tasks, {
                                id: Date.now().toString(),
                                title: inputText,
                                completed: false,
                                priority: 'C',
                                description: '',
                                subtasks: [],
                                attachments: []
                            }]
                        };
                    }
                    return col;
                });
                notificationType = 'card_added';
            }

            setColumns(newColumns);
            await syncToFirebase(newColumns);
            if (notificationType) await sendUniversalNotification(notificationType, notificationDetail);
            setModalVisible(false);
            setInputText('');
        } finally {
            // Unlock it only when the entire process is finished
            submitLock.current = false; 
            setSubmittingModal(false);
        }
    };
    const handleSearchUsers = async (text) => {
        setCollabEmail(text);
        if (text.length < 3) { setFoundUsers([]); return; }
        const cleanText = text.toLowerCase();
        try {
            const q = query(collection(db, 'users'), where('email', '>=', cleanText), where('email', '<=', cleanText + '\uf8ff'), limit(5));
            const snap = await getDocs(q);
            setFoundUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.email !== auth.currentUser?.email));
        } catch (error) { console.log(error); }
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={tw`flex-1 bg-slate-50`}>
                <StatusBar barStyle="light-content" backgroundColor="#00686F" />
                <SafeAreaView style={tw`flex-1`} edges={['top', 'left', 'right']}>
                    {/* Skeleton Header */}
                    <View style={tw`bg-teal-700 px-4 pt-2 pb-5`}>
                        <View style={tw`flex-row items-center`}>
                            <View style={tw`w-10 h-10 rounded-2xl bg-white bg-opacity-20`} />
                            <View style={tw`flex-1 mx-3`}>
                                <View style={tw`h-4 w-40 rounded-full bg-white bg-opacity-30 mb-1.5`} />
                                <View style={tw`h-2.5 w-24 rounded-full bg-white bg-opacity-20`} />
                            </View>
                            <View style={tw`w-10 h-10 rounded-2xl bg-white bg-opacity-20`} />
                        </View>
                    </View>

                    {/* Skeleton Board */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={tw`px-4 py-4 items-start`}
                        scrollEnabled={false}
                    >
                        {/* Skeleton Overview Column */}
                        <View style={[
                            tw`bg-white rounded-3xl p-5 mr-4`,
                            { width: COLUMN_WIDTH, height: height * 0.72, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }
                        ]}>
                            {/* Column title row */}
                            <View style={tw`flex-row items-center justify-between mb-5`}>
                                <View style={tw`flex-row items-center`}>
                                    <View style={tw`w-9 h-9 rounded-2xl bg-slate-100`} />
                                    <View style={tw`h-4 w-24 rounded-full bg-slate-200 ml-3`} />
                                </View>
                                <View style={tw`h-7 w-14 rounded-full bg-slate-100`} />
                            </View>

                            {/* RSVP card skeleton */}
                            <View style={tw`bg-slate-100 rounded-2xl p-4 mb-4`}>
                                <View style={tw`h-2.5 w-20 rounded-full bg-slate-200 mb-3`} />
                                <View style={tw`flex-row gap-2`}>
                                    <View style={tw`flex-1 h-9 rounded-xl bg-slate-200`} />
                                    <View style={tw`flex-1 h-9 rounded-xl bg-slate-200`} />
                                </View>
                            </View>

                            {/* Info row skeletons */}
                            {[90, 120, 80, 70, 150].map((w, i) => (
                                <View key={i} style={tw`flex-row items-start py-3 border-b border-slate-100`}>
                                    <View style={tw`w-8 h-8 rounded-xl bg-slate-100 mr-3`} />
                                    <View style={tw`flex-1`}>
                                        <View style={tw`h-2 w-12 rounded-full bg-slate-200 mb-2`} />
                                        <View style={[tw`h-3 rounded-full bg-slate-100`, { width: w }]} />
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Skeleton Task Column */}
                        <View style={[
                            tw`bg-slate-100 rounded-3xl mr-4 p-4`,
                            { width: COLUMN_WIDTH, height: height * 0.72, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }
                        ]}>
                            <View style={tw`flex-row items-center justify-between mb-2`}>
                                <View style={tw`h-3.5 w-28 rounded-full bg-slate-300`} />
                                <View style={tw`h-6 w-10 rounded-full bg-white`} />
                            </View>
                            <View style={tw`h-1.5 bg-slate-200 rounded-full mb-4`} />

                            {/* Task card skeletons */}
                            {[['70%', true], ['55%', false], ['80%', true], ['60%', false]].map(([w, hasBadge], i) => (
                                <View key={i} style={[
                                    tw`bg-white rounded-2xl p-3.5 mb-2`,
                                    { borderLeftWidth: 4, borderLeftColor: '#E2E8F0' }
                                ]}>
                                    <View style={tw`flex-row items-center`}>
                                        <View style={tw`w-5 h-5 rounded-md bg-slate-100 mr-2.5`} />
                                        <View style={[tw`h-3 rounded-full bg-slate-100`, { width: w }]} />
                                    </View>
                                    {hasBadge && (
                                        <View style={tw`flex-row mt-2.5 ml-7 gap-2`}>
                                            <View style={tw`h-5 w-12 rounded-lg bg-slate-100`} />
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <View style={tw`flex-1 bg-slate-50`}>
            <StatusBar barStyle="light-content" backgroundColor="#00686F" />

            <SafeAreaView style={tw`flex-1`} edges={['top', 'left', 'right']}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <View style={tw`bg-teal-700 px-4 pt-2 pb-5`}>
                    <View style={tw`flex-row items-center`}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={tw`w-10 h-10 rounded-2xl bg-white bg-opacity-20 items-center justify-center`}
                        >
                            <Ionicons name="chevron-back" size={22} color="#FFF" />
                        </TouchableOpacity>

                        <View style={tw`flex-1 mx-3`}>
                            <CustomText style={tw`text-white text-lg font-extrabold`} numberOfLines={1}>
                                {eventData?.title}
                            </CustomText>
                            <CustomText style={tw`text-teal-200 text-xs font-bold tracking-widest mt-0.5`}>
                                EVENT WORKSPACE
                            </CustomText>
                        </View>

                        {isOwner && (
                            <TouchableOpacity
                                onPress={() => setMenuVisible(true)}
                                style={tw`w-10 h-10 rounded-2xl bg-white bg-opacity-20 items-center justify-center`}
                            >
                                <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ── Board ──────────────────────────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    snapToInterval={COLUMN_WIDTH + 16}
                    decelerationRate="fast"
                    contentContainerStyle={tw`px-4 py-4 items-start`}
                >
                    {/* ── Overview Column ──────────────────────────────── */}
                    <View style={[
                        tw`bg-white rounded-3xl p-5 mr-4`,
                        { width: COLUMN_WIDTH, maxHeight: height * 0.78, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }
                    ]}>
                        <View style={tw`flex-row items-center justify-between mb-4`}>
                            <View style={tw`flex-row items-center`}>
                                <View style={tw`w-9 h-9 rounded-2xl bg-teal-50 items-center justify-center mr-3`}>
                                    <Ionicons name="stats-chart" size={18} color="#00686F" />
                                </View>
                                <CustomText style={tw`text-slate-800 text-lg font-extrabold`}>Overview</CustomText>
                            </View>
                            {isOwner && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('UpdateEvent', { eventId, eventData })}
                                    style={tw`flex-row items-center bg-teal-50 px-3 py-1.5 rounded-full`}
                                >
                                    <Ionicons name="pencil" size={12} color="#00686F" />
                                    <CustomText style={tw`text-teal-700 text-xs font-bold ml-1`}>Edit</CustomText>
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* RSVP Card */}
                            <View style={tw`bg-teal-50 border border-teal-100 rounded-2xl p-4 mb-4`}>
                                <CustomText style={tw`text-teal-700 text-xs font-black tracking-widest mb-3`}>RSVP TRACKER</CustomText>
                                <View style={tw`flex-row gap-2`}>
                                    {isOwner && (
                                        <TouchableOpacity
                                            onPress={handleShareInvitation}
                                            style={tw`flex-1 flex-row items-center justify-center bg-teal-700 py-2.5 rounded-xl`}
                                        >
                                            <Ionicons name="share-social" size={15} color="#FFF" />
                                            <CustomText style={tw`text-white text-xs font-bold ml-1.5`}>Share Invite</CustomText>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={openRSVPTracker}
                                        style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl border border-teal-600`}
                                    >
                                        <Ionicons name="people" size={15} color="#00686F" />
                                        <CustomText style={tw`text-teal-700 text-xs font-bold ml-1.5`}>View Tracker</CustomText>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Info Rows */}
                            <InfoRow icon="pricetag-outline" label="TYPE" value={eventData?.eventType} />
                            <InfoRow icon="location-outline" label="LOCATION" value={eventData?.location || 'TBD'} />
                            <InfoRow icon="calendar-outline" label="START DATE" value={formatDate(eventData?.startDate)} />
                            <InfoRow icon="time-outline" label="START TIME" value={formatTime(eventData?.startTime)} />
                            <InfoRow icon="document-text-outline" label="DESCRIPTION" value={eventData?.description || 'No description provided'} />

                            {/* Team */}
                            <View style={tw`pt-4`}>
                                <CustomText style={tw`text-xs font-black text-slate-400 tracking-widest mb-3`}>TEAM</CustomText>
                                <View style={tw`flex-row flex-wrap`}>
                                    <CollabChip email="owner" isOwnerChip={true} />
                                    {eventData?.collaborators?.map((email, index) => (
                                        <CollabChip key={index} email={email} isOwnerChip={false} />
                                    ))}
                                </View>
                            </View>

                            <View style={tw`h-6`} />
                        </ScrollView>
                    </View>

                    {/* ── Task Columns ─────────────────────────────────── */}
                    {columns.map((col) => {
                        const completedCount = col.tasks.filter(t => t.completed).length;
                        const total = col.tasks.length;
                        const progressPct = total > 0 ? (completedCount / total) * 100 : 0;

                        return (
                            <View key={col.id} style={[
                                tw`bg-slate-100 rounded-3xl mr-4 p-4`,
                                { width: COLUMN_WIDTH, maxHeight: height * 0.78, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
                            ]}>
                                {/* Column Header */}
                                <View style={tw`flex-row items-center justify-between mb-2`}>
                                    <TextInput
                                        style={tw`flex-1 text-slate-700 font-extrabold text-sm uppercase tracking-wider`}
                                        value={col.title}
                                        editable={isOwner}
                                        onChangeText={(text) => updateColumnTitle(col.id, text)}
                                        placeholderTextColor="#94A3B8"
                                    />
                                    <View style={tw`flex-row items-center gap-2`}>
                                        {total > 0 && (
                                            <View style={tw`bg-white px-2.5 py-0.5 rounded-full`}>
                                                <CustomText style={tw`text-xs font-bold text-slate-500`}>
                                                    {completedCount}/{total}
                                                </CustomText>
                                            </View>
                                        )}
                                        {isOwner && (
                                            <TouchableOpacity
                                                onPress={() => triggerDeleteList(col.id)}
                                                style={tw`w-7 h-7 rounded-full bg-white items-center justify-center`}
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Progress bar */}
                                <View style={tw`h-1.5 bg-slate-200 rounded-full mb-3 overflow-hidden`}>
                                    <View style={[tw`h-full bg-teal-500 rounded-full`, { width: `${progressPct}%` }]} />
                                </View>

                                {/* Tasks */}
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {col.tasks.map((task) => (
                                        <Swipeable
                                            key={task.id}
                                            enabled={isOwner}
                                            renderRightActions={() => (
                                                <TouchableOpacity
                                                    style={tw`bg-red-500 justify-center items-center w-16 rounded-2xl ml-2 mb-2`}
                                                    onPress={() => {
                                                        const updated = columns.map(c =>
                                                            c.id === col.id
                                                                ? { ...c, tasks: c.tasks.filter(t => t.id !== task.id) }
                                                                : c
                                                        );
                                                        setColumns(updated);
                                                        syncToFirebase(updated);
                                                    }}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color="#FFF" />
                                                </TouchableOpacity>
                                            )}
                                        >
                                            <TouchableOpacity
                                                onPress={() => openTaskDetails(col.id, task)}
                                                activeOpacity={0.8}
                                                style={[
                                                    tw`bg-white rounded-2xl p-3.5 mb-2`,
                                                    {
                                                        borderLeftWidth: 4,
                                                        borderLeftColor: getPriorityColor(task.priority),
                                                        shadowColor: '#000',
                                                        shadowOpacity: 0.04,
                                                        shadowRadius: 4,
                                                        shadowOffset: { width: 0, height: 1 },
                                                        elevation: 1
                                                    }
                                                ]}
                                            >
                                                <View style={tw`flex-row items-start`}>
                                                    <TouchableOpacity
                                                        onPress={() => toggleCardCompletion(col.id, task.id)}
                                                        style={tw`mr-2.5 mt-0.5`}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Ionicons
                                                            name={task.completed ? 'checkbox' : 'square-outline'}
                                                            size={20}
                                                            color={task.completed ? '#10B981' : '#CBD5E1'}
                                                        />
                                                    </TouchableOpacity>
                                                    <CustomText style={[
                                                        tw`flex-1 text-sm font-semibold text-slate-700 leading-5`,
                                                        task.completed && tw`line-through text-slate-400`
                                                    ]}>
                                                        {task.text || task.title}
                                                    </CustomText>
                                                </View>

                                                {/* Badges */}
                                                {(task.subtasks?.length > 0 || task.attachments?.length > 0) && (
                                                    <View style={tw`flex-row mt-2.5 ml-7 gap-2`}>
                                                        {task.subtasks?.length > 0 && (
                                                            <View style={tw`flex-row items-center bg-slate-100 px-2 py-0.5 rounded-lg`}>
                                                                <Ionicons name="checkmark-done" size={11} color="#64748B" />
                                                                <CustomText style={tw`text-xs text-slate-500 font-semibold ml-1`}>
                                                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                                                </CustomText>
                                                            </View>
                                                        )}
                                                        {task.attachments?.length > 0 && (
                                                            <View style={tw`flex-row items-center bg-slate-100 px-2 py-0.5 rounded-lg`}>
                                                                <Ionicons name="attach" size={11} color="#64748B" />
                                                                <CustomText style={tw`text-xs text-slate-500 font-semibold ml-1`}>
                                                                    {task.attachments.length}
                                                                </CustomText>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        </Swipeable>
                                    ))}

                                    {isOwner && (
                                        <TouchableOpacity
                                            style={tw`flex-row items-center justify-center py-3 mt-1 rounded-2xl border border-dashed border-slate-300`}
                                            onPress={() => {
                                                setModalConfig({ type: 'ADD_TASK', columnId: col.id, title: 'Add a card' });
                                                setInputText('');
                                                setModalVisible(true);
                                            }}
                                        >
                                            <Ionicons name="add" size={18} color="#94A3B8" />
                                            <CustomText style={tw`text-slate-400 text-sm font-semibold ml-1.5`}>Add a card</CustomText>
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                            </View>
                        );
                    })}

                    {/* ── Add List Button ──────────────────────────────── */}
                    {isOwner && (
                        <TouchableOpacity
                            style={[
                                tw`flex-row items-center justify-center bg-white rounded-3xl px-5 py-4 mr-4`,
                                { width: COLUMN_WIDTH * 0.55, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }
                            ]}
                            onPress={() => {
                                setModalConfig({ type: 'ADD_COLUMN', title: 'New list name' });
                                setInputText('');
                                setModalVisible(true);
                            }}
                        >
                            <View style={tw`w-8 h-8 rounded-full bg-teal-50 items-center justify-center mr-2`}>
                                <Ionicons name="add" size={20} color="#00686F" />
                            </View>
                            <CustomText style={tw`text-teal-700 font-bold`}>Add list</CustomText>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODALS                                                         */}
            {/* ══════════════════════════════════════════════════════════════ */}

            {/* ── Bottom Sheet Menu ───────────────────────────────────────── */}
            <Modal transparent visible={menuVisible} animationType="slide">
                <TouchableOpacity
                    style={tw`flex-1 bg-black bg-opacity-50 justify-end`}
                    activeOpacity={1}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={tw`bg-white rounded-t-3xl pb-10 px-5`}>
                        <View style={tw`w-10 h-1.5 bg-slate-200 rounded-full self-center my-4`} />
                        <CustomText style={tw`text-slate-400 text-xs font-black tracking-widest px-1 mb-1`}>WORKSPACE OPTIONS</CustomText>

                        <TouchableOpacity
                            style={tw`flex-row items-center py-4 border-b border-slate-100`}
                            onPress={() => { setMenuVisible(false); setCollabModalVisible(true); }}
                        >
                            <View style={tw`w-10 h-10 rounded-2xl bg-teal-50 items-center justify-center mr-3`}>
                                <Ionicons name="person-add-outline" size={20} color="#00686F" />
                            </View>
                            <View style={tw`flex-1`}>
                                <CustomText style={tw`text-slate-800 font-bold text-base`}>Add Collaborator</CustomText>
                                <CustomText style={tw`text-slate-400 text-xs mt-0.5`}>Invite someone to this workspace</CustomText>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={tw`flex-row items-center py-4`}
                            onPress={() => { setMenuVisible(false); setWorkspaceDeleteVisible(true); }}
                        >
                            <View style={tw`w-10 h-10 rounded-2xl bg-red-50 items-center justify-center mr-3`}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </View>
                            <View style={tw`flex-1`}>
                                <CustomText style={tw`text-red-500 font-bold text-base`}>Delete Workspace</CustomText>
                                <CustomText style={tw`text-slate-400 text-xs mt-0.5`}>Permanently remove this event</CustomText>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Delete Workspace Confirm ─────────────────────────────────── */}
            <CustomModal visible={workspaceDeleteVisible}>
                <View style={tw`items-center`}>
                    <View style={tw`w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4`}>
                        <Ionicons name="warning" size={32} color="#EF4444" />
                    </View>
                    <CustomText style={tw`text-slate-800 text-xl font-extrabold mb-2 text-center`}>
                        Delete Workspace?
                    </CustomText>
                    <CustomText style={tw`text-slate-500 text-sm text-center leading-5 mb-6`}>
                        This will permanently delete this event and all associated tasks for everyone. This action cannot be undone.
                    </CustomText>
                    <TouchableOpacity
                        onPress={() => setWorkspaceDeleteVisible(false)}
                        style={tw`w-full bg-slate-100 py-3.5 rounded-2xl items-center mb-3`}
                    >
                        <CustomText style={tw`text-slate-600 font-bold`}>Keep Workspace</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={confirmDeleteWorkspace}
                        disabled={deletingWorkspace}
                        style={tw`w-full bg-red-500 py-3.5 rounded-2xl items-center`}
                    >
                        {deletingWorkspace
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={tw`text-white font-extrabold`}>Delete Forever</CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Invite Collaborator ──────────────────────────────────────── */}
            <CustomModal visible={collabModalVisible} avoidKeyboard={true}>
                <CustomText style={tw`text-slate-800 text-xl font-extrabold mb-1`}>Invite Collaborator</CustomText>
                <CustomText style={tw`text-slate-400 text-sm mb-4`}>Enter their registered email address</CustomText>

                <TextInput
                    style={tw`bg-slate-100 rounded-2xl px-4 py-3.5 text-slate-700 text-sm mb-3`}
                    placeholder="colleague@email.com"
                    placeholderTextColor="#94A3B8"
                    value={collabEmail}
                    onChangeText={handleSearchUsers}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                {foundUsers.length > 0 && (
                    <View style={tw`bg-slate-50 rounded-2xl mb-4 overflow-hidden border border-slate-200`}>
                        {foundUsers.map((u) => (
                            <TouchableOpacity
                                key={u.id}
                                onPress={() => setCollabEmail(u.email)}
                                style={tw`flex-row items-center px-4 py-3 border-b border-slate-100`}
                            >
                                <View style={tw`w-8 h-8 rounded-full bg-teal-600 items-center justify-center mr-3`}>
                                    <CustomText style={tw`text-white text-xs font-bold`}>
                                        {u.email.charAt(0).toUpperCase()}
                                    </CustomText>
                                </View>
                                <CustomText style={tw`text-slate-700 text-sm font-medium`}>{u.email}</CustomText>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={tw`flex-row gap-3`}>
                    <TouchableOpacity
                        onPress={() => { setCollabModalVisible(false); setCollabEmail(''); setFoundUsers([]); }}
                        style={tw`flex-1 bg-slate-100 py-3.5 rounded-2xl items-center`}
                    >
                        <CustomText style={tw`text-slate-500 font-semibold`}>Cancel</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleAddCollaborator}
                        disabled={sendingInvite}
                        style={tw`flex-1 bg-teal-700 py-3.5 rounded-2xl items-center`}
                    >
                        {sendingInvite
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={tw`text-white font-bold`}>Send Invite</CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Add Card / List Modal ────────────────────────────────────── */}
            <CustomModal visible={modalVisible} avoidKeyboard={true}>
                <CustomText style={tw`text-slate-800 text-xl font-extrabold mb-4`}>
                    {modalConfig.title}
                </CustomText>
                <TextInput
                    style={tw`bg-slate-100 rounded-2xl px-4 py-3.5 text-slate-700 text-sm mb-4`}
                    autoFocus
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={modalConfig.type === 'ADD_COLUMN' ? 'e.g. To Do, In Progress...' : 'Card title...'}
                    placeholderTextColor="#94A3B8"
                    onSubmitEditing={handleModalSubmit}
                />
                <View style={tw`flex-row gap-3`}>
                    <TouchableOpacity
                        onPress={() => setModalVisible(false)}
                        style={tw`flex-1 bg-slate-100 py-3.5 rounded-2xl items-center`}
                    >
                        <CustomText style={tw`text-slate-500 font-semibold`}>Cancel</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleModalSubmit}
                        disabled={submittingModal}
                        style={tw`flex-1 bg-teal-700 py-3.5 rounded-2xl items-center`}
                    >
                        {submittingModal
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={tw`text-white font-bold`}>
                                {modalConfig.type === 'ADD_COLUMN' ? 'Create List' : 'Add Card'}
                            </CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Delete List Confirm ──────────────────────────────────────── */}
            <CustomModal visible={deleteConfirmVisible}>
                <View style={tw`items-center`}>
                    <View style={tw`w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-4`}>
                        <Ionicons name="trash-outline" size={26} color="#EF4444" />
                    </View>
                    <CustomText style={tw`text-slate-800 text-lg font-extrabold mb-2`}>Delete this list?</CustomText>
                    <CustomText style={tw`text-slate-500 text-sm text-center mb-6`}>
                        All cards in this list will be permanently removed.
                    </CustomText>
                    <View style={tw`flex-row gap-3 w-full`}>
                        <TouchableOpacity
                            onPress={() => setDeleteConfirmVisible(false)}
                            style={tw`flex-1 bg-slate-100 py-3.5 rounded-2xl items-center`}
                        >
                            <CustomText style={tw`text-slate-500 font-semibold`}>Cancel</CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={confirmDeleteList}
                            disabled={deletingList}
                            style={tw`flex-1 bg-red-500 py-3.5 rounded-2xl items-center`}
                        >
                            {deletingList
                                ? <ActivityIndicator color="#FFF" size="small" />
                                : <CustomText style={tw`text-white font-bold`}>Delete List</CustomText>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </CustomModal>

            {/* ── Task Detail Modal ────────────────────────────────────────── */}
            <Modal visible={detailModalVisible} animationType="slide">
                <SafeAreaView style={tw`flex-1 bg-slate-50`}>
                    {/* Detail Header */}
                    <View style={tw`flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate-100`}>
                        <TouchableOpacity
                            onPress={() => setDetailModalVisible(false)}
                            style={tw`w-9 h-9 rounded-full bg-slate-100 items-center justify-center`}
                        >
                            <Ionicons name="close" size={20} color="#64748B" />
                        </TouchableOpacity>

                        <CustomText style={tw`text-slate-800 text-base font-extrabold`}>Task Details</CustomText>

                        <TouchableOpacity
                            onPress={saveTaskDetails}
                            disabled={savingTask}
                            style={tw`bg-teal-700 px-4 py-2 rounded-full min-w-16 items-center justify-center`}
                        >
                            {savingTask
                                ? <ActivityIndicator color="#FFF" size="small" />
                                : <CustomText style={tw`text-white text-sm font-bold`}>Update</CustomText>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={tw`flex-1`}
                        contentContainerStyle={tw`px-4 py-5`}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Title */}
                        <SectionLabel icon="text" label="TITLE" />
                        <TextInput
                            style={tw`bg-white rounded-2xl px-4 py-3.5 text-slate-800 font-bold text-base border border-slate-200 mb-5`}
                            value={activeTask?.text}
                            editable={isOwner}
                            placeholder="Task title..."
                            placeholderTextColor="#94A3B8"
                            onChangeText={(t) => setActiveTask({ ...activeTask, text: t })}
                        />

                        {/* Priority */}
                        <SectionLabel icon="flag" label="PRIORITY" />
                        <View style={tw`flex-row gap-2 mb-5`}>
                            {['A', 'B', 'C'].map((p) => {
                                const active = activeTask?.priority === p;
                                const color = getPriorityColor(p);
                                return (
                                    <TouchableOpacity
                                        key={p}
                                        disabled={!isOwner}
                                        onPress={() => setActiveTask({ ...activeTask, priority: p })}
                                        style={[
                                            tw`flex-1 py-3 rounded-2xl items-center border-2`,
                                            active
                                                ? { backgroundColor: color, borderColor: color }
                                                : tw`bg-white border-slate-200`
                                        ]}
                                    >
                                        <CustomText style={{ color: active ? '#FFF' : '#64748B', fontWeight: '700', fontSize: 13 }}>
                                            {getPriorityLabel(p)}
                                        </CustomText>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Description */}
                        <SectionLabel icon="document-text" label="DESCRIPTION" />
                        <TextInput
                            style={[tw`bg-white rounded-2xl px-4 py-3.5 text-slate-600 border border-slate-200 mb-5 text-sm`, { height: 110, textAlignVertical: 'top' }]}
                            multiline
                            value={activeTask?.description}
                            editable={isOwner}
                            placeholder={isOwner ? 'Add a description...' : 'No description.'}
                            placeholderTextColor="#94A3B8"
                            onChangeText={(t) => setActiveTask({ ...activeTask, description: t })}
                        />

                        {/* Checklist */}
                        <View style={tw`flex-row items-center mb-3`}>
                            <Ionicons name="list" size={16} color="#00686F" />
                            <CustomText style={tw`text-xs font-black text-slate-400 tracking-widest ml-2`}>CHECKLIST</CustomText>
                            {activeTask?.subtasks?.length > 0 && (
                                <View style={tw`ml-2 bg-teal-50 px-2 py-0.5 rounded-full`}>
                                    <CustomText style={tw`text-xs text-teal-700 font-bold`}>
                                        {activeTask.subtasks.filter(s => s.completed).length}/{activeTask.subtasks.length}
                                    </CustomText>
                                </View>
                            )}
                        </View>

                        {/* Subtask progress */}
                        {activeTask?.subtasks?.length > 0 && (
                            <View style={tw`h-1.5 bg-slate-200 rounded-full mb-3 overflow-hidden`}>
                                <View style={[
                                    tw`h-full bg-teal-500 rounded-full`,
                                    { width: `${(activeTask.subtasks.filter(s => s.completed).length / activeTask.subtasks.length) * 100}%` }
                                ]} />
                            </View>
                        )}

                        {activeTask?.subtasks?.map((sub) => (
                            <View key={sub.id} style={tw`flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 border border-slate-200`}>
                                <TouchableOpacity
                                    onPress={() => {
                                        const updated = activeTask.subtasks.map(s =>
                                            s.id === sub.id ? { ...s, completed: !s.completed } : s
                                        );
                                        setActiveTask({ ...activeTask, subtasks: updated });
                                    }}
                                    style={tw`mr-3`}
                                >
                                    <Ionicons
                                        name={sub.completed ? 'checkbox' : 'square-outline'}
                                        size={22}
                                        color={sub.completed ? '#10B981' : '#CBD5E1'}
                                    />
                                </TouchableOpacity>
                                <CustomText style={[tw`flex-1 text-sm text-slate-700 font-medium`, sub.completed && tw`line-through text-slate-400`]}>
                                    {sub.text}
                                </CustomText>
                                {isOwner && (
                                    <TouchableOpacity onPress={() => deleteSubtask(sub.id)} style={tw`ml-2 p-1`}>
                                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        {isOwner && (
                            <View style={tw`flex-row gap-2 mt-1 mb-6`}>
                                <TextInput
                                    style={tw`flex-1 bg-white rounded-2xl px-4 py-3 border border-slate-200 text-sm text-slate-700`}
                                    placeholder="Add checklist item..."
                                    placeholderTextColor="#94A3B8"
                                    value={subtaskText}
                                    onChangeText={setSubtaskText}
                                    onSubmitEditing={addSubtask}
                                />
                                <TouchableOpacity
                                    onPress={addSubtask}
                                    style={tw`w-12 bg-teal-700 rounded-2xl items-center justify-center`}
                                >
                                    <Ionicons name="add" size={22} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Attachments */}
                        <SectionLabel icon="attach" label="ATTACHMENTS" />

                        {activeTask?.attachments?.map((file) => (
                            <View key={file.id} style={tw`flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 border border-slate-200`}>
                                <TouchableOpacity
                                    style={tw`flex-row items-center flex-1`}
                                    onPress={() => Linking.openURL(file.url)}
                                >
                                    <View style={tw`w-8 h-8 rounded-xl bg-teal-50 items-center justify-center mr-3`}>
                                        <Ionicons name="document-outline" size={16} color="#00686F" />
                                    </View>
                                    <CustomText style={tw`text-teal-700 text-sm font-semibold underline flex-1`} numberOfLines={1}>
                                        {file.name || 'View Document'}
                                    </CustomText>
                                </TouchableOpacity>
                                {isOwner && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setActiveTask({
                                                ...activeTask,
                                                attachments: activeTask.attachments.filter(a => a.id !== file.id)
                                            });
                                        }}
                                        style={tw`ml-2`}
                                    >
                                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        <TouchableOpacity
                            onPress={handleFileUpload}
                            disabled={uploading}
                            style={tw`flex-row items-center justify-center py-4 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 mt-2 mb-8`}
                        >
                            {uploading
                                ? <ActivityIndicator color="#00686F" />
                                : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={20} color="#00686F" />
                                        <CustomText style={tw`text-teal-700 font-bold text-sm ml-2`}>Upload from device</CustomText>
                                    </>
                                )
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

// ── Internal helper component (defined outside main to avoid re-renders) ──────
const SectionLabel = ({ icon, label }) => (
    <View style={tw`flex-row items-center mb-2`}>
        <Ionicons name={icon} size={16} color="#00686F" />
        <CustomText style={tw`text-xs font-black text-slate-400 tracking-widest ml-2`}>{label}</CustomText>
    </View>
);