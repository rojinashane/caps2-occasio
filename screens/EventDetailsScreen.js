import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, StyleSheet, TouchableOpacity, Dimensions,
    ActivityIndicator, StatusBar, TextInput, Modal, KeyboardAvoidingView,
    Platform, Animated, Alert, FlatList, Share, Linking
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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable, ScrollView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');
const COLUMN_WIDTH = width * 0.82;

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

export default function EventDetailsScreen({ route, navigation }) {
    const { eventId } = route.params;
    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [columns, setColumns] = useState([]);
    const [foundUsers, setFoundUsers] = useState([]);

    // UI State Modals
    const [modalVisible, setModalVisible] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [collabModalVisible, setCollabModalVisible] = useState(false);
    const [workspaceDeleteVisible, setWorkspaceDeleteVisible] = useState(false);

    const [modalConfig, setModalConfig] = useState({ type: '', columnId: '', taskId: '', title: '' });
    const [listToDelete, setListToDelete] = useState(null);
    const [inputText, setInputText] = useState('');
    const [subtaskText, setSubtaskText] = useState('');
    const [collabEmail, setCollabEmail] = useState('');

    // Active Card State
    const [activeTask, setActiveTask] = useState(null);
    const [activeColumnId, setActiveColumnId] = useState(null);

    const isOwner = useMemo(() => {
        return eventData?.userId === auth.currentUser?.uid;
    }, [eventData]);

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
                    console.error("Fetch Error:", error);
                } finally {
                    if (isActive) setLoading(false);
                }
            };
            fetchEvent();
            return () => { isActive = false; };
        }, [eventId])
    );

    const sendUniversalNotification = async (type, detail) => {
    const user = auth.currentUser;
    if (!user || !eventData) return;

    // 1. Collect all participant emails (Owner + Collaborators)
    // We use a Set to prevent duplicate notifications if someone is listed twice
    const allParticipantEmails = new Set([
        eventData.userId ? await getOwnerEmail(eventData.userId) : null, // Helper to get owner email if not in eventData
        ...(eventData.collaborators || []).map(email => email.toLowerCase())
    ]);

    // 2. Loop through every participant to create a notification doc
    for (const email of allParticipantEmails) {
        if (!email) continue;
        
        try {
            const userQ = query(collection(db, 'users'), where('email', '==', email), limit(1));
            const userSnap = await getDocs(userQ);
            
            if (!userSnap.empty) {
                const recipientId = userSnap.docs[0].id;
                const isSelf = email === user.email.toLowerCase();

                await addDoc(collection(db, 'notifications'), {
                    recipientId: recipientId,
                    senderName: isSelf ? "You" : (userData?.firstName || user.email),
                    type: type, 
                    body: isSelf ? `You ${detail}` : `${userData?.firstName || 'A collaborator'} ${detail}`,
                    status: 'pending',
                    eventId: eventId,
                    eventTitle: eventData?.title || "Workspace Update",
                    createdAt: serverTimestamp()
                });
            }
        } catch (err) {
            console.error("Failed to notify participant:", email, err);
        }
    }
};
    const syncToFirebase = async (updatedColumns) => {
        try {
            const docRef = doc(db, 'events', eventId);
            await updateDoc(docRef, { columns: updatedColumns });
            } catch (error) { console.error("Sync Error:", error); }
        };

    const handleShareInvitation = async () => {
        const invitationLink = `https://occasio-866c3.web.app/index.html?id=${eventId}`;
        const message = `YOU'RE INVITED!\n\nEvent: ${eventData?.title}\nDate: ${formatDate(eventData?.startDate)}\nLocation: ${eventData?.location || 'TBD'}\n\nPlease confirm your RSVP here:\n${invitationLink}`;
        try {
            await Share.share({ title: 'Event Invitation', message: message, url: invitationLink });
        } catch (error) {
            Alert.alert("Error", "Could not share invitation.");
        }
    };

    const openRSVPTracker = () => {
        navigation.navigate('RSVPTrackerScreen', { eventId, eventTitle: eventData?.title });
    };

    const confirmDeleteWorkspace = async () => {
        try {
            setActionLoading(true);
            await deleteDoc(doc(db, 'events', eventId));
            setWorkspaceDeleteVisible(false);
            navigation.navigate('Dashboard');
        } catch (error) {
            Alert.alert("Error", "Could not delete workspace.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddCollaborator = async () => {
        if (!collabEmail.trim()) {
            Alert.alert("Required", "Please enter a valid email address.");
            return;
        }
        
        if (collabEmail.trim().toLowerCase() === auth.currentUser?.email?.toLowerCase()) {
            Alert.alert("Wait", "You are already the owner of this workspace!");
            setCollabEmail('');
            setFoundUsers([]);
            return;
        }
        
        setActionLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where("email", "==", collabEmail.trim().toLowerCase()));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                Alert.alert("User Not Found", "This email is not registered with Occasio.");
                setActionLoading(false);
                return;
            }
            
            const recipientId = querySnapshot.docs[0].id;
            
            await addDoc(collection(db, 'notifications'), {
                type: 'COLLAB_REQUEST',
                senderName: auth.currentUser?.displayName || "A user",
                senderEmail: auth.currentUser?.email,
                eventId: eventId,
                eventTitle: eventData?.title,
                recipientId: recipientId,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            
            setCollabModalVisible(false);
            setCollabEmail('');
            setFoundUsers([]);
            Alert.alert("Invitation Sent", "The collaboration request has been sent successfully.");
        } catch (error) {
            Alert.alert("Error", "Failed to send invitation.");
        } finally {
            setActionLoading(false);
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
        const updated = columns.filter(col => col.id !== listToDelete);
        setColumns(updated);
        await syncToFirebase(updated);
        setDeleteConfirmVisible(false);
    };
    

    const toggleCardCompletion = async (columnId, taskId) => {
    let taskTitle = "a card";
    let isNowCompleted = false;

    const updatedColumns = columns.map(col => {
        if (col.id === columnId) {
            return { 
                ...col, 
                tasks: col.tasks.map(t => {
                    if (t.id === taskId) {
                        taskTitle = t.title; // Capture title for notification
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

    // Trigger notification for everyone
    const actionVerb = isNowCompleted ? "completed" : "uncompleted";
    await sendUniversalNotification(
        'item_checked', 
        `marked "${taskTitle}" as ${actionVerb}`
    );
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
        const updatedColumns = columns.map(col => {
            if (col.id === activeColumnId) {
                return { ...col, tasks: col.tasks.map(t => t.id === activeTask.id ? activeTask : t) };
            }
            return col;
        });
        setColumns(updatedColumns);
        await syncToFirebase(updatedColumns);
        setDetailModalVisible(false);
    };

    const deleteSubtask = (subtaskId) => {
        const filtered = activeTask.subtasks.filter(s => s.id !== subtaskId);
        setActiveTask({ ...activeTask, subtasks: filtered });
    };

    const addSubtask = () => {
        if (!subtaskText.trim()) return;
        const newSubtask = { id: Date.now().toString(), text: subtaskText, completed: false };
        setActiveTask({ ...activeTask, subtasks: [...(activeTask.subtasks || []), newSubtask] });
        setSubtaskText('');
    };

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            setUploading(true);
            const file = result.assets[0];
            const response = await fetch(file.uri);
            const blob = await response.blob();
            
            const fileRef = ref(storage, `event_files/${eventId}/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, blob);
            const downloadUrl = await getDownloadURL(fileRef);

            const newAttachment = { 
                id: Date.now().toString(), 
                url: downloadUrl, 
                name: file.name,
                size: file.size 
            };
            
            setActiveTask({ 
                ...activeTask, 
                attachments: [...(activeTask.attachments || []), newAttachment] 
            });
            Alert.alert("Success", "File uploaded successfully");
        } catch (error) {
            console.error("Upload Error:", error);
            Alert.alert("Error", "Failed to upload file.");
        } finally {
            setUploading(false);
        }
    };

   const handleModalSubmit = async () => {
    if (!inputText.trim()) return;

    let newColumns = [...columns];
    let notificationType = '';
    let notificationDetail = '';

    if (modalConfig.type === 'ADD_COLUMN') {
        newColumns.push({ 
            id: Date.now().toString(), 
            title: inputText, 
            tasks: [] 
        });
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
                        title: inputText, // Ensure this matches your task object key (text or title)
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

    // 1. Update UI State
    setColumns(newColumns);
    
    // 2. Sync to Firestore Workspace
    await syncToFirebase(newColumns);

    // 3. Send Notifications to everyone (Self + Collaborators)
    if (notificationType) {
        await sendUniversalNotification(notificationType, notificationDetail);
    }

    // 4. Reset Modal
    setModalVisible(false);
    setInputText('');
};


    const getPriorityColor = (p) => p === 'A' ? '#EF4444' : p === 'B' ? '#F59E0B' : '#10B981';

    const handleSearchUsers = async (text) => {
        setCollabEmail(text);
        if (text.length < 3) {
            setFoundUsers([]);
            return;
        }
        const cleanText = text.toLowerCase();
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '>=', cleanText), where('email', '<=', cleanText + '\uf8ff'), limit(5));
            const querySnapshot = await getDocs(q);
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFoundUsers(users.filter(u => u.email !== auth.currentUser?.email));
        } catch (error) { console.log(error); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#00686F" /></View>;

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#004D52', '#00686F']} style={styles.gradientBg} />

            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                <View style={styles.headerContainer}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconCircle}>
                            <Ionicons name="chevron-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTextContainer}>
                            <CustomText style={styles.headerTitle} numberOfLines={1}>{eventData?.title}</CustomText>
                            <CustomText style={styles.headerSubtitle}>EVENT WORKSPACE</CustomText>
                        </View>
                        {isOwner && (
                            <TouchableOpacity style={styles.iconCircle} onPress={() => setMenuVisible(true)}>
                                <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={COLUMN_WIDTH + 16} decelerationRate="fast" contentContainerStyle={styles.boardContent}>
                    <View style={[styles.column, styles.infoColumn]}>
                        <View style={styles.columnHeader}>
                            <View style={styles.row}>
                                <View style={styles.infoIconBg}><Ionicons name="stats-chart" size={18} color="#00686F" /></View>
                                <CustomText style={styles.columnTitle}>Overview</CustomText>
                            </View>
                            {isOwner && (
                                <TouchableOpacity onPress={() => navigation.navigate('UpdateEvent', { eventId, eventData })} style={styles.editPill}>
                                    <Ionicons name="pencil" size={12} color="#00686F" /><CustomText style={styles.editBtnText}>Edit</CustomText>
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={[styles.detailCard, { borderLeftWidth: 5, borderLeftColor: '#00686F', backgroundColor: '#F0F9FA' }]}>
                                <CustomText style={[styles.infoLabel, { color: '#00686F' }]}>RSVP TRACKER</CustomText>
                                <View style={styles.rsvpActionRow}>
                                    {isOwner && (
                                        <TouchableOpacity style={styles.rsvpBtn} onPress={handleShareInvitation}>
                                            <Ionicons name="share-social" size={16} color="#FFF" />
                                            <CustomText style={styles.rsvpBtnText}>Share Invite</CustomText>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity 
                                        style={[styles.rsvpBtn, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#00686F', flex: isOwner ? 0.48 : 1 }]} 
                                        onPress={openRSVPTracker}
                                    >
                                        <Ionicons name="people" size={16} color="#00686F" />
                                        <CustomText style={[styles.rsvpBtnText, { color: '#00686F' }]}>Tracker</CustomText>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.detailCard}><CustomText style={styles.infoLabel}>TYPE</CustomText><CustomText style={styles.infoValue}>{eventData?.eventType || "Not set"}</CustomText></View>
                            <View style={styles.detailCard}><CustomText style={styles.infoLabel}>LOCATION</CustomText><CustomText style={styles.infoValue}>{eventData?.location || "TBD"}</CustomText></View>
                            <View style={styles.detailCard}><CustomText style={styles.infoLabel}>START DATE</CustomText><CustomText style={styles.infoValue}>{formatDate(eventData?.startDate)}</CustomText></View>
                            <View style={styles.detailCard}><CustomText style={styles.infoLabel}>START TIME</CustomText><CustomText style={styles.infoValue}>{formatTime(eventData?.startTime)}</CustomText></View>
                            <View style={styles.detailCard}><CustomText style={styles.infoLabel}>DESCRIPTION</CustomText><CustomText style={styles.infoValue}>{eventData?.description || "No description provided"}</CustomText></View>

                            <View style={styles.detailCard}>
                                <CustomText style={styles.infoLabel}>TEAM</CustomText>
                                <View style={styles.collabContainer}>
                                    <View style={[styles.collabChip, { borderColor: '#00686F', backgroundColor: '#F0F9FA' }]}>
                                        <View style={[styles.collabAvatar, { backgroundColor: '#00686F' }]}><Ionicons name="star" size={10} color="#FFF" /></View>
                                        <CustomText style={[styles.collabEmail, { color: '#00686F', fontWeight: 'bold' }]}>Owner</CustomText>
                                    </View>
                                    {eventData?.collaborators?.map((email, index) => (
                                        <View key={index} style={styles.collabChip}>
                                            <View style={styles.collabAvatar}><CustomText style={styles.collabAvatarText}>{email.charAt(0).toUpperCase()}</CustomText></View>
                                            <CustomText style={styles.collabEmail} numberOfLines={1}>{email}</CustomText>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                    </View>

                    {columns.map((col) => (
                        <View key={col.id} style={styles.trelloColumn}>
                            <View style={styles.trelloHeaderRow}>
                                <TextInput 
                                    style={styles.trelloTitleInput} 
                                    value={col.title} 
                                    editable={isOwner}
                                    onChangeText={(text) => updateColumnTitle(col.id, text)} 
                                />
                                {isOwner && (
                                    <TouchableOpacity onPress={() => triggerDeleteList(col.id)}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {col.tasks.map((task) => (
                                    <Swipeable 
                                        key={task.id} 
                                        enabled={isOwner}
                                        renderRightActions={() => (
                                            <TouchableOpacity style={styles.deleteSwipeAction} onPress={() => {
                                                const updated = columns.map(c => c.id === col.id ? { ...c, tasks: c.tasks.filter(t => t.id !== task.id) } : c);
                                                setColumns(updated); syncToFirebase(updated);
                                            }}><Ionicons name="trash-outline" size={24} color="#FFF" /></TouchableOpacity>
                                        )}
                                    >
                                        <TouchableOpacity style={[styles.trelloTaskCard, { borderLeftWidth: 6, borderLeftColor: getPriorityColor(task.priority) }]} onPress={() => openTaskDetails(col.id, task)}>
                                            <View style={styles.cardHeaderRow}>
                                                <TouchableOpacity onPress={() => toggleCardCompletion(col.id, task.id)} style={styles.outerCheckbox}>
                                                    <Ionicons name={task.completed ? "checkbox" : "square-outline"} size={20} color={task.completed ? "#10B981" : "#CBD5E1"} />
                                                </TouchableOpacity>
                                                <CustomText style={[styles.trelloTaskText, task.completed && styles.checkTextDone]}>{task.text}</CustomText>
                                            </View>
                                            {(task.subtasks?.length > 0 || task.attachments?.length > 0) && (
                                                <View style={styles.cardBadges}>
                                                    {task.subtasks?.length > 0 && (
                                                        <View style={styles.badge}>
                                                            <Ionicons name="checkmark-done" size={12} color="#64748B" />
                                                            <CustomText style={styles.badgeText}>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</CustomText>
                                                        </View>
                                                    )}
                                                    {task.attachments?.length > 0 && (
                                                        <View style={styles.badge}>
                                                            <Ionicons name="attach" size={12} color="#64748B" />
                                                            <CustomText style={styles.badgeText}>{task.attachments.length}</CustomText>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </Swipeable>
                                ))}
                                {isOwner && (
                                    <TouchableOpacity style={styles.trelloAddTaskBtn} onPress={() => { setModalConfig({ type: 'ADD_TASK', columnId: col.id, title: 'Add a card' }); setInputText(''); setModalVisible(true); }}>
                                        <Ionicons name="add" size={20} color="#64748B" /><CustomText style={styles.trelloAddTaskText}>Add a card</CustomText>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>
                    ))}
                    
                    {isOwner && (
                        <TouchableOpacity style={styles.addListBtn} onPress={() => { setModalConfig({ type: 'ADD_COLUMN', title: 'Add a list' }); setInputText(''); setModalVisible(true); }}>
                            <Ionicons name="add-circle" size={24} color="#FFF" /><CustomText style={styles.addListBtnText}>Add list</CustomText>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* MODALS */}
            <Modal transparent visible={menuVisible} animationType="slide">
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContent}>
                        <View style={styles.menuHandle} />
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setCollabModalVisible(true); }}>
                            <Ionicons name="person-add-outline" size={22} color="#1E293B" /><CustomText style={styles.menuItemText}>Add a Collaborator</CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => { setMenuVisible(false); setWorkspaceDeleteVisible(true); }}>
                            <Ionicons name="trash-outline" size={22} color="#EF4444" /><CustomText style={[styles.menuItemText, { color: '#EF4444' }]}>Delete Event Workspace</CustomText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal transparent visible={workspaceDeleteVisible} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.deleteWorkspaceCard}>
                        <View style={styles.dangerIconContainer}>
                            <Ionicons name="warning" size={32} color="#EF4444" />
                        </View>
                        <CustomText style={styles.deleteWorkspaceTitle}>Delete Workspace?</CustomText>
                        <CustomText style={styles.deleteWorkspaceMessage}>
                            This will permanently delete this event and all associated tasks for everyone. This action cannot be undone.
                        </CustomText>
                        <View style={styles.deleteWorkspaceActions}>
                            <TouchableOpacity 
                                style={styles.cancelWorkspaceBtn} 
                                onPress={() => setWorkspaceDeleteVisible(false)}
                            >
                                <CustomText style={styles.cancelBtnText}>Keep Workspace</CustomText>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.confirmWorkspaceBtn} 
                                onPress={confirmDeleteWorkspace}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <CustomText style={styles.confirmBtnText}>Delete Forever</CustomText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal transparent visible={collabModalVisible} animationType="fade">
                <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <CustomText style={styles.modalTitle}>Invite Collaborator</CustomText>
                        <TextInput style={styles.modalInput} placeholder="Email..." value={collabEmail} onChangeText={handleSearchUsers} autoCapitalize="none" />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => { setCollabModalVisible(false); setCollabEmail(''); setFoundUsers([]); }} style={styles.modalCancel}><CustomText style={{ color: '#64748B' }}>Cancel</CustomText></TouchableOpacity>
                            <TouchableOpacity onPress={handleAddCollaborator} style={styles.modalSave} disabled={actionLoading}>
                                {actionLoading ? <ActivityIndicator color="#FFF" /> : <CustomText style={{ color: '#FFF', fontWeight: 'bold' }}>Send Request</CustomText>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal transparent visible={modalVisible} animationType="fade">
                <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <CustomText style={styles.modalTitle}>{modalConfig.title}</CustomText>
                        <TextInput style={styles.modalInput} autoFocus value={inputText} onChangeText={setInputText} />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCancel}><CustomText style={{ color: '#64748B' }}>Cancel</CustomText></TouchableOpacity>
                            <TouchableOpacity onPress={handleModalSubmit} style={styles.modalSave}><CustomText style={{ color: '#FFF', fontWeight: 'bold' }}>Confirm</CustomText></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal transparent visible={deleteConfirmVisible} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.deleteModalBox}>
                        <CustomText style={styles.deleteModalTitle}>Delete List?</CustomText>
                        <View style={styles.deleteModalActions}>
                            <TouchableOpacity onPress={() => setDeleteConfirmVisible(false)}><CustomText>No</CustomText></TouchableOpacity>
                            <TouchableOpacity onPress={confirmDeleteList} style={styles.deleteConfirmBtn}><CustomText style={{ color: '#FFF' }}>Delete</CustomText></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={detailModalVisible} animationType="slide">
                <SafeAreaView style={styles.detailModalContainer}>
                    <View style={styles.detailHeader}>
                        <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.detailCloseBtn}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                        <CustomText style={styles.detailHeaderTitle}>Task Details</CustomText>
                        {/* Allowed collaborators to update so checklists and uploads sync */}
                        <TouchableOpacity onPress={saveTaskDetails} style={styles.detailSaveBtn}>
                            <CustomText style={{ color: '#FFF', fontWeight: 'bold' }}>Update</CustomText>
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                        <View style={styles.detailBody}>
                            <View style={styles.sectionHeader}>
                                <Ionicons name="text" size={18} color="#00686F" />
                                <CustomText style={styles.detailLabel}>TITLE</CustomText>
                            </View>
                            <TextInput 
                                style={styles.detailTitleInput} 
                                value={activeTask?.text} 
                                editable={isOwner}
                                placeholder="Task title..."
                                onChangeText={(t) => setActiveTask({ ...activeTask, text: t })} 
                            />

                            <View style={styles.sectionHeader}>
                                <Ionicons name="flag" size={18} color="#00686F" />
                                <CustomText style={styles.detailLabel}>PRIORITY</CustomText>
                            </View>
                            <View style={styles.priorityRow}>
                                {['A', 'B', 'C'].map((p) => (
                                    <TouchableOpacity 
                                        key={p} 
                                        disabled={!isOwner}
                                        onPress={() => setActiveTask({ ...activeTask, priority: p })} 
                                        style={[
                                            styles.priorityBtn, 
                                            activeTask?.priority === p && { backgroundColor: getPriorityColor(p), borderColor: getPriorityColor(p) }
                                        ]}
                                    >
                                        <CustomText style={[styles.priorityBtnText, activeTask?.priority === p && { color: '#FFF' }]}>
                                            {p === 'A' ? 'High' : p === 'B' ? 'Medium' : 'Low'}
                                        </CustomText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.sectionHeader}>
                                <Ionicons name="document-text" size={18} color="#00686F" />
                                <CustomText style={styles.detailLabel}>DESCRIPTION</CustomText>
                            </View>
                            <TextInput 
                                style={styles.detailDescInput} 
                                multiline 
                                value={activeTask?.description} 
                                editable={isOwner}
                                placeholder={isOwner ? "Tap to add a more detailed description..." : "No description."}
                                onChangeText={(t) => setActiveTask({ ...activeTask, description: t })} 
                            />

                            <View style={styles.sectionHeader}>
                                <Ionicons name="list" size={18} color="#00686F" />
                                <CustomText style={styles.detailLabel}>CHECKLIST</CustomText>
                            </View>
                            
                            {activeTask?.subtasks?.map((sub) => (
                                <View key={sub.id} style={styles.subtaskRow}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            const updated = activeTask.subtasks.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s);
                                            setActiveTask({ ...activeTask, subtasks: updated });
                                        }}
                                        style={styles.subtaskCheck}
                                    >
                                        <Ionicons name={sub.completed ? "checkbox" : "square-outline"} size={22} color={sub.completed ? "#10B981" : "#00686F"} />
                                    </TouchableOpacity>
                                    <CustomText style={[styles.subtaskText, sub.completed && styles.checkTextDone]}>{sub.text}</CustomText>
                                    {isOwner && (
                                        <TouchableOpacity onPress={() => deleteSubtask(sub.id)} style={styles.subtaskDelete}>
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {isOwner && (
                                <View style={styles.addSubtaskContainer}>
                                    <TextInput 
                                        style={styles.subtaskInput} 
                                        placeholder="Add a checklist item..." 
                                        value={subtaskText} 
                                        onChangeText={setSubtaskText} 
                                    />
                                    <TouchableOpacity onPress={addSubtask} style={styles.subtaskAddBtn}>
                                        <Ionicons name="add" size={24} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.sectionHeader}>
                                <Ionicons name="attach" size={18} color="#00686F" />
                                <CustomText style={styles.detailLabel}>ATTACHMENTS</CustomText>
                            </View>

                            {activeTask?.attachments?.map((file) => (
                                <View key={file.id} style={styles.attachmentRow}>
                                    <TouchableOpacity style={styles.attachmentInfo} onPress={() => Linking.openURL(file.url)}>
                                        <Ionicons name="document-outline" size={20} color="#00686F" />
                                        <CustomText style={styles.attachmentText} numberOfLines={1}>{file.name || 'View Document'}</CustomText>
                                    </TouchableOpacity>
                                    {isOwner && (
                                        <TouchableOpacity onPress={() => {
                                            const filtered = activeTask.attachments.filter(a => a.id !== file.id);
                                            setActiveTask({ ...activeTask, attachments: filtered });
                                        }}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Allowed collaborators to upload files */}
                            <TouchableOpacity 
                                onPress={handleFileUpload} 
                                style={styles.uploadBtn}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <ActivityIndicator color="#00686F" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={20} color="#00686F" />
                                        <CustomText style={styles.uploadBtnText}>Upload from device</CustomText>
                                    </>
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.4 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerContainer: { width: '100%', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    headerTextContainer: { marginLeft: 12, flex: 1 },
    headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
    boardContent: { paddingHorizontal: 12, paddingVertical: 10 },
    column: { width: COLUMN_WIDTH, backgroundColor: '#FFF', borderRadius: 24, marginHorizontal: 8, padding: 20, height: height * 0.72, elevation: 5 },
    infoColumn: { backgroundColor: '#FFF' },
    columnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    infoIconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F0F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    columnTitle: { fontWeight: '800', fontSize: 18, color: '#1E293B' },
    editPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    editBtnText: { color: '#00686F', fontWeight: '800', fontSize: 12, marginLeft: 4 },
    detailCard: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    infoLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', marginBottom: 6 },
    infoValue: { fontSize: 14, color: '#475569', fontWeight: '500' },
    trelloColumn: { width: COLUMN_WIDTH, backgroundColor: '#EDF2F7', borderRadius: 24, marginHorizontal: 8, maxHeight: height * 0.72, padding: 16 },
    trelloHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    trelloTitleInput: { flex: 1, fontWeight: '800', fontSize: 16, color: '#2D3748', textTransform: 'uppercase' },
    trelloTaskCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 10, elevation: 2 },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    cardBadges: { flexDirection: 'row', marginTop: 8, gap: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 10, color: '#64748B', marginLeft: 3, fontWeight: '600' },
    outerCheckbox: { marginRight: 10 },
    trelloTaskText: { fontSize: 15, color: '#334155', fontWeight: '600', flex: 1 },
    checkTextDone: { textDecorationLine: 'line-through', color: '#94A3B8' },
    trelloAddTaskBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 12, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
    trelloAddTaskText: { fontSize: 14, color: '#64748B', marginLeft: 8, fontWeight: '700' },
    addListBtn: { width: COLUMN_WIDTH * 0.7, height: 56, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16 },
    addListBtnText: { color: '#FFF', fontWeight: '800', marginLeft: 8 },
    deleteSwipeAction: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', width: 80, height: '85%', borderRadius: 14, marginLeft: 10 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#FFF', width: '88%', padding: 24, borderRadius: 28 },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 5 },
    modalInput: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
    modalCancel: { padding: 10, marginRight: 10 },
    modalSave: { backgroundColor: '#00686F', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 100, alignItems: 'center' },
    menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    menuContent: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, paddingHorizontal: 20 },
    menuHandle: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginVertical: 15 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    menuItemText: { fontSize: 16, fontWeight: '600', color: '#1E293B', marginLeft: 15 },
    
    detailModalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    detailCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    detailSaveBtn: { backgroundColor: '#00686F', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
    detailHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    detailBody: { padding: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 12 },
    detailLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', marginLeft: 8, letterSpacing: 1 },
    detailTitleInput: { fontSize: 20, fontWeight: '700', color: '#1E293B', backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
    priorityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    priorityBtn: { flex: 1, marginHorizontal: 4, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
    priorityBtnText: { fontWeight: '700', fontSize: 13, color: '#64748B' },
    detailDescInput: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, height: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, fontSize: 15, color: '#334155' },
    subtaskRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    subtaskCheck: { marginRight: 10 },
    subtaskText: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '500' },
    subtaskDelete: { padding: 4 },
    addSubtaskContainer: { flexDirection: 'row', marginTop: 10, marginBottom: 24 },
    subtaskInput: { flex: 1, backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 14 },
    subtaskAddBtn: { backgroundColor: '#00686F', width: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginLeft: 8 },
    attachmentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    attachmentInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    attachmentText: { marginLeft: 10, fontSize: 14, color: '#00686F', fontWeight: '600', textDecorationLine: 'underline' },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FA', padding: 14, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: '#00686F', marginTop: 8 },
    uploadBtnText: { marginLeft: 10, fontSize: 14, color: '#00686F', fontWeight: '700' },
    deleteModalBox: { backgroundColor: '#FFF', width: '80%', padding: 25, borderRadius: 25, alignItems: 'center' },
    deleteModalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
    deleteModalActions: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
    deleteConfirmBtn: { backgroundColor: '#EF4444', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
    collabContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    collabChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 20, paddingRight: 10, paddingLeft: 4, paddingVertical: 4, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    collabAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#94A3B8', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
    collabAvatarText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    collabEmail: { fontSize: 11, color: '#334155', fontWeight: '600', maxWidth: 150 },
    rsvpActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    rsvpBtn: { flex: 0.48, backgroundColor: '#00686F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
    rsvpBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12, marginLeft: 6 },
    
    deleteWorkspaceCard: { backgroundColor: '#FFF', width: '85%', padding: 24, borderRadius: 32, alignItems: 'center', elevation: 10 },
    dangerIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    deleteWorkspaceTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
    deleteWorkspaceMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    deleteWorkspaceActions: { width: '100%', gap: 12 },
    confirmWorkspaceBtn: { backgroundColor: '#EF4444', width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    confirmBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
    cancelWorkspaceBtn: { backgroundColor: '#F1F5F9', width: '100%', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
    cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 15 }
});