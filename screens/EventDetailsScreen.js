import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, TouchableOpacity, Dimensions, Animated,
    ActivityIndicator, StatusBar, TextInput, Modal, KeyboardAvoidingView,
    Platform, Alert, Linking, Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
    doc, getDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs, addDoc, serverTimestamp, limit,
    onSnapshot, orderBy,
} from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import CustomText from '../components/CustomText';
import CustomModal from '../components/CustomModal';
import VendorPicker from '../components/Vendorpicker';
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
    const [assigneePickerVisible, setAssigneePickerVisible] = useState(false);
    const [deadlineDatePickerVisible, setDeadlineDatePickerVisible] = useState(false);
    const [deadlineTimePickerVisible, setDeadlineTimePickerVisible] = useState(false);
    // Picker scroll state
    const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
    const [pickerDay, setPickerDay]     = useState(new Date().getDate() - 1);
    const [pickerYear, setPickerYear]   = useState(0);
    const [pickerHour, setPickerHour]   = useState(new Date().getHours());
    const [pickerMinute, setPickerMinute] = useState(0);

    // ── Vendor Picker State ────────────────────────────────────────────────────
    const [pinnedVendors, setPinnedVendors] = useState([]);
    const [vendorPickerVisible, setVendorPickerVisible] = useState(false);
    const [pinnedVendorsModalVisible, setPinnedVendorsModalVisible] = useState(false);
    const [communityVendors, setCommunityVendors] = useState([]);

    // ── Occasio Suggests State ─────────────────────────────────────────────────
    const [suggestionsVisible, setSuggestionsVisible] = useState(false);
    const [suggestions, setSuggestions] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // ── Scroll navigation refs ─────────────────────────────────────────────────
    const mainScrollRef = useRef(null);
    const overviewRef   = useRef(null);
    const sectionOffsets = useRef({});

    const isOwner = useMemo(() => eventData?.userId === auth.currentUser?.uid, [eventData]);

    // True when the event's start date is strictly in the past (past midnight of that day)
    const isPastEvent = useMemo(() => {
        if (!eventData?.startDate) return false;
        const d = eventData.startDate?.seconds
            ? new Date(eventData.startDate.seconds * 1000)
            : new Date(eventData.startDate);
        if (isNaN(d.getTime())) return false;
        // Compare against start of today so an event happening today is NOT considered past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d < today;
    }, [eventData]);
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
                        if (data.pinnedVendors) setPinnedVendors(data.pinnedVendors);
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

            // ── Subscribe to community vendors (contributed by all planners) ──
            const communityUnsub = onSnapshot(
                query(collection(db, 'community_vendors'), orderBy('contributedAt', 'desc')),
                (snap) => {
                    if (isActive) {
                        setCommunityVendors(
                            snap.docs.map(d => ({ id: d.id, ...d.data(), isCustom: true }))
                        );
                    }
                },
                (err) => console.warn('community_vendors snapshot error:', err)
            );

            return () => { isActive = false; communityUnsub(); };
        }, [eventId])
    );

    // ── Notifications ──────────────────────────────────────────────────────────
    // Resolves a userId to their stored email address
    const getOwnerEmail = async (userId) => {
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', userId), limit(1)));
            if (!snap.empty) return snap.docs[0].data().email?.toLowerCase() || null;
        } catch (err) {
            console.error('getOwnerEmail error:', err);
        }
        return null;
    };

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

    // ── Task assignment notification ───────────────────────────────────────────
    const sendTaskAssignedNotification = async (assigneeEmail, taskTitle) => {
        const user = auth.currentUser;
        if (!user || !eventData || !assigneeEmail) return;
        try {
            const userQ = query(collection(db, 'users'), where('email', '==', assigneeEmail.toLowerCase()), limit(1));
            const userSnap = await getDocs(userQ);
            if (!userSnap.empty) {
                const recipientId = userSnap.docs[0].id;
                await addDoc(collection(db, 'notifications'), {
                    recipientId,
                    senderName: auth.currentUser?.displayName || user.email,
                    type: 'task_assigned',
                    body: `You've been assigned "${taskTitle}" in ${eventData?.title || 'a workspace'}.`,
                    status: 'pending',
                    eventId,
                    eventTitle: eventData?.title || 'Workspace',
                    createdAt: serverTimestamp(),
                });
            }
        } catch (err) {
            console.error('sendTaskAssignedNotification error:', err);
        }
    };

    // ── Deadline reminder notifications ───────────────────────────────────────
    // Sends a notification to all participants (and assignee) about deadline status
    const sendDeadlineNotification = async (taskTitle, assigneeEmail, deadlineMs, type) => {
        const user = auth.currentUser;
        if (!user || !eventData) return;

        const deadlineStr = new Date(deadlineMs).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        const recipients = new Set();
        // Always notify owner
        const ownerEmail = await getOwnerEmail(eventData.userId);
        if (ownerEmail) recipients.add(ownerEmail);
        // Notify assignee
        if (assigneeEmail) recipients.add(assigneeEmail.toLowerCase());

        for (const email of recipients) {
            try {
                const userQ = query(collection(db, 'users'), where('email', '==', email), limit(1));
                const snap = await getDocs(userQ);
                if (!snap.empty) {
                    let body;
                    if (type === 'task_deadline_ended') {
                        body = `Deadline passed for "${taskTitle}" in ${eventData?.title}. Was due ${deadlineStr}.`;
                    } else if (type === 'task_deadline_tomorrow') {
                        body = `\u23F0 Heads up! "${taskTitle}" in ${eventData?.title} is due tomorrow \u2014 ${deadlineStr}. Make sure it\u2019s ready in time!`;
                    } else {
                        body = `"${taskTitle}" in ${eventData?.title} is due on ${deadlineStr}.`;
                    }
                    await addDoc(collection(db, 'notifications'), {
                        recipientId: snap.docs[0].id,
                        senderName: 'Occasio',
                        type,
                        body,
                        status: 'pending',
                        eventId,
                        eventTitle: eventData?.title || 'Workspace',
                        createdAt: serverTimestamp(),
                    });
                }
            } catch (err) {
                console.error('sendDeadlineNotification error:', err);
            }
        }
    };

    // ── Schedule deadline reminders using setTimeout ───────────────────────────
    const scheduleDeadlineReminders = (taskTitle, assigneeEmail, deadlineMs) => {
        const now = Date.now();
        const msLeft = deadlineMs - now;

        // ── Reminder 1 day (24 h) before deadline ─────────────────────────────
        const oneDayMs = msLeft - 24 * 60 * 60 * 1000;
        if (oneDayMs > 0) {
            setTimeout(() => {
                sendDeadlineNotification(taskTitle, assigneeEmail, deadlineMs, 'task_deadline_tomorrow').catch(console.error);
            }, oneDayMs);
        } else if (msLeft > 0 && msLeft <= 24 * 60 * 60 * 1000) {
            // Deadline is already within the next 24 h — notify immediately
            sendDeadlineNotification(taskTitle, assigneeEmail, deadlineMs, 'task_deadline_tomorrow').catch(console.error);
        }

        // Reminder 30 min before deadline
        const thirtyMin = msLeft - 30 * 60 * 1000;
        if (thirtyMin > 0) {
            setTimeout(() => {
                sendDeadlineNotification(taskTitle, assigneeEmail, deadlineMs, 'task_deadline').catch(console.error);
            }, thirtyMin);
        }

        // Notification when deadline has passed
        if (msLeft > 0) {
            setTimeout(() => {
                sendDeadlineNotification(taskTitle, assigneeEmail, deadlineMs, 'task_deadline_ended').catch(console.error);
            }, msLeft);
        } else {
            // Already past — fire immediately
            sendDeadlineNotification(taskTitle, assigneeEmail, deadlineMs, 'task_deadline_ended').catch(console.error);
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

    // ── Vendor Helpers ─────────────────────────────────────────────────────────
    const syncPinnedVendors = async (updated) => {
        try {
            await updateDoc(doc(db, 'events', eventId), { pinnedVendors: updated });
        } catch (e) {
            console.error('Vendor sync error:', e);
        }
    };

    const pinVendor = async (vendor) => {
        if (pinnedVendors.find(v => v.id === vendor.id)) return;
        const updated = [...pinnedVendors, vendor];
        setPinnedVendors(updated);
        await syncPinnedVendors(updated);

        // ── If this is a custom vendor, save it to the global community pool ──
        // so all planners can discover and reuse vendors contributed by others.
        if (vendor.isCustom) {
            try {
                // Check if a vendor with the same name already exists to avoid duplicates
                const existing = await getDocs(
                    query(
                        collection(db, 'community_vendors'),
                        where('nameLower', '==', vendor.name.trim().toLowerCase()),
                        limit(1)
                    )
                );
                if (existing.empty) {
                    await addDoc(collection(db, 'community_vendors'), {
                        name:        vendor.name.trim(),
                        nameLower:   vendor.name.trim().toLowerCase(),
                        category:    vendor.category  || 'Custom',
                        phone:       vendor.phone     || '',
                        facebook:    vendor.facebook  || '',
                        location:    vendor.location  || '',
                        isCustom:    true,
                        contributedBy: auth.currentUser?.email || 'anonymous',
                        contributedAt: serverTimestamp(),
                    });
                }
            } catch (e) {
                // Non-fatal — pinning still succeeds even if community write fails
                console.warn('community_vendors write failed:', e);
            }
        }
    };

    const unpinVendor = async (vendorId) => {
        const updated = pinnedVendors.filter(v => v.id !== vendorId);
        setPinnedVendors(updated);
        await syncPinnedVendors(updated);
    };

   // ── Occasio Suggests ───────────────────────────────────────────────────────
// ── Occasio Suggests (Strict Sorsogon City Only) ───────────────────────────
    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        setSuggestions(null);
        
        try {
            // Flatten your kanban columns to get the task names
            const allTasks = columns.flatMap(c => (c.tasks || []).map(t => t.text || t.title)).filter(Boolean);
            
            // 🔥 The Strict Location + Factual Services Verification Prompt
            const prompt = `You are an expert local event planning assistant for "Occasio", an app exclusively for planning events in Sorsogon City proper, Philippines.

Based on this event, suggest specific vendors and venues located STRICTLY within the borders of Sorsogon City:

Event: "${eventData?.title || 'Event'}"
Type: ${eventData?.eventType || 'General event'}
Date: ${formatDate(eventData?.startDate)}
Location: Sorsogon City, Philippines (City proper ONLY)
Theme: ${eventData?.theme || 'Not specified'}
Description: ${eventData?.description || 'Not provided'}
Planning tasks: ${allTasks.length > 0 ? allTasks.slice(0, 10).join(', ') : 'None yet'}

Respond ONLY with a valid JSON object (no markdown, no backticks):
{
  "summary": "1-2 sentence overview of your Sorsogon City recommendations",
  "categories": [
    {
      "name": "Category name (e.g. Catering, Photography, Venues)",
      "icon": "restaurant-outline",
      "tips": "2-3 sentence advice for this category for this event type",
      "vendors": [
        { "name": "Vendor/Venue Name", "why": "Short factual reason (1 sentence)", "note": "Practical tip based on their real services" }
      ]
    }
  ]
}

Provide 4-5 categories, each with 2-3 vendor/venue suggestions. Use Ionicons icon names. 

CRITICAL RULES:
1. STRICT LOCATION: You MUST ONLY suggest real, existing businesses, venues, and vendors that are actually located strictly within Sorsogon City itself. DO NOT suggest vendors from other municipalities in Sorsogon Province (absolutely NO vendors from Gubat, Casiguran, Castilla, Bulan, Matnog, Donsol, Irosin, Juban, Magallanes, Pilar, etc.).
2. FACTUAL SERVICES: You MUST accurately describe the true services offered by the vendor. Categorize them strictly according to their primary real-world business (e.g., do not put a hotel in the Photography category). Do not invent, guess, or exaggerate their services. If you are unsure of a business's exact services or location, DO NOT include them.`;

            // 🛑 Insert your NEW, secure Groq API key here 
            const GROQ_API_KEY = '';

            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile', 
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: "json_object" } 
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error('Groq API error:', res.status, JSON.stringify(data));
                setSuggestions({ error: true, message: data.error?.message || `Status ${res.status}` });
                return;
            }

            // Extract the generated text and clean any potential markdown
            const text = data.choices[0].message.content;
            const clean = text.replace(/```json|```/g, '').trim();
            
            // Parse the JSON string into a JavaScript object and save it to state
            setSuggestions(JSON.parse(clean));
            
        } catch (e) {
            console.error('fetchSuggestions failed:', e);
            setSuggestions({ error: true, message: e.message });
        } finally {
            setLoadingSuggestions(false);
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
                expiresInMinutes: 10,
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
            attachments: task.attachments || [],
            assignee: task.assignee || null,
            deadline: task.deadline || null,
        });
        // Pre-fill picker state from existing deadline
        const base = task.deadline ? new Date(task.deadline) : new Date();
        const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i);
        setPickerMonth(base.getMonth());
        setPickerDay(base.getDate() - 1);
        setPickerYear(task.deadline ? yearOptions.indexOf(base.getFullYear()) : 0);
        setPickerHour(base.getHours());
        setPickerMinute(base.getMinutes());
        setDetailModalVisible(true);
    };

    const saveTaskDetails = async () => {
        setSavingTask(true);
        try {
            const prevTask = columns
                .find(c => c.id === activeColumnId)?.tasks
                .find(t => t.id === activeTask.id);

            const taskToSave = { ...activeTask };

            const updatedColumns = columns.map(col => {
                if (col.id === activeColumnId) {
                    return { ...col, tasks: col.tasks.map(t => t.id === activeTask.id ? taskToSave : t) };
                }
                return col;
            });
            setColumns(updatedColumns);
            await syncToFirebase(updatedColumns);

            // Notify newly assigned user
            const newAssignee = taskToSave.assignee;
            const prevAssignee = prevTask?.assignee;
            if (newAssignee && newAssignee !== prevAssignee) {
                await sendTaskAssignedNotification(newAssignee, taskToSave.text || taskToSave.title || 'a task');
            }

            // Schedule deadline reminders if deadline was set or changed
            if (taskToSave.deadline && taskToSave.deadline !== prevTask?.deadline) {
                scheduleDeadlineReminders(
                    taskToSave.text || taskToSave.title || 'Task',
                    newAssignee || null,
                    taskToSave.deadline
                );
            }

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
        const newText = subtaskText.trim();
        const taskName = activeTask?.text || activeTask?.title || 'a task';
        setActiveTask({
            ...activeTask,
            subtasks: [...(activeTask.subtasks || []), { id: Date.now().toString(), text: newText, completed: false }]
        });
        setSubtaskText('');
        sendUniversalNotification(
            'checklist_added',
            `"${newText}" was added to the checklist of task "${taskName}" in ${eventData?.title || 'the workspace'}`
        ).catch(console.error);
    };

    const handleFileUpload = async () => {
        const CLOUDINARY_CLOUD_NAME    = 'dgvbemrgw';
        const CLOUDINARY_UPLOAD_PRESET = 'invitation';
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled) return;
            setUploading(true);

            const file = result.assets[0];
            if (!file?.uri) throw new Error('No file URI returned from picker');

            const formData = new FormData();
            formData.append('file', {
                uri:  file.uri,
                name: file.name,
                type: file.mimeType || 'application/octet-stream',
            });
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            formData.append('folder', `occasio/task_attachments/${eventId}`);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody?.error?.message || `Cloudinary error ${response.status}`);
            }

            const cloudData = await response.json();
            const downloadUrl = cloudData.secure_url;

            const newAttachment = {
                id: Date.now().toString(),
                url: downloadUrl,
                name: file.name,
                size: file.size,
            };

            const updatedTask = {
                ...activeTask,
                attachments: [...(activeTask.attachments || []), newAttachment],
            };
            setActiveTask(updatedTask);

            // Persist immediately to Firestore so attachments are not lost if modal is dismissed
            const updatedColumns = columns.map(col => {
                if (col.id === activeColumnId) {
                    return { ...col, tasks: col.tasks.map(t => t.id === activeTask.id ? updatedTask : t) };
                }
                return col;
            });
            setColumns(updatedColumns);
            await syncToFirebase(updatedColumns);

            Alert.alert('Success', 'File uploaded successfully');
        } catch (error) {
            console.error('Attachment upload error:', error);
            Alert.alert('Upload Failed', error.message || 'Failed to upload file.');
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
                notificationDetail = `added a new list "${inputText}" to ${eventData?.title || 'the workspace'}`;
            } else if (modalConfig.type === 'ADD_TASK') {
                newColumns = columns.map(col => {
                    if (col.id === modalConfig.columnId) {
                        notificationDetail = `"${inputText}" was added to ${eventData?.title || 'the workspace'}`;
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
                        {/* Past event notice banner */}
                        {isPastEvent && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.18)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: overallProgress !== null ? 10 : 0 }}>
                                <Ionicons name="lock-closed" size={13} color="rgba(255,180,180,0.95)" />
                                <CustomText style={{ color: 'rgba(255,200,200,0.95)', fontSize: 12, fontWeight: '700', marginLeft: 7, flex: 1 }}>
                                    This event has passed — the workspace is read-only
                                </CustomText>
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

                            {/* + New List tab */}
                            {isOwner && !isPastEvent && (
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

                            {/* Vendors tab */}
                            <TouchableOpacity
                                onPress={() => setPinnedVendorsModalVisible(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    backgroundColor: '#F0F9F9',
                                    borderWidth: 1,
                                    borderColor: '#99D6D9',
                                }}
                            >
                                <Ionicons name="storefront-outline" size={12} color="#00686F" />
                                <CustomText style={{ color: '#00686F', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Vendors</CustomText>
                                {pinnedVendors.length > 0 && (
                                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#00686F', alignItems: 'center', justifyContent: 'center', marginLeft: 5 }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{pinnedVendors.length}</CustomText>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Occasio Suggests tab */}
                            <TouchableOpacity
                                onPress={() => { setSuggestionsVisible(true); if (!suggestions) fetchSuggestions(); }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 20,
                                    backgroundColor: '#FFF7ED',
                                    borderWidth: 1,
                                    borderColor: '#FED7AA',
                                }}
                            >
                                <Ionicons name="sparkles" size={12} color="#F97316" />
                                <CustomText style={{ color: '#F97316', fontSize: 12, fontWeight: '700', marginLeft: 5 }}>Occasio Suggests</CustomText>
                            </TouchableOpacity>
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
                                {isOwner && !overviewCollapsed && !isPastEvent && (
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
                                    {isOwner && !isPastEvent && (
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
                                            editable={isOwner && !isPastEvent}
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
                                        {isOwner && !isPastEvent && (
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
                                            enabled={isOwner && !isPastEvent}
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
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flexWrap: 'wrap' }}>
                                                        {/* Priority pill */}
                                                        {!task.completed && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pm.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: pm.color, marginRight: 4 }} />
                                                                <CustomText style={{ color: pm.color, fontSize: 10, fontWeight: '700' }}>{pm.label}</CustomText>
                                                            </View>
                                                        )}
                                                        {/* Assignee badge */}
                                                        {task.assignee && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                <Ionicons name="person-outline" size={9} color="#3B82F6" />
                                                                <CustomText style={{ color: '#3B82F6', fontSize: 10, fontWeight: '700', marginLeft: 3 }} numberOfLines={1}>
                                                                    {task.assignee.split('@')[0]}
                                                                </CustomText>
                                                            </View>
                                                        )}
                                                        {/* Deadline badge */}
                                                        {task.deadline && (() => {
                                                            const now = Date.now();
                                                            const isPast = task.deadline < now;
                                                            const hrsLeft = (task.deadline - now) / 3600000;
                                                            const isSoon = !isPast && hrsLeft <= 24;
                                                            const deadlineLabel = new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                            return (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isPast ? '#FEF2F2' : isSoon ? '#FFF7ED' : '#F8FAFC', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                    <Ionicons name="alarm-outline" size={9} color={isPast ? '#EF4444' : isSoon ? '#F97316' : '#94A3B8'} />
                                                                    <CustomText style={{ color: isPast ? '#EF4444' : isSoon ? '#F97316' : '#94A3B8', fontSize: 10, fontWeight: '700', marginLeft: 3 }}>
                                                                        {isPast ? 'Overdue' : deadlineLabel}
                                                                    </CustomText>
                                                                </View>
                                                            );
                                                        })()}
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
                                {isOwner && !isPastEvent && (
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

                {/* ═══════════════════════════════════════════════════════════════
                    OCCASIO SUGGESTS BOTTOM SHEET
                ═══════════════════════════════════════════════════════════════ */}
                <Modal visible={suggestionsVisible} transparent animationType="slide" onRequestClose={() => setSuggestionsVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '88%', paddingBottom: 36 }}>
                            {/* Handle */}
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12 }} />

                            {/* Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="sparkles" size={20} color="#F97316" />
                                    </View>
                                    <View>
                                        <CustomText style={{ color: '#F97316', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>AI POWERED</CustomText>
                                        <CustomText style={{ color: '#0F172A', fontSize: 17, fontWeight: '800' }}>Occasio Suggests</CustomText>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={fetchSuggestions}
                                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Ionicons name="refresh-outline" size={16} color="#F97316" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setSuggestionsVisible(false)}
                                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <Ionicons name="close" size={18} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>
                                {loadingSuggestions ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                                        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                            <ActivityIndicator size="large" color="#F97316" />
                                        </View>
                                        <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '700', marginBottom: 6 }}>Curating suggestions…</CustomText>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>Analyzing your event details and tasks</CustomText>
                                    </View>
                                ) : suggestions?.error ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                        <Ionicons name="cloud-offline-outline" size={40} color="#CBD5E1" />
                                        <CustomText style={{ color: '#64748B', fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 4 }}>Couldn't load suggestions</CustomText>
                                        {suggestions.message ? (
                                            <CustomText style={{ color: '#94A3B8', fontSize: 11, marginBottom: 16, textAlign: 'center', paddingHorizontal: 20 }}>{suggestions.message}</CustomText>
                                        ) : <View style={{ marginBottom: 16 }} />}
                                        <TouchableOpacity
                                            onPress={fetchSuggestions}
                                            style={{ backgroundColor: '#F97316', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}
                                        >
                                            <CustomText style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Try Again</CustomText>
                                        </TouchableOpacity>
                                    </View>
                                ) : suggestions ? (
                                    <>
                                        {/* Summary pill */}
                                        <View style={{ backgroundColor: '#FFF7ED', borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#FED7AA' }}>
                                            <CustomText style={{ color: '#92400E', fontSize: 13, fontWeight: '600', lineHeight: 20 }}>{suggestions.summary}</CustomText>
                                        </View>

                                        {/* Categories */}
                                        {(suggestions.categories || []).map((cat, ci) => (
                                            <View key={ci} style={{ marginBottom: 18 }}>
                                                {/* Category header */}
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                                        <Ionicons name={cat.icon || 'star-outline'} size={16} color="#F97316" />
                                                    </View>
                                                    <CustomText style={{ color: '#0F172A', fontSize: 14, fontWeight: '800' }}>{cat.name}</CustomText>
                                                </View>
                                                {/* Tips */}
                                                {cat.tips ? (
                                                    <CustomText style={{ color: '#64748B', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 10, paddingLeft: 42 }}>{cat.tips}</CustomText>
                                                ) : null}
                                                {/* Vendor cards */}
                                                {(cat.vendors || []).map((v, vi) => (
                                                    <View key={vi} style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F97316', marginRight: 8 }} />
                                                            <CustomText style={{ color: '#1E293B', fontSize: 14, fontWeight: '700', flex: 1 }}>{v.name}</CustomText>
                                                        </View>
                                                        <CustomText style={{ color: '#475569', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 4 }}>{v.why}</CustomText>
                                                        {v.note ? (
                                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E8F5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                                                                <Ionicons name="bulb-outline" size={11} color="#00686F" style={{ marginTop: 1, marginRight: 5 }} />
                                                                <CustomText style={{ color: '#00686F', fontSize: 11, fontWeight: '600', flex: 1 }}>{v.note}</CustomText>
                                                            </View>
                                                        ) : null}
                                                    </View>
                                                ))}
                                            </View>
                                        ))}

                                        <CustomText style={{ color: '#CBD5E1', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                                            Suggestions generated by AI · Always verify availability
                                        </CustomText>
                                    </>
                                ) : null}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* ═══════════════════════════════════════════════════════════════
                    VENDOR PICKER — standalone component
                ═══════════════════════════════════════════════════════════════ */}
                <VendorPicker
                    visible={vendorPickerVisible}
                    onClose={() => setVendorPickerVisible(false)}
                    pinnedVendors={pinnedVendors}
                    onPin={pinVendor}
                    onUnpin={unpinVendor}
                    communityVendors={communityVendors}
                />

                {/* ═══════════════════════════════════════════════════════════════
                    PINNED VENDORS VIEW MODAL
                ═══════════════════════════════════════════════════════════════ */}
                <Modal visible={pinnedVendorsModalVisible} transparent animationType="slide" onRequestClose={() => setPinnedVendorsModalVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#F0F4F8', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '80%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 }}>
                            {/* Top accent */}
                            <View style={{ height: 4, backgroundColor: '#00686F' }} />

                            {/* Handle */}
                            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                            </View>

                            {/* Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }}>
                                <View>
                                    <CustomText style={{ color: '#00686F', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }}>OCCASIO</CustomText>
                                    <CustomText style={{ color: '#0F172A', fontSize: 20, fontWeight: '800' }}>Pinned Vendors</CustomText>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setPinnedVendorsModalVisible(false)}
                                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0F2F3', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00686F30' }}
                                >
                                    <Ionicons name="close" size={18} color="#00686F" />
                                </TouchableOpacity>
                            </View>

                            {/* Vendor list or empty */}
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
                                {pinnedVendors.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                                        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#E0F2F3', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                                            <Ionicons name="storefront-outline" size={28} color="#00686F" />
                                        </View>
                                        <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '700', marginBottom: 6 }}>No vendors pinned yet</CustomText>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
                                            Browse the vendor directory and pin vendors to this event.
                                        </CustomText>
                                        {!isPastEvent && (
                                            <TouchableOpacity
                                                onPress={() => { setPinnedVendorsModalVisible(false); setVendorPickerVisible(true); }}
                                                style={{ backgroundColor: '#00686F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}
                                            >
                                                <Ionicons name="storefront-outline" size={15} color="#FFF" style={{ marginRight: 7 }} />
                                                <CustomText style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Browse Vendors</CustomText>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    pinnedVendors.map((vendor) => {
                                        const CATEGORY_ICONS_LOCAL = { 'Unassigned': 'help-circle-outline', 'Attire & Accessories': 'shirt-outline', 'Beauty': 'sparkles-outline', 'Music & Show': 'musical-notes-outline', 'Photo & Video': 'camera-outline', 'Accessories': 'diamond-outline', 'Flower & Decor': 'flower-outline', 'Catering': 'restaurant-outline', 'Custom': 'person-outline' };
                                        const iconName = CATEGORY_ICONS_LOCAL[vendor.category] || 'storefront-outline';
                                        return (
                                            <View key={vendor.id} style={{ backgroundColor: '#FFF', borderRadius: 20, marginBottom: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#E0F2F3', shadowColor: '#00686F', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 }}>
                                                <View style={{ height: 3, backgroundColor: '#00686F' }} />
                                                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13 }}>
                                                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#E0F2F3', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                                        <Ionicons name={iconName} size={22} color="#00686F" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                                            <CustomText style={{ color: '#0F172A', fontSize: 14, fontWeight: '800' }} numberOfLines={1}>{vendor.name}</CustomText>
                                                            {vendor.isCustom && (
                                                                <View style={{ backgroundColor: '#FFF7ED', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FED7AA' }}>
                                                                    <CustomText style={{ color: '#F97316', fontSize: 9, fontWeight: '800' }}>CUSTOM</CustomText>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                            <View style={{ backgroundColor: '#F0F9FA', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#E0F2F3' }}>
                                                                <CustomText style={{ color: '#00686F', fontSize: 10, fontWeight: '700' }}>{vendor.category || 'Vendor'}</CustomText>
                                                            </View>
                                                            {vendor.phone && (
                                                                <TouchableOpacity
                                                                    onPress={() => Linking.openURL(`tel:${vendor.phone}`)}
                                                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                                                >
                                                                    <Ionicons name="call" size={11} color="#00686F" />
                                                                    <CustomText style={{ color: '#00686F', fontSize: 11, fontWeight: '600', marginLeft: 3 }}>{vendor.phone}</CustomText>
                                                                </TouchableOpacity>
                                                            )}
                                                            {vendor.location && (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <Ionicons name="location" size={11} color="#94A3B8" />
                                                                    <CustomText style={{ color: '#94A3B8', fontSize: 11, fontWeight: '500', marginLeft: 3 }} numberOfLines={1}>{vendor.location}</CustomText>
                                                                </View>
                                                            )}
                                                        </View>
                                                    </View>
                                                    {!isPastEvent && (
                                                        <TouchableOpacity
                                                            onPress={() => unpinVendor(vendor.id)}
                                                            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                                                        >
                                                            <Ionicons name="close" size={16} color="#EF4444" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </ScrollView>

                            {/* Footer */}
                            {!isPastEvent && (
                                <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#E8EEF4', backgroundColor: '#F0F4F8' }}>
                                    <TouchableOpacity
                                        onPress={() => { setPinnedVendorsModalVisible(false); setVendorPickerVisible(true); }}
                                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 18, backgroundColor: '#00686F', shadowColor: '#004E54', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 }}
                                    >
                                        <Ionicons name="storefront-outline" size={17} color="#FFF" style={{ marginRight: 8 }} />
                                        <CustomText style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>
                                            {pinnedVendors.length > 0 ? 'Add More Vendors' : 'Browse Vendor Directory'}
                                        </CustomText>
                                        <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" style={{ marginLeft: 8 }} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

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
                                value={activeTask?.text ?? activeTask?.title ?? ''}
                                editable={isOwner}
                                placeholder="Task title..."
                                placeholderTextColor="#CBD5E1"
                                onChangeText={(t) => setActiveTask({ ...activeTask, text: t, title: t })}
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

                        {/* ── Card: Assign & Deadline ── */}
                        {(isOwner || activeTask?.assignee || activeTask?.deadline) && (
                            <View style={{ backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 12, borderRadius: 18, padding: 16, shadowColor: '#64748B', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>

                                {/* Assignee */}
                                <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>ASSIGNED TO</CustomText>
                                {isOwner && eventData?.collaborators?.length > 0 ? (
                                    <TouchableOpacity
                                        onPress={() => setAssigneePickerVisible(true)}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 16 }}
                                    >
                                        <Ionicons name="person-outline" size={15} color="#3B82F6" style={{ marginRight: 8 }} />
                                        <CustomText style={{ flex: 1, color: activeTask?.assignee ? '#1E293B' : '#CBD5E1', fontSize: 14, fontWeight: '600' }}>
                                            {activeTask?.assignee || 'Assign to collaborator...'}
                                        </CustomText>
                                        {activeTask?.assignee && (
                                            <TouchableOpacity onPress={() => setActiveTask({ ...activeTask, assignee: null })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                <Ionicons name="close-circle" size={17} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        )}
                                        {!activeTask?.assignee && <Ionicons name="chevron-down" size={15} color="#CBD5E1" />}
                                    </TouchableOpacity>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                        {activeTask?.assignee ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
                                                <Ionicons name="person" size={13} color="#3B82F6" style={{ marginRight: 6 }} />
                                                <CustomText style={{ color: '#3B82F6', fontSize: 13, fontWeight: '700' }}>{activeTask.assignee}</CustomText>
                                            </View>
                                        ) : (
                                            <CustomText style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '500' }}>Not assigned</CustomText>
                                        )}
                                    </View>
                                )}

                                {/* No collaborators warning for owner */}
                                {isOwner && (!eventData?.collaborators || eventData.collaborators.length === 0) && (
                                    <CustomText style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', marginBottom: 16 }}>
                                        Add collaborators to enable task assignment.
                                    </CustomText>
                                )}

                                {/* Deadline */}
                                {isOwner && (() => {
                                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                    const deadline = activeTask?.deadline;
                                    const isPast = deadline && deadline < Date.now();
                                    const deadlineLabel = deadline
                                        ? new Date(deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                        : null;
                                    return (
                                        <>
                                            <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>DEADLINE</CustomText>
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: deadline ? 8 : 0 }}>
                                                {/* Date button */}
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (deadline) {
                                                            const d = new Date(deadline);
                                                            const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i);
                                                            setPickerMonth(d.getMonth());
                                                            setPickerDay(d.getDate() - 1);
                                                            setPickerYear(Math.max(0, yearOptions.indexOf(d.getFullYear())));
                                                        }
                                                        setDeadlineDatePickerVisible(true);
                                                    }}
                                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: deadline ? '#00686F' : '#E2E8F0' }}
                                                >
                                                    <Ionicons name="calendar-outline" size={15} color={deadline ? '#00686F' : '#94A3B8'} style={{ marginRight: 7 }} />
                                                    <CustomText style={{ color: deadline ? '#1E293B' : '#CBD5E1', fontSize: 13, fontWeight: '600' }}>
                                                        {deadline
                                                            ? new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                            : 'Set date'}
                                                    </CustomText>
                                                </TouchableOpacity>
                                                {/* Time button */}
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (deadline) {
                                                            const d = new Date(deadline);
                                                            setPickerHour(d.getHours());
                                                            setPickerMinute(d.getMinutes());
                                                        }
                                                        setDeadlineTimePickerVisible(true);
                                                    }}
                                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: deadline ? '#00686F' : '#E2E8F0' }}
                                                >
                                                    <Ionicons name="time-outline" size={15} color={deadline ? '#00686F' : '#94A3B8'} style={{ marginRight: 7 }} />
                                                    <CustomText style={{ color: deadline ? '#1E293B' : '#CBD5E1', fontSize: 13, fontWeight: '600' }}>
                                                        {deadline
                                                            ? new Date(deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                                            : 'Set time'}
                                                    </CustomText>
                                                </TouchableOpacity>
                                            </View>
                                            {/* Deadline summary + clear */}
                                            {deadline && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isPast ? '#FEF2F2' : '#FFF7ED', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}>
                                                    <Ionicons name="alarm-outline" size={13} color={isPast ? '#EF4444' : '#F97316'} />
                                                    <CustomText style={{ flex: 1, color: isPast ? '#EF4444' : '#92400E', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                                                        {isPast ? 'Overdue · ' : 'Due: '}{deadlineLabel}
                                                    </CustomText>
                                                    <TouchableOpacity onPress={() => setActiveTask({ ...activeTask, deadline: null })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                                        <Ionicons name="close-circle" size={16} color={isPast ? '#FCA5A5' : '#FCD34D'} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </>
                                    );
                                })()}
                                {!isOwner && activeTask?.deadline && (
                                    <>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6 }}>DEADLINE</CustomText>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="alarm-outline" size={14} color={activeTask.deadline < Date.now() ? '#EF4444' : '#F97316'} />
                                            <CustomText style={{ color: activeTask.deadline < Date.now() ? '#EF4444' : '#334155', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>
                                                {new Date(activeTask.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </CustomText>
                                        </View>
                                    </>
                                )}
                            </View>
                        )}

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
                                            const isNowDone = !sub.completed;
                                            const updated = activeTask.subtasks.map(s =>
                                                s.id === sub.id ? { ...s, completed: isNowDone } : s
                                            );
                                            setActiveTask({ ...activeTask, subtasks: updated });
                                            // Notify all participants of checklist item completion
                                            sendUniversalNotification(
                                                'checklist_done',
                                                `marked checklist item "${sub.text}" as ${isNowDone ? 'completed' : 'uncompleted'} in "${activeTask?.text || activeTask?.title || 'a card'}"`
                                            ).catch(console.error);
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
                                    {isOwner && !isPastEvent && (
                                        <TouchableOpacity onPress={() => deleteSubtask(sub.id)} style={{ padding: 4, marginLeft: 8 }}>
                                            <Ionicons name="close" size={15} color="#CBD5E1" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            {/* Add subtask input */}
                            {isOwner && !isPastEvent && (
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
                                    {isOwner && !isPastEvent && (
                                        <TouchableOpacity
                                            onPress={() => setActiveTask({ ...activeTask, attachments: activeTask.attachments.filter(a => a.id !== file.id) })}
                                            style={{ padding: 6, marginLeft: 4 }}
                                        >
                                            <Ionicons name="close-circle" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    )}
                                </TouchableOpacity>
                            ))}

                            {!isPastEvent && (
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
                            )}
                        </View>

                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* ── Assignee Picker Modal ─────────────────────────────────────── */}
            <Modal
                visible={assigneePickerVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setAssigneePickerVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setAssigneePickerVisible(false)}
                >
                    <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36, paddingHorizontal: 20, paddingTop: 12 }}>
                        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 18 }} />
                        <CustomText style={{ color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>Assign Task</CustomText>
                        <CustomText style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16 }}>Select a collaborator to assign this task to</CustomText>

                        {/* Unassign option */}
                        <TouchableOpacity
                            onPress={() => { setActiveTask({ ...activeTask, assignee: null }); setAssigneePickerVisible(false); }}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                        >
                            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Ionicons name="person-remove-outline" size={17} color="#94A3B8" />
                            </View>
                            <CustomText style={{ color: '#64748B', fontSize: 14, fontWeight: '600' }}>Unassigned</CustomText>
                            {!activeTask?.assignee && <Ionicons name="checkmark" size={17} color="#00686F" style={{ marginLeft: 'auto' }} />}
                        </TouchableOpacity>

                        {/* Collaborator list */}
                        {(eventData?.collaborators || []).map((email) => (
                            <TouchableOpacity
                                key={email}
                                onPress={() => { setActiveTask({ ...activeTask, assignee: email }); setAssigneePickerVisible(false); }}
                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                            >
                                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                    <CustomText style={{ color: '#3B82F6', fontSize: 14, fontWeight: '800' }}>{email.charAt(0).toUpperCase()}</CustomText>
                                </View>
                                <CustomText style={{ flex: 1, color: '#1E293B', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{email}</CustomText>
                                {activeTask?.assignee === email && <Ionicons name="checkmark" size={17} color="#00686F" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Deadline DATE Picker ──────────────────────────────────────── */}
            {(() => {
                const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i);
                const daysInMonth = new Date(YEAR_OPTIONS[pickerYear], pickerMonth + 1, 0).getDate();
                const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                const confirmDate = () => {
                    const yr = YEAR_OPTIONS[pickerYear];
                    const mo = pickerMonth;
                    const dy = Math.min(pickerDay, daysInMonth - 1);
                    const existing = activeTask?.deadline ? new Date(activeTask.deadline) : new Date();
                    const updated = new Date(yr, mo, dy + 1, existing.getHours(), existing.getMinutes(), 0, 0);
                    setActiveTask({ ...activeTask, deadline: updated.getTime() });
                    setDeadlineDatePickerVisible(false);
                };

                return (
                    <Modal visible={deadlineDatePickerVisible} transparent animationType="slide" onRequestClose={() => setDeadlineDatePickerVisible(false)}>
                        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setDeadlineDatePickerVisible(false)}>
                            <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36 }}>
                                {/* Handle */}
                                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />

                                {/* Header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <TouchableOpacity onPress={() => setDeadlineDatePickerVisible(false)}>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 15, fontWeight: '600' }}>Cancel</CustomText>
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="calendar-outline" size={15} color="#00686F" />
                                        <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '800', marginLeft: 6 }}>Select Date</CustomText>
                                    </View>
                                    <TouchableOpacity onPress={confirmDate} style={{ backgroundColor: '#00686F', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Done</CustomText>
                                    </TouchableOpacity>
                                </View>

                                {/* Preview */}
                                <View style={{ alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFC' }}>
                                    <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700' }}>
                                        {MONTHS[pickerMonth]} {Math.min(pickerDay + 1, daysInMonth)}, {YEAR_OPTIONS[pickerYear]}
                                    </CustomText>
                                </View>

                                {/* Scroll columns */}
                                <View style={{ flexDirection: 'row', height: 200, overflow: 'hidden', position: 'relative' }}>
                                    {/* Selection highlight */}
                                    <View style={{ position: 'absolute', top: '50%', left: 16, right: 16, height: 40, marginTop: -20, backgroundColor: '#E8F5F5', borderRadius: 12, zIndex: 0 }} />

                                    {/* Month */}
                                    <ScrollView
                                        style={{ flex: 2 }}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: 80 }}
                                        onMomentumScrollEnd={(e) => setPickerMonth(Math.round(e.nativeEvent.contentOffset.y / 40))}
                                        contentOffset={{ x: 0, y: pickerMonth * 40 }}
                                    >
                                        {MONTHS.map((m, i) => (
                                            <TouchableOpacity key={m} onPress={() => setPickerMonth(i)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 15, fontWeight: pickerMonth === i ? '800' : '500', color: pickerMonth === i ? '#00686F' : '#64748B' }}>{m}</CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Day */}
                                    <ScrollView
                                        style={{ flex: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: 80 }}
                                        onMomentumScrollEnd={(e) => setPickerDay(Math.round(e.nativeEvent.contentOffset.y / 40))}
                                        contentOffset={{ x: 0, y: pickerDay * 40 }}
                                    >
                                        {DAYS.map((d, i) => (
                                            <TouchableOpacity key={d} onPress={() => setPickerDay(i)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 15, fontWeight: pickerDay === i ? '800' : '500', color: pickerDay === i ? '#00686F' : '#64748B' }}>{String(d).padStart(2,'0')}</CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Year */}
                                    <ScrollView
                                        style={{ flex: 1.2 }}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: 80 }}
                                        onMomentumScrollEnd={(e) => setPickerYear(Math.round(e.nativeEvent.contentOffset.y / 40))}
                                        contentOffset={{ x: 0, y: pickerYear * 40 }}
                                    >
                                        {YEAR_OPTIONS.map((y, i) => (
                                            <TouchableOpacity key={y} onPress={() => setPickerYear(i)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 15, fontWeight: pickerYear === i ? '800' : '500', color: pickerYear === i ? '#00686F' : '#64748B' }}>{y}</CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                );
            })()}

            {/* ── Deadline TIME Picker ──────────────────────────────────────── */}
            {(() => {
                const HOURS   = Array.from({ length: 24 }, (_, i) => i);
                const MINUTES = Array.from({ length: 60 }, (_, i) => i);

                const confirmTime = () => {
                    const existing = activeTask?.deadline ? new Date(activeTask.deadline) : new Date();
                    const updated = new Date(existing.getFullYear(), existing.getMonth(), existing.getDate(), pickerHour, pickerMinute, 0, 0);
                    setActiveTask({ ...activeTask, deadline: updated.getTime() });
                    setDeadlineTimePickerVisible(false);
                };

                const h12 = pickerHour % 12 === 0 ? 12 : pickerHour % 12;
                const ampm = pickerHour < 12 ? 'AM' : 'PM';

                return (
                    <Modal visible={deadlineTimePickerVisible} transparent animationType="slide" onRequestClose={() => setDeadlineTimePickerVisible(false)}>
                        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setDeadlineTimePickerVisible(false)}>
                            <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36 }}>
                                {/* Handle */}
                                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />

                                {/* Header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <TouchableOpacity onPress={() => setDeadlineTimePickerVisible(false)}>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 15, fontWeight: '600' }}>Cancel</CustomText>
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="time-outline" size={15} color="#00686F" />
                                        <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '800', marginLeft: 6 }}>Select Time</CustomText>
                                    </View>
                                    <TouchableOpacity onPress={confirmTime} style={{ backgroundColor: '#00686F', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Done</CustomText>
                                    </TouchableOpacity>
                                </View>

                                {/* Preview */}
                                <View style={{ alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFC' }}>
                                    <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700' }}>
                                        {String(h12).padStart(2,'0')}:{String(pickerMinute).padStart(2,'0')} {ampm}
                                    </CustomText>
                                </View>

                                {/* Scroll columns */}
                                <View style={{ flexDirection: 'row', height: 200, overflow: 'hidden', position: 'relative' }}>
                                    {/* Selection highlight */}
                                    <View style={{ position: 'absolute', top: '50%', left: 16, right: 16, height: 40, marginTop: -20, backgroundColor: '#E8F5F5', borderRadius: 12, zIndex: 0 }} />

                                    {/* Hour */}
                                    <ScrollView
                                        style={{ flex: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: 80 }}
                                        onMomentumScrollEnd={(e) => setPickerHour(Math.round(e.nativeEvent.contentOffset.y / 40))}
                                        contentOffset={{ x: 0, y: pickerHour * 40 }}
                                    >
                                        {HOURS.map((h) => (
                                            <TouchableOpacity key={h} onPress={() => setPickerHour(h)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 22, fontWeight: pickerHour === h ? '800' : '400', color: pickerHour === h ? '#00686F' : '#64748B' }}>
                                                    {String(h % 12 === 0 ? 12 : h % 12).padStart(2,'0')}
                                                </CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Colon separator */}
                                    <View style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
                                        <CustomText style={{ fontSize: 24, fontWeight: '800', color: '#00686F' }}>:</CustomText>
                                    </View>

                                    {/* Minute */}
                                    <ScrollView
                                        style={{ flex: 1 }}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={40}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: 80 }}
                                        onMomentumScrollEnd={(e) => setPickerMinute(Math.round(e.nativeEvent.contentOffset.y / 40))}
                                        contentOffset={{ x: 0, y: pickerMinute * 40 }}
                                    >
                                        {MINUTES.map((m) => (
                                            <TouchableOpacity key={m} onPress={() => setPickerMinute(m)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 22, fontWeight: pickerMinute === m ? '800' : '400', color: pickerMinute === m ? '#00686F' : '#64748B' }}>
                                                    {String(m).padStart(2,'0')}
                                                </CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* AM/PM */}
                                    <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => { if (pickerHour >= 12) setPickerHour(pickerHour - 12); }}
                                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pickerHour < 12 ? '#00686F' : '#F1F5F9' }}
                                        >
                                            <CustomText style={{ color: pickerHour < 12 ? '#FFF' : '#94A3B8', fontSize: 13, fontWeight: '800' }}>AM</CustomText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => { if (pickerHour < 12) setPickerHour(pickerHour + 12); }}
                                            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pickerHour >= 12 ? '#00686F' : '#F1F5F9' }}
                                        >
                                            <CustomText style={{ color: pickerHour >= 12 ? '#FFF' : '#94A3B8', fontSize: 13, fontWeight: '800' }}>PM</CustomText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                );
            })()}

        </View>
    );
}