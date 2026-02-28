import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, TouchableOpacity, Dimensions, Animated,
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
    if (typeof timeVal === 'string') return timeVal;
    let t = timeVal.seconds ? new Date(timeVal.seconds * 1000) : new Date(timeVal);
    if (isNaN(t.getTime())) return 'Not set';
    return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const getPriorityColor = (p) =>
    p === 'A' ? '#EF4444' : p === 'B' ? '#F59E0B' : '#10B981';

const getPriorityLabel = (p) =>
    p === 'A' ? 'High' : p === 'B' ? 'Medium' : 'Low';

// ─── Sub-components ───────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value }) => (
    <View style={tw`flex-row items-center py-3 border-b border-slate-100`}>
        <View style={tw`w-8 h-8 rounded-xl bg-teal-50 items-center justify-center mr-3`}>
            <Ionicons name={icon} size={15} color="#00686F" />
        </View>
        <View style={tw`flex-1`}>
            <CustomText style={tw`text-[10px] font-bold text-slate-400 tracking-widest mb-0.5`}>{label}</CustomText>
            <CustomText style={tw`text-[13px] text-slate-700 font-semibold`} numberOfLines={2}>{value || '—'}</CustomText>
        </View>
    </View>
);

const CollabChip = ({ email, isOwnerChip, ownerName }) => (
    <View style={[
        tw`flex-row items-center rounded-2xl px-3 py-1.5 mr-2 mb-2`,
        isOwnerChip
            ? { backgroundColor: '#E8F5F5', borderWidth: 1, borderColor: '#99D6D9' }
            : { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }
    ]}>
        <View style={[
            tw`w-5 h-5 rounded-full items-center justify-center mr-1.5`,
            isOwnerChip ? { backgroundColor: '#00686F' } : { backgroundColor: '#94A3B8' }
        ]}>
            {isOwnerChip
                ? <Ionicons name="star" size={9} color="#FFF" />
                : <CustomText style={tw`text-white text-xs font-bold`}>{email.charAt(0).toUpperCase()}</CustomText>
            }
        </View>
        <View>
            {isOwnerChip && (
                <CustomText style={{ fontSize: 9, color: '#00686F', fontWeight: '900', letterSpacing: 0.5 }}>
                    OWNER
                </CustomText>
            )}
            <CustomText
                style={[tw`text-xs font-semibold`, isOwnerChip ? { color: '#00686F' } : tw`text-slate-600`]}
                numberOfLines={1}
            >
                {isOwnerChip ? ownerName : email}
            </CustomText>
        </View>
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EventDetailsScreen({ route, navigation }) {
    const { eventId } = route.params;
    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingInvitation, setUploadingInvitation] = useState(false);
    const [invitationFile, setInvitationFile] = useState(null); // { url, name }
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

    // ── Scroll navigation refs ─────────────────────────────────────────────────
    const mainScrollRef = useRef(null);
    const overviewRef   = useRef(null);
    const sectionOffsets = useRef({});

    const isOwner = useMemo(() => eventData?.userId === auth.currentUser?.uid, [eventData]);
    const [ownerName, setOwnerName] = useState('Owner');
    const [overviewCollapsed, setOverviewCollapsed] = useState(true);
    const overviewAnim = useRef(new Animated.Value(0)).current;

    // ── Overall planning progress (tasks + subtasks across all lists) ──────────
    const overallProgress = useMemo(() => {
        if (!columns || columns.length === 0) return null;

        let totalItems = 0;
        let completedItems = 0;

        columns.forEach(col => {
            (col.tasks || []).forEach(task => {
                // Count the task itself
                totalItems += 1;
                if (task.completed) completedItems += 1;

                // Count each subtask
                (task.subtasks || []).forEach(sub => {
                    totalItems += 1;
                    if (sub.completed) completedItems += 1;
                });
            });
        });

        if (totalItems === 0) return null;
        return Math.round((completedItems / totalItems) * 100);
    }, [columns]);

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
                        if (data.invitationFile) setInvitationFile(data.invitationFile);
                        // Fetch owner's display name
                        if (data.userId) {
                            try {
                                const userSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', data.userId), limit(1)));
                                if (!userSnap.empty) {
                                    const u = userSnap.docs[0].data();
                                    const name = u.displayName || u.firstName || u.name || u.email || 'Owner';
                                    if (isActive) setOwnerName(name);
                                }
                            } catch (_) {}
                        }
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

    const handleUploadInvitation = async () => {
        // ── Cloudinary config — replace with your own values ────────────────────
        const CLOUDINARY_CLOUD_NAME    = 'dgvbemrgw';    // e.g. 'dxyz123abc'
        const CLOUDINARY_UPLOAD_PRESET = 'invitation'; // must be Unsigned
        // ─────────────────────────────────────────────────────────────────────────
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled) return;
            setUploadingInvitation(true);

            const file = result.assets[0];
            if (!file?.uri) throw new Error('No file URI returned from picker');

            // Build FormData — only params allowed by unsigned presets
            const formData = new FormData();
            formData.append('file', {
                uri:  file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
            });
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            formData.append('folder', `occasio/invitations/${eventId}`);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || `Cloudinary error ${response.status}`);
            }

            const cloudData = await response.json();

            // Inject fl_attachment into the URL so guests download instead of preview.
            // This is done on the URL string — NOT as an upload param — so it works
            // with unsigned presets.
            const downloadUrl = cloudData.secure_url.replace('/upload/', '/upload/fl_attachment/');

            const invFile = { url: downloadUrl, name: file.name };
            await updateDoc(doc(db, 'events', eventId), { invitationFile: invFile });
            setInvitationFile(invFile);
            Alert.alert('Uploaded!', `"${file.name}" is now attached as the invitation file.`);
        } catch (error) {
            console.error('Invitation upload error:', error);
            Alert.alert('Upload Failed', error.message || 'Something went wrong. Please try again.');
        } finally {
            setUploadingInvitation(false);
        }
    };

    // ── FIXED: Centralized modal close — resets all modal state reliably ───────
    const closeModal = () => {
        setModalVisible(false);
        setInputText('');
        setSubmittingModal(false);
        submitLock.current = false;
    };

    // ── FIXED: handleModalSubmit ───────────────────────────────────────────────
    const handleModalSubmit = async () => {
        // Guard: empty input or already running
        if (!inputText.trim() || submitLock.current) return;

        submitLock.current = true;
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

            // Fire-and-forget — a notification failure must NOT block modal close
            if (notificationType) {
                sendUniversalNotification(notificationType, notificationDetail).catch(console.error);
            }
        } finally {
            // Always runs regardless of success or error — modal always closes cleanly
            closeModal();
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
            <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                <StatusBar barStyle="light-content" backgroundColor="#00686F" />
                <SafeAreaView style={tw`flex-1`} edges={['top', 'left', 'right']}>
                    {/* Skeleton Hero */}
                    <View style={{ backgroundColor: '#00686F', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
                        <View style={tw`flex-row items-center mb-4`}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                <View style={{ height: 18, width: 160, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 6 }} />
                                <View style={{ height: 11, width: 100, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                            </View>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        </View>
                        <View style={{ height: 56, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                    </View>
                    {/* Skeleton tab bar */}
                    <View style={{ height: 52, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        {[80, 100, 70, 90].map((w, i) => (
                            <View key={i} style={{ width: w, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9' }} />
                        ))}
                    </View>
                    {/* Skeleton list */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                        {[1, 2, 3].map((_, i) => (
                            <View key={i} style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
                                <View style={{ height: 13, width: 120, borderRadius: 6, backgroundColor: '#F1F5F9', marginBottom: 12 }} />
                                {[1, 2, 3].map((_, j) => (
                                    <View key={j} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: j < 2 ? 1 : 0, borderBottomColor: '#F8FAFC' }}>
                                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 12 }} />
                                        <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: '#F1F5F9' }} />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    // ── Helpers for new layout ─────────────────────────────────────────────────
    const PRIORITY_META = {
        A: { label: 'High',   color: '#EF4444', bg: '#FEF2F2' },
        B: { label: 'Med',    color: '#F59E0B', bg: '#FFFBEB' },
        C: { label: 'Low',    color: '#10B981', bg: '#F0FDF4' },
    };

    const totalTasks = columns.reduce((a, c) => a + (c.tasks?.length || 0), 0);
    const doneTasks  = columns.reduce((a, c) => a + (c.tasks?.filter(t => t.completed).length || 0), 0);

    const toggleOverview = () => {
        const toValue = overviewCollapsed ? 1 : 0;
        setOverviewCollapsed(prev => !prev);
        Animated.timing(overviewAnim, {
            toValue,
            duration: 260,
            useNativeDriver: true,
        }).start();
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#F4F6F9' }}>
            <StatusBar barStyle="light-content" backgroundColor="#00686F" />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

                {/* ═══════════════════════════════════════════════════════
                    HERO HEADER
                    ─ Deep teal, compact, information-rich
                ═══════════════════════════════════════════════════════ */}
                <View style={{ backgroundColor: '#00686F' }}>
                    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 }}>

                        {/* Top bar */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="chevron-back" size={20} color="#FFF" />
                            </TouchableOpacity>

                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                <CustomText style={{ color: '#FFF', fontSize: 18, fontWeight: '800', lineHeight: 22 }} numberOfLines={1}>
                                    {eventData?.title}
                                </CustomText>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 }}>
                                    {eventData?.eventType ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                                            <Ionicons name="pricetag-outline" size={9} color="rgba(255,255,255,0.85)" />
                                            <CustomText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>
                                                {eventData.eventType}
                                            </CustomText>
                                        </View>
                                    ) : null}
                                    {eventData?.startDate ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                                            <Ionicons name="calendar-outline" size={9} color="rgba(255,255,255,0.85)" />
                                            <CustomText style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>
                                                {formatDate(eventData.startDate)}
                                            </CustomText>
                                        </View>
                                    ) : null}
                                </View>
                            </View>

                            {isOwner && (
                                <TouchableOpacity
                                    onPress={() => setMenuVisible(true)}
                                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Progress card — only when tasks exist */}
                        {overallProgress !== null && (
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 18, padding: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons
                                            name={overallProgress === 100 ? 'checkmark-circle' : 'analytics-outline'}
                                            size={15}
                                            color={overallProgress === 100 ? '#6EE7B7' : 'rgba(255,255,255,0.8)'}
                                        />
                                        <CustomText style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginLeft: 6 }}>
                                            PLANNING PROGRESS
                                        </CustomText>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 22, fontWeight: '900', lineHeight: 26 }}>
                                            {overallProgress}
                                        </CustomText>
                                        <CustomText style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginLeft: 1 }}>%</CustomText>
                                    </View>
                                </View>

                                {/* Segmented progress bar */}
                                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                                    <View style={{
                                        height: '100%',
                                        width: `${overallProgress}%`,
                                        backgroundColor: overallProgress === 100 ? '#6EE7B7' : '#FFF',
                                        borderRadius: 3,
                                    }} />
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <CustomText style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                                        {overallProgress === 100
                                            ? `🎉 ${eventData?.title} is fully planned!`
                                            : `${doneTasks} of ${totalTasks} tasks done`}
                                    </CustomText>
                                    <CustomText style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600' }}>
                                        {columns.length} {columns.length === 1 ? 'list' : 'lists'}
                                    </CustomText>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* ── Tab Bar — sticks to bottom of header ── */}
                    <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
                        >
                            {/* Overview tab */}
                            <TouchableOpacity
                                onPress={() => {
                                    // scroll to overview — handled by ref below
                                    overviewRef.current?.scrollTo({ y: 0, animated: true });
                                    mainScrollRef.current?.scrollTo({ y: 0, animated: true });
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    backgroundColor: '#00686F',
                                    shadowColor: '#00686F',
                                    shadowOpacity: 0.35,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 4,
                                }}
                            >
                                <Ionicons name="grid-outline" size={12} color="#FFF" />
                                <CustomText style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Overview</CustomText>
                            </TouchableOpacity>

                            {/* + New List tab */}
                            {isOwner && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setModalConfig({ type: 'ADD_COLUMN', title: 'New list name' });
                                        setInputText('');
                                        setModalVisible(true);
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 14,
                                        paddingVertical: 7,
                                        borderRadius: 20,
                                        borderWidth: 1.5,
                                        borderColor: '#00686F',
                                        borderStyle: 'dashed',
                                        backgroundColor: '#F0F9F9',
                                    }}
                                >
                                    <Ionicons name="add" size={13} color="#00686F" />
                                    <CustomText style={{ color: '#00686F', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>New List</CustomText>
                                </TouchableOpacity>
                            )}

                            {/* List tabs */}
                            {columns.map((col) => {
                                const done = col.tasks?.filter(t => t.completed).length || 0;
                                const tot  = col.tasks?.length || 0;
                                const pct  = tot > 0 ? Math.round((done / tot) * 100) : 0;
                                return (
                                    <TouchableOpacity
                                        key={col.id}
                                        onPress={() => {
                                            const idx = columns.indexOf(col);
                                            sectionRefs.current[idx]?.scrollIntoView?.();
                                            // RN equivalent: scroll main to that section
                                            sectionOffsets.current[col.id] && mainScrollRef.current?.scrollTo({
                                                y: sectionOffsets.current[col.id],
                                                animated: true
                                            });
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingHorizontal: 14,
                                            paddingVertical: 7,
                                            borderRadius: 20,
                                            backgroundColor: '#F4F6F9',
                                            borderWidth: 1,
                                            borderColor: '#E8ECF0',
                                        }}
                                    >
                                        <CustomText style={{ color: '#475569', fontSize: 12, fontWeight: '700' }}>{col.title}</CustomText>
                                        {tot > 0 && (
                                            <View style={{ marginLeft: 6, backgroundColor: pct === 100 ? '#D1FAE5' : '#E8F5F5', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                                                <CustomText style={{ color: pct === 100 ? '#059669' : '#00686F', fontSize: 10, fontWeight: '800' }}>
                                                    {pct}%
                                                </CustomText>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                            
                        </ScrollView>
                    </View>
                </View>

                {/* ═══════════════════════════════════════════════════════
                    MAIN SCROLL CANVAS
                ═══════════════════════════════════════════════════════ */}
                <ScrollView
                    ref={mainScrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >

                    {/* ── OVERVIEW SECTION ──────────────────────────────── */}
                    <View
                        ref={overviewRef}
                        style={{
                            backgroundColor: '#FFF',
                            marginHorizontal: 16,
                            marginTop: 16,
                            borderRadius: 20,
                            overflow: 'hidden',
                            shadowColor: '#00686F',
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 3 },
                            elevation: 3,
                        }}
                    >
                        {/* Section header — tap to collapse/expand */}
                        <TouchableOpacity
                            onPress={toggleOverview}
                            activeOpacity={0.8}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: overviewCollapsed ? 0 : 1, borderBottomColor: '#F8FAFC' }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                    <Ionicons name="calendar" size={16} color="#00686F" />
                                </View>
                                <View>
                                    <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '800' }}>Event Overview</CustomText>
                                    <CustomText style={{ color: '#94A3B8', fontSize: 11, fontWeight: '500', marginTop: 1 }}>
                                        {overviewCollapsed ? 'Tap to expand' : 'Details & team'}
                                    </CustomText>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {isOwner && !overviewCollapsed && (
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('UpdateEvent', { eventId, eventData })}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                                    >
                                        <Ionicons name="pencil-outline" size={12} color="#64748B" />
                                        <CustomText style={{ color: '#64748B', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Edit</CustomText>
                                    </TouchableOpacity>
                                )}
                                <Animated.View style={{
                                    transform: [{
                                        rotate: overviewAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
                                    }]
                                }}>
                                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                </Animated.View>
                            </View>
                        </TouchableOpacity>

                        {!overviewCollapsed && (
                            <>
                                {/* Quick stats row */}
                                <View style={{ flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 14, gap: 10 }}>
                                    {[
                                        { icon: 'location-outline',   label: 'Location', value: eventData?.location || 'TBD' },
                                        { icon: 'time-outline',       label: 'Time',     value: formatTime(eventData?.startTime) },
                                    ].map((item) => (
                                        <View key={item.label} style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12 }}>
                                            <Ionicons name={item.icon} size={14} color="#00686F" />
                                            <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 6, marginBottom: 2 }}>
                                                {item.label.toUpperCase()}
                                            </CustomText>
                                            <CustomText style={{ color: '#334155', fontSize: 12, fontWeight: '700' }} numberOfLines={2}>
                                                {item.value}
                                            </CustomText>
                                        </View>
                                    ))}
                                </View>

                                {/* Info rows */}
                                <View style={{ paddingHorizontal: 18 }}>
                                    <InfoRow icon="pricetag-outline"   label="TYPE"        value={eventData?.eventType} />
                                    <InfoRow icon="document-text-outline" label="DESCRIPTION" value={eventData?.description || 'No description provided'} />
                                    {eventData?.theme && (
                                        <InfoRow icon="color-palette-outline" label="THEME" value={eventData.theme} />
                                    )}
                                </View>

                                {/* RSVP strip */}
                                <View style={{ marginHorizontal: 18, marginTop: 14, marginBottom: 4, backgroundColor: '#E8F5F5', borderRadius: 14, padding: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Ionicons name="people-outline" size={13} color="#00686F" />
                                        <CustomText style={{ color: '#00686F', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginLeft: 5 }}>RSVP</CustomText>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        {isOwner && (
                                            <TouchableOpacity
                                                onPress={handleShareInvitation}
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00686F', paddingVertical: 10, borderRadius: 12 }}
                                            >
                                                <Ionicons name="share-social" size={13} color="#FFF" />
                                                <CustomText style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Share Invite</CustomText>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            onPress={openRSVPTracker}
                                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#00686F' }}
                                        >
                                            <Ionicons name="list-outline" size={13} color="#00686F" />
                                            <CustomText style={{ color: '#00686F', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>View Tracker</CustomText>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Invitation file — upload (owner) or show attached file */}
                                    {isOwner && (
                                        <View style={{ marginTop: 10 }}>
                                            {invitationFile ? (
                                                <View style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: '#99D6D9' }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                                                            <Ionicons name="document-attach-outline" size={15} color="#00686F" />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <CustomText style={{ color: '#94A3B8', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>INVITATION FILE</CustomText>
                                                            <CustomText style={{ color: '#0F172A', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{invitationFile.name}</CustomText>
                                                        </View>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={handleUploadInvitation}
                                                        disabled={uploadingInvitation}
                                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#00686F', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 8 }}
                                                    >
                                                        {uploadingInvitation
                                                            ? <ActivityIndicator size="small" color="#00686F" />
                                                            : <>
                                                                <Ionicons name="refresh-outline" size={13} color="#00686F" />
                                                                <CustomText style={{ color: '#00686F', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Replace File</CustomText>
                                                            </>
                                                        }
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={handleUploadInvitation}
                                                    disabled={uploadingInvitation}
                                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#00686F', borderStyle: 'dashed' }}
                                                >
                                                    {uploadingInvitation
                                                        ? <ActivityIndicator size="small" color="#00686F" />
                                                        : <>
                                                            <Ionicons name="cloud-upload-outline" size={13} color="#00686F" />
                                                            <CustomText style={{ color: '#00686F', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Upload Invitation</CustomText>
                                                        </>
                                                    }
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* Team */}
                                <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                        <Ionicons name="people-outline" size={12} color="#94A3B8" />
                                        <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginLeft: 5 }}>TEAM</CustomText>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                        <CollabChip email="owner" isOwnerChip={true} ownerName={ownerName} />
                                        {eventData?.collaborators?.map((email, index) => (
                                            <CollabChip key={index} email={email} isOwnerChip={false} />
                                        ))}
                                    </View>
                                </View>
                            </>
                        )}
                    </View>

                    {/* ── TASK LIST SECTIONS ─────────────────────────────── */}
                    {columns.map((col, colIndex) => {
                        const completedCount = col.tasks.filter(t => t.completed).length;
                        const total          = col.tasks.length;
                        const progressPct    = total > 0 ? (completedCount / total) * 100 : 0;
                        const isAllDone      = total > 0 && completedCount === total;

                        return (
                            <View
                                key={col.id}
                                onLayout={(e) => {
                                    sectionOffsets.current[col.id] = e.nativeEvent.layout.y;
                                }}
                                style={{
                                    marginHorizontal: 16,
                                    marginTop: 14,
                                    backgroundColor: '#FFF',
                                    borderRadius: 20,
                                    overflow: 'hidden',
                                    shadowColor: '#64748B',
                                    shadowOpacity: 0.06,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                }}
                            >
                                {/* Thin priority accent line */}
                                <View style={{ height: 3, backgroundColor: isAllDone ? '#10B981' : '#00686F' }} />

                                {/* List header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                        {isAllDone ? (
                                            <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                                        ) : (
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00686F', marginRight: 8 }} />
                                        )}
                                        <TextInput
                                            style={{ flex: 1, fontSize: 14, fontWeight: '800', color: isAllDone ? '#10B981' : '#1E293B', letterSpacing: 0.3, textTransform: 'uppercase', padding: 0 }}
                                            value={col.title}
                                            editable={isOwner}
                                            onChangeText={(text) => updateColumnTitle(col.id, text)}
                                            placeholderTextColor="#94A3B8"
                                        />
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        {total > 0 && (
                                            <View style={{ backgroundColor: isAllDone ? '#D1FAE5' : '#F4F6F9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                                                <CustomText style={{ color: isAllDone ? '#059669' : '#64748B', fontSize: 11, fontWeight: '800' }}>
                                                    {completedCount}/{total}
                                                </CustomText>
                                            </View>
                                        )}
                                        {isOwner && (
                                            <TouchableOpacity
                                                onPress={() => triggerDeleteList(col.id)}
                                                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                {/* Mini progress bar */}
                                <View style={{ marginHorizontal: 16, height: 3, backgroundColor: '#F1F5F9', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
                                    <View style={{ height: '100%', width: `${progressPct}%`, backgroundColor: isAllDone ? '#10B981' : '#00686F', borderRadius: 2 }} />
                                </View>

                                {/* Empty state */}
                                {col.tasks.length === 0 && (
                                    <View style={{ alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 }}>
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                            <Ionicons name="clipboard-outline" size={22} color="#CBD5E1" />
                                        </View>
                                        <CustomText style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '600' }}>No tasks yet</CustomText>
                                        <CustomText style={{ color: '#E2E8F0', fontSize: 11, fontWeight: '500', marginTop: 3 }}>Add one below</CustomText>
                                    </View>
                                )}

                                {/* Task rows */}
                                {col.tasks.map((task, taskIndex) => {
                                    const pm = PRIORITY_META[task.priority] || PRIORITY_META.C;
                                    const isLast = taskIndex === col.tasks.length - 1 && !isOwner;
                                    return (
                                        <Swipeable
                                            key={task.id}
                                            enabled={isOwner}
                                            renderRightActions={() => (
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 70, marginBottom: 0 }}
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
                                                    <Ionicons name="trash-outline" size={18} color="#FFF" />
                                                </TouchableOpacity>
                                            )}
                                        >
                                            <TouchableOpacity
                                                onPress={() => openTaskDetails(col.id, task)}
                                                activeOpacity={0.7}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 13,
                                                    backgroundColor: '#FFF',
                                                    borderTopWidth: taskIndex === 0 ? 1 : 0,
                                                    borderBottomWidth: 1,
                                                    borderColor: '#F8FAFC',
                                                }}
                                            >
                                                {/* Circle checkbox */}
                                                <TouchableOpacity
                                                    onPress={() => toggleCardCompletion(col.id, task.id)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    style={{ marginRight: 12 }}
                                                >
                                                    <View style={{
                                                        width: 22,
                                                        height: 22,
                                                        borderRadius: 11,
                                                        borderWidth: task.completed ? 0 : 2,
                                                        borderColor: pm.color,
                                                        backgroundColor: task.completed ? '#10B981' : 'transparent',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}>
                                                        {task.completed && <Ionicons name="checkmark" size={13} color="#FFF" />}
                                                    </View>
                                                </TouchableOpacity>

                                                {/* Task info */}
                                                <View style={{ flex: 1 }}>
                                                    <CustomText
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: '600',
                                                            color: task.completed ? '#94A3B8' : '#1E293B',
                                                            textDecorationLine: task.completed ? 'line-through' : 'none',
                                                            lineHeight: 20,
                                                        }}
                                                        numberOfLines={2}
                                                    >
                                                        {task.text || task.title}
                                                    </CustomText>

                                                    {/* Meta row */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                                                        {/* Priority pill */}
                                                        {!task.completed && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pm.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: pm.color, marginRight: 4 }} />
                                                                <CustomText style={{ color: pm.color, fontSize: 10, fontWeight: '700' }}>{pm.label}</CustomText>
                                                            </View>
                                                        )}
                                                        {/* Subtask badge */}
                                                        {task.subtasks?.length > 0 && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                                <Ionicons name="checkmark-done-outline" size={11} color="#94A3B8" />
                                                                <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600' }}>
                                                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                                                                </CustomText>
                                                            </View>
                                                        )}
                                                        {/* Attachment badge */}
                                                        {task.attachments?.length > 0 && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                                <Ionicons name="attach" size={11} color="#94A3B8" />
                                                                <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600' }}>
                                                                    {task.attachments.length}
                                                                </CustomText>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Chevron */}
                                                <Ionicons name="chevron-forward" size={15} color="#E2E8F0" style={{ marginLeft: 8 }} />
                                            </TouchableOpacity>
                                        </Swipeable>
                                    );
                                })}

                                {/* Add task row */}
                                {isOwner && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setModalConfig({ type: 'ADD_TASK', columnId: col.id, title: 'Add a card' });
                                            setInputText('');
                                            setModalVisible(true);
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F8FAFC' }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                            <Ionicons name="add" size={14} color="#00686F" />
                                        </View>
                                        <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700' }}>Add task</CustomText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}

                </ScrollView>

            </SafeAreaView>

            {/* ═══════════════════════════════════════════════════════════════
                MODALS — all logic unchanged
            ═══════════════════════════════════════════════════════════════ */}

            {/* ── Bottom Sheet Menu ────────────────────────────────────────── */}
            <Modal transparent visible={menuVisible} animationType="slide">
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, paddingHorizontal: 20 }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 20 }} />

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Ionicons name="settings-outline" size={18} color="#00686F" />
                            </View>
                            <View>
                                <CustomText style={{ color: '#0F172A', fontSize: 16, fontWeight: '800' }}>Workspace Options</CustomText>
                                <CustomText style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>{eventData?.title}</CustomText>
                            </View>
                        </View>

                        {/* Option rows */}
                        {[
                            {
                                icon: 'person-add-outline',
                                iconBg: '#E8F5F5',
                                iconColor: '#00686F',
                                label: 'Add Collaborator',
                                sub: 'Invite someone to this workspace',
                                labelColor: '#0F172A',
                                onPress: () => { setMenuVisible(false); setCollabModalVisible(true); }
                            },
                            {
                                icon: 'trash-outline',
                                iconBg: '#FEF2F2',
                                iconColor: '#EF4444',
                                label: 'Delete Workspace',
                                sub: 'Permanently remove this event',
                                labelColor: '#EF4444',
                                onPress: () => { setMenuVisible(false); setWorkspaceDeleteVisible(true); }
                            }
                        ].map((opt, i, arr) => (
                            <TouchableOpacity
                                key={opt.label}
                                onPress={opt.onPress}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 14,
                                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                                    borderBottomColor: '#F8FAFC',
                                }}
                            >
                                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: opt.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                    <Ionicons name={opt.icon} size={19} color={opt.iconColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <CustomText style={{ color: opt.labelColor, fontSize: 15, fontWeight: '700' }}>{opt.label}</CustomText>
                                    <CustomText style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', marginTop: 2 }}>{opt.sub}</CustomText>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Delete Workspace Confirm ──────────────────────────────────── */}
            <CustomModal visible={workspaceDeleteVisible}>
                <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Ionicons name="warning" size={28} color="#EF4444" />
                    </View>
                    <CustomText style={{ color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
                        Delete Workspace?
                    </CustomText>
                    <CustomText style={{ color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                        This will permanently delete this event and all associated tasks for everyone. This action cannot be undone.
                    </CustomText>
                    <TouchableOpacity
                        onPress={() => setWorkspaceDeleteVisible(false)}
                        style={{ width: '100%', backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginBottom: 10 }}
                    >
                        <CustomText style={{ color: '#475569', fontWeight: '700', fontSize: 15 }}>Keep Workspace</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={confirmDeleteWorkspace}
                        disabled={deletingWorkspace}
                        style={{ width: '100%', backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                    >
                        {deletingWorkspace
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Delete Forever</CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Invite Collaborator ────────────────────────────────────────── */}
            <CustomModal visible={collabModalVisible} avoidKeyboard={true}>
                <CustomText style={{ color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 4 }}>Invite Collaborator</CustomText>
                <CustomText style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>Enter their registered email address</CustomText>

                <TextInput
                    style={{ backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#1E293B', fontSize: 14, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 10 }}
                    placeholder="colleague@email.com"
                    placeholderTextColor="#CBD5E1"
                    value={collabEmail}
                    onChangeText={handleSearchUsers}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                {foundUsers.length > 0 && (
                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                        {foundUsers.map((u) => (
                            <TouchableOpacity
                                key={u.id}
                                onPress={() => setCollabEmail(u.email)}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                            >
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#00686F', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                    <CustomText style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                                        {u.email.charAt(0).toUpperCase()}
                                    </CustomText>
                                </View>
                                <CustomText style={{ color: '#1E293B', fontSize: 13, fontWeight: '600' }}>{u.email}</CustomText>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        onPress={() => { setCollabModalVisible(false); setCollabEmail(''); setFoundUsers([]); }}
                        style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                    >
                        <CustomText style={{ color: '#475569', fontWeight: '700', fontSize: 14 }}>Cancel</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleAddCollaborator}
                        disabled={sendingInvite}
                        style={{ flex: 1, backgroundColor: '#00686F', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                    >
                        {sendingInvite
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Send Invite</CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Add Card / List Modal ─────────────────────────────────────── */}
            <CustomModal visible={modalVisible} avoidKeyboard={true}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#E8F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Ionicons name={modalConfig.type === 'ADD_COLUMN' ? 'list-outline' : 'add-circle-outline'} size={18} color="#00686F" />
                    </View>
                    <View>
                        <CustomText style={{ color: '#0F172A', fontSize: 16, fontWeight: '800' }}>
                            {modalConfig.type === 'ADD_COLUMN' ? 'New List' : 'New Task'}
                        </CustomText>
                        <CustomText style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500' }}>
                            {modalConfig.type === 'ADD_COLUMN' ? 'Create a planning section' : 'Add a task to this list'}
                        </CustomText>
                    </View>
                </View>
                <TextInput
                    style={{ backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#1E293B', fontSize: 14, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 16 }}
                    autoFocus
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder={modalConfig.type === 'ADD_COLUMN' ? 'e.g. Venue, Catering, Decor...' : 'Task name...'}
                    placeholderTextColor="#CBD5E1"
                    onSubmitEditing={handleModalSubmit}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        onPress={closeModal}
                        style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                    >
                        <CustomText style={{ color: '#475569', fontWeight: '700', fontSize: 14 }}>Cancel</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleModalSubmit}
                        disabled={submittingModal}
                        style={{ flex: 1, backgroundColor: '#00686F', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                    >
                        {submittingModal
                            ? <ActivityIndicator color="#FFF" size="small" />
                            : <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                                {modalConfig.type === 'ADD_COLUMN' ? 'Create List' : 'Add Task'}
                            </CustomText>
                        }
                    </TouchableOpacity>
                </View>
            </CustomModal>

            {/* ── Delete List Confirm ────────────────────────────────────────── */}
            <CustomModal visible={deleteConfirmVisible}>
                <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <Ionicons name="trash-outline" size={24} color="#EF4444" />
                    </View>
                    <CustomText style={{ color: '#0F172A', fontSize: 17, fontWeight: '800', marginBottom: 6 }}>Delete this list?</CustomText>
                    <CustomText style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 19 }}>
                        All tasks in this list will be permanently removed.
                    </CustomText>
                    <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                        <TouchableOpacity
                            onPress={() => setDeleteConfirmVisible(false)}
                            style={{ flex: 1, backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                        >
                            <CustomText style={{ color: '#475569', fontWeight: '700', fontSize: 14 }}>Cancel</CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={confirmDeleteList}
                            disabled={deletingList}
                            style={{ flex: 1, backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                        >
                            {deletingList
                                ? <ActivityIndicator color="#FFF" size="small" />
                                : <CustomText style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Delete</CustomText>
                            }
                        </TouchableOpacity>
                    </View>
                </View>
            </CustomModal>

            {/* ── Task Detail Modal ──────────────────────────────────────────── */}
            <Modal visible={detailModalVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#F4F6F9' }}>

                    {/* Header */}
                    <View style={{ backgroundColor: '#00686F', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => setDetailModalVisible(false)}
                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="close" size={19} color="#FFF" />
                            </TouchableOpacity>

                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                <CustomText style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                                    {activeTask?.text || activeTask?.title || 'Task Details'}
                                </CustomText>
                                {activeTask?.priority && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getPriorityColor(activeTask.priority), marginRight: 5 }} />
                                        <CustomText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>
                                            {getPriorityLabel(activeTask.priority)} Priority
                                        </CustomText>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                onPress={saveTaskDetails}
                                disabled={savingTask}
                                style={{ backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                            >
                                {savingTask
                                    ? <ActivityIndicator color="#FFF" size="small" />
                                    : <CustomText style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>Save</CustomText>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* ── Card: Title & Priority ── */}
                        <View style={{ backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 18, padding: 16, shadowColor: '#64748B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>TITLE</CustomText>
                            <TextInput
                                style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9', paddingBottom: 10, marginBottom: 16 }}
                                value={activeTask?.text}
                                editable={isOwner}
                                placeholder="Task title..."
                                placeholderTextColor="#CBD5E1"
                                onChangeText={(t) => setActiveTask({ ...activeTask, text: t })}
                            />

                            <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 }}>PRIORITY</CustomText>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {['A', 'B', 'C'].map((p) => {
                                    const active = activeTask?.priority === p;
                                    const pm2 = PRIORITY_META[p];
                                    return (
                                        <TouchableOpacity
                                            key={p}
                                            disabled={!isOwner}
                                            onPress={() => setActiveTask({ ...activeTask, priority: p })}
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                paddingVertical: 10,
                                                borderRadius: 12,
                                                backgroundColor: active ? pm2.color : pm2.bg,
                                                borderWidth: 1.5,
                                                borderColor: active ? pm2.color : 'transparent',
                                            }}
                                        >
                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? '#FFF' : pm2.color, marginRight: 5 }} />
                                            <CustomText style={{ color: active ? '#FFF' : pm2.color, fontSize: 12, fontWeight: '800' }}>
                                                {pm2.label}
                                            </CustomText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* ── Card: Description ── */}
                        <View style={{ backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 18, padding: 16, shadowColor: '#64748B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>DESCRIPTION</CustomText>
                            <TextInput
                                style={{ fontSize: 14, color: '#1E293B', lineHeight: 21, minHeight: 90, textAlignVertical: 'top' }}
                                multiline
                                value={activeTask?.description}
                                editable={isOwner}
                                placeholder={isOwner ? 'Add notes, links or context...' : 'No description.'}
                                placeholderTextColor="#CBD5E1"
                                onChangeText={(t) => setActiveTask({ ...activeTask, description: t })}
                            />
                        </View>

                        {/* ── Card: Checklist ── */}
                        <View style={{ backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden', shadowColor: '#64748B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            {/* Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="checkbox-outline" size={15} color="#00686F" />
                                    <CustomText style={{ color: '#0F172A', fontSize: 13, fontWeight: '800', marginLeft: 7 }}>Checklist</CustomText>
                                </View>
                                {activeTask?.subtasks?.length > 0 && (
                                    <View style={{ backgroundColor: '#E8F5F5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                                        <CustomText style={{ color: '#00686F', fontSize: 11, fontWeight: '800' }}>
                                            {activeTask.subtasks.filter(s => s.completed).length}/{activeTask.subtasks.length}
                                        </CustomText>
                                    </View>
                                )}
                            </View>

                            {/* Sub-progress bar */}
                            {activeTask?.subtasks?.length > 0 && (
                                <View style={{ height: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' }}>
                                    <View style={{
                                        height: '100%',
                                        width: `${(activeTask.subtasks.filter(s => s.completed).length / activeTask.subtasks.length) * 100}%`,
                                        backgroundColor: '#00686F'
                                    }} />
                                </View>
                            )}

                            {/* Subtask rows */}
                            {activeTask?.subtasks?.map((sub, i) => (
                                <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const updated = activeTask.subtasks.map(s =>
                                                s.id === sub.id ? { ...s, completed: !s.completed } : s
                                            );
                                            setActiveTask({ ...activeTask, subtasks: updated });
                                        }}
                                        style={{ marginRight: 12 }}
                                    >
                                        <View style={{
                                            width: 20, height: 20, borderRadius: 10,
                                            borderWidth: sub.completed ? 0 : 2,
                                            borderColor: '#00686F',
                                            backgroundColor: sub.completed ? '#10B981' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {sub.completed && <Ionicons name="checkmark" size={11} color="#FFF" />}
                                        </View>
                                    </TouchableOpacity>
                                    <CustomText style={{ flex: 1, fontSize: 14, fontWeight: '500', color: sub.completed ? '#94A3B8' : '#334155', textDecorationLine: sub.completed ? 'line-through' : 'none' }}>
                                        {sub.text}
                                    </CustomText>
                                    {isOwner && (
                                        <TouchableOpacity onPress={() => deleteSubtask(sub.id)} style={{ padding: 4, marginLeft: 8 }}>
                                            <Ionicons name="close" size={15} color="#CBD5E1" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Add subtask input */}
                            {isOwner && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', marginRight: 12 }} />
                                    <TextInput
                                        style={{ flex: 1, fontSize: 14, color: '#1E293B', paddingVertical: 4 }}
                                        placeholder="Add item..."
                                        placeholderTextColor="#CBD5E1"
                                        value={subtaskText}
                                        onChangeText={setSubtaskText}
                                        onSubmitEditing={addSubtask}
                                        returnKeyType="done"
                                    />
                                    {subtaskText.length > 0 && (
                                        <TouchableOpacity onPress={addSubtask} style={{ marginLeft: 8 }}>
                                            <View style={{ backgroundColor: '#00686F', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                                                <CustomText style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>Add</CustomText>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* ── Card: Attachments ── */}
                        <View style={{ backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 18, overflow: 'hidden', shadowColor: '#64748B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                                <Ionicons name="attach" size={15} color="#00686F" />
                                <CustomText style={{ color: '#0F172A', fontSize: 13, fontWeight: '800', marginLeft: 7 }}>Attachments</CustomText>
                                {activeTask?.attachments?.length > 0 && (
                                    <View style={{ marginLeft: 8, backgroundColor: '#E8F5F5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                        <CustomText style={{ color: '#00686F', fontSize: 11, fontWeight: '800' }}>{activeTask.attachments.length}</CustomText>
                                    </View>
                                )}
                            </View>

                            {activeTask?.attachments?.map((file) => (
                                <TouchableOpacity
                                    key={file.id}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}
                                    onPress={() => Linking.openURL(file.url)}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0F9FA', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="document-outline" size={17} color="#00686F" />
                                    </View>
                                    <CustomText style={{ flex: 1, color: '#00686F', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }} numberOfLines={1}>
                                        {file.name || 'View Document'}
                                    </CustomText>
                                    {isOwner && (
                                        <TouchableOpacity
                                            onPress={() => setActiveTask({ ...activeTask, attachments: activeTask.attachments.filter(a => a.id !== file.id) })}
                                            style={{ padding: 6, marginLeft: 4 }}
                                        >
                                            <Ionicons name="close-circle" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                onPress={handleFileUpload}
                                disabled={uploading}
                                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, margin: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B2DEDE', backgroundColor: '#F0F9FA' }}
                            >
                                {uploading
                                    ? <ActivityIndicator color="#00686F" />
                                    : <>
                                        <Ionicons name="cloud-upload-outline" size={18} color="#00686F" />
                                        <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700', marginLeft: 8 }}>Upload from device</CustomText>
                                    </>
                                }
                            </TouchableOpacity>
                        </View>

                    </ScrollView>
                </SafeAreaView>
            </Modal>

        </View>
    );
}