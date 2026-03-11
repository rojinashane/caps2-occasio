import React, { useState, useEffect, useRef } from 'react';
import {
    View, Modal, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
    collection, query, where, onSnapshot,
    doc, updateDoc, arrayUnion, deleteDoc,
    addDoc, getDoc, getDocs, serverTimestamp, limit, writeBatch
} from 'firebase/firestore';
import CustomText from './CustomText';
import tw from 'twrnc';
import NotificationService from '../services/NotificationService'; // <-- Import the new service

// ── Helpers ───────────────────────────────────────────────────────────────────
const INVITE_EXPIRY_MINUTES = 10;

const formatNotifTimestamp = (createdAt) => {
    if (!createdAt) return '';
    const d = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatFullTimestamp = (createdAt) => {
    if (!createdAt) return '';
    const d = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

const isInviteExpired = (createdAt) => {
    if (!createdAt) return false;
    const d = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    if (isNaN(d.getTime())) return false;
    const diffMins = (new Date() - d) / 60000;
    return diffMins > INVITE_EXPIRY_MINUTES;
};

const getExpiryMinutesLeft = (createdAt) => {
    if (!createdAt) return 0;
    const d = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    const diffMins = (new Date() - d) / 60000;
    return Math.max(0, Math.ceil(INVITE_EXPIRY_MINUTES - diffMins));
};

export default function NotificationModal({ visible, onClose }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    // Track if this is the first load so we don't blast users with old notifications
    const isInitialLoad = useRef(true);

    useEffect(() => {
        if (!auth.currentUser) return; // Keep listening in the background even if modal isn't visible

        setLoading(true);
        const uid = auth.currentUser.uid;

        const q = query(
            collection(db, 'notifications'),
            where('recipientId', '==', uid),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Check for new notifications added to the collection
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
            } else {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const data = change.doc.data();

                        // Set up content based on type
                        let notifTitle = "New Notification";
                        let notifBody = "You have a new update.";

                        if (data.type === 'checklist_done') {
                            notifTitle = "Checklist Update";
                            notifBody = `${data.senderName || 'Someone'} completed an item in ${data.eventTitle || 'a workspace'}.`;
                        } else if (data.type === 'checklist_added') {
                            notifTitle = "Checklist Added";
                            notifBody = `${data.senderName || 'Someone'} added an item to ${data.eventTitle || 'a workspace'}.`;
                        } else if (data.type === 'task_assigned') {
                            notifTitle = "Task Assigned";
                            notifBody = data.body || `You've been assigned a task in ${data.eventTitle || 'a workspace'}.`;
                        } else if (data.type === 'task_deadline') {
                            notifTitle = "⏰ Deadline Approaching";
                            notifBody = data.body || `A task deadline is approaching in ${data.eventTitle || 'a workspace'}.`;
                        } else if (data.type === 'task_deadline_ended') {
                            notifTitle = "🔴 Deadline Passed";
                            notifBody = data.body || `A task deadline has passed in ${data.eventTitle || 'a workspace'}.`;
                        } else if (data.type === 'COLLAB_REQUEST') {
                            notifTitle = "🤝 Collaboration Invite";
                            notifBody = data.body || `${data.senderName || 'Someone'} invited you to work on ${data.eventTitle || 'an event'}.`;
                        } else if (data.type === 'collab_accepted') {
                            notifTitle = "🎉 Collaborator Joined";
                        } else {
                            notifTitle = "New Notification";
                        }

                        // Fire local push alert immediately
                        NotificationService.sendImmediateNotification(notifTitle, notifBody);
                    }
                });
            }

            // Sync visual list — newest first
            const list = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => {
                    const aMs = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0);
                    const bMs = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0);
                    return bMs - aMs;
                });
            setNotifications(list);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Subscription Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []); // Removed `visible` from dependency array so it listens in background 

    // Mark all unviewed notifications as viewed when modal opens
    useEffect(() => {
        if (!visible || !auth.currentUser) return;
        const markAllViewed = async () => {
            try {
                const uid = auth.currentUser.uid;
                const snap = await getDocs(
                    query(
                        collection(db, 'notifications'),
                        where('recipientId', '==', uid),
                        where('status', '==', 'pending'),
                        where('viewed', '==', false)
                    )
                );
                if (snap.empty) return;
                const batch = writeBatch(db);
                snap.docs.forEach(d => batch.update(d.ref, { viewed: true }));
                await batch.commit();
            } catch (e) {
                console.error('markAllViewed error:', e);
            }
        };
        markAllViewed();
    }, [visible]);

    const handleAccept = async (notif) => {
        try {
            if (!notif.eventId) {
                Alert.alert("Error", "Event ID is missing from this invitation.");
                return;
            }

            // Check 10-minute expiry for collab invitations
            if (notif.type === 'COLLAB_REQUEST' && isInviteExpired(notif.createdAt)) {
                await deleteDoc(doc(db, 'notifications', notif.id));
                Alert.alert("Invitation Expired", "This invitation has expired. The sender must re-invite you.");
                return;
            }

            const acceptorEmail = auth.currentUser.email.toLowerCase();
            const acceptorName  = auth.currentUser.displayName || acceptorEmail;

            // Add acceptor as collaborator on the event
            const eventRef = doc(db, 'events', notif.eventId);
            await updateDoc(eventRef, {
                collaborators: arrayUnion(acceptorEmail)
            });

            // Fetch the event to get owner uid + existing collaborators
            const eventSnap = await getDoc(eventRef);
            const eventData = eventSnap.exists() ? eventSnap.data() : null;

            if (eventData) {
                // Build the set of people to notify:
                // owner + all current collaborators, minus the acceptor themselves
                const recipientEmails = new Set();

                // Resolve owner email from uid
                if (eventData.userId) {
                    try {
                        const ownerSnap = await getDocs(query(
                            collection(db, 'users'),
                            where('uid', '==', eventData.userId),
                            limit(1)
                        ));
                        if (!ownerSnap.empty) {
                            const ownerEmail = ownerSnap.docs[0].data().email?.toLowerCase();
                            if (ownerEmail) recipientEmails.add(ownerEmail);
                        }
                    } catch (_) {}
                }

                // Add existing collaborators (before the new one was appended)
                (eventData.collaborators || []).forEach(e => {
                    if (e && e.toLowerCase() !== acceptorEmail) {
                        recipientEmails.add(e.toLowerCase());
                    }
                });

                // Send a notification to each recipient
                for (const email of recipientEmails) {
                    try {
                        const userSnap = await getDocs(query(
                            collection(db, 'users'),
                            where('email', '==', email),
                            limit(1)
                        ));
                        if (!userSnap.empty) {
                            await addDoc(collection(db, 'notifications'), {
                                recipientId:  userSnap.docs[0].id,
                                senderName:   acceptorName,
                                type:         'collab_accepted',
                                body:         `${acceptorName} accepted the invitation and joined ${notif.eventTitle || 'your workspace'}.`,
                                status:       'pending',
                                eventId:      notif.eventId,
                                eventTitle:   notif.eventTitle || 'Workspace',
                                createdAt:    serverTimestamp(),
                            });
                        }
                    } catch (err) {
                        console.error('Failed to notify participant on accept:', email, err);
                    }
                }
            }

            await deleteDoc(doc(db, 'notifications', notif.id));
            Alert.alert("Success", `You joined ${notif.eventTitle || 'the event'}`);
        } catch (error) {
            console.error("Accept Error:", error);
            Alert.alert("Error", "Could not join the event. Ensure the event still exists.");
        }
    };

    const handleDecline = async (notifId) => {
        try {
            await deleteDoc(doc(db, 'notifications', notifId));
        } catch (error) {
            console.error("Decline Error:", error);
            Alert.alert("Error", "Failed to decline invitation.");
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={tw`flex-1 justify-end bg-slate-900/50`}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    activeOpacity={1}
                />

                <View style={[
                    tw`bg-white h-[75%] rounded-t-[32px] px-6 pt-3 pb-8`,
                    { shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }
                ]}>
                    <View style={tw`w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6`} />

                    <View style={tw`flex-row justify-between items-center mb-6`}>
                        <CustomText fontFamily="extrabold" style={tw`text-2xl text-slate-800 tracking-tight`}>
                            Notifications
                        </CustomText>
                        <TouchableOpacity
                            onPress={onClose}
                            style={tw`w-8 h-8 bg-slate-100 rounded-full justify-center items-center`}
                        >
                            <Ionicons name="close" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={tw`flex-1 justify-center items-center`}>
                            <ActivityIndicator size="large" color="#00686F" />
                        </View>
                    ) : notifications.length === 0 ? (
                        <View style={tw`flex-1 justify-center items-center pb-20`}>
                            <View style={tw`w-24 h-24 bg-slate-50 rounded-full justify-center items-center mb-4`}>
                                <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
                            </View>
                            <CustomText fontFamily="bold" style={tw`text-slate-700 text-[18px] mb-1`}>All Caught Up!</CustomText>
                            <CustomText fontFamily="medium" style={tw`text-slate-400 text-[14px]`}>You have no new invitations right now.</CustomText>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-10`}>
                            {notifications.map((notif) => {
                                const isChecklistDone = notif.type === 'checklist_done';
                                const isChecklistAdded = notif.type === 'checklist_added';
                                const isChecklist = isChecklistDone || isChecklistAdded;
                                const isTaskAssigned = notif.type === 'task_assigned';
                                const isTaskDeadline = notif.type === 'task_deadline' || notif.type === 'task_deadline_ended';
                                const isCollabRequest = notif.type === 'COLLAB_REQUEST';
                                const expired = isCollabRequest && isInviteExpired(notif.createdAt);
                                const minsLeft = isCollabRequest && !expired ? getExpiryMinutesLeft(notif.createdAt) : 0;

                                let typeLabel = 'Collaboration Request';
                                let typeIcon = 'people';
                                if (isChecklistDone)                    { typeLabel = 'Checklist Update';     typeIcon = 'checkmark-circle'; }
                                else if (isChecklistAdded)              { typeLabel = 'Checklist Added';      typeIcon = 'add-circle'; }
                                else if (notif.type === 'item_checked') { typeLabel = 'Task Completed';       typeIcon = 'checkmark-done-circle'; }
                                else if (notif.type === 'card_added')   { typeLabel = 'Task Added';           typeIcon = 'add-circle-outline'; }
                                else if (notif.type === 'list_added')   { typeLabel = 'List Added';           typeIcon = 'list-outline'; }
                                else if (isTaskAssigned)                { typeLabel = 'Task Assigned';        typeIcon = 'person-add'; }
                                else if (isTaskDeadline)                { typeLabel = notif.type === 'task_deadline_ended' ? 'Deadline Passed' : 'Deadline Soon'; typeIcon = 'alarm'; }
                                else if (notif.type === 'collab_accepted') { typeLabel = 'Collaborator Joined'; typeIcon = 'people-circle'; }

                                const isCollabAccepted = notif.type === 'collab_accepted';

                                // Icon & label accent color
                                const accentColor = expired ? '#EF4444'
                                    : isTaskDeadline ? '#F97316'
                                    : isTaskAssigned ? '#3B82F6'
                                    : isCollabAccepted ? '#8B5CF6'
                                    : '#00686F';

                                const iconBg = expired ? '#FEF2F2'
                                    : isTaskDeadline ? '#FFF7ED'
                                    : isTaskAssigned ? '#F0F9FF'
                                    : isCollabAccepted ? '#F5F3FF'
                                    : '#E8F5F5';

                                // Body — always use notif.body; only build fallback for COLLAB_REQUEST
                                const bodyText = notif.body
                                    ? notif.body
                                    : isCollabRequest
                                        ? `${notif.senderName || 'Someone'} invited you to work on ${notif.eventTitle || 'an event'}.`
                                        : 'You have a new update.';

                                // Dismiss-only types (no Accept/Decline)
                                const isDismissOnly = isChecklist || isTaskAssigned || isTaskDeadline
                                    || expired || isCollabAccepted
                                    || notif.type === 'item_checked'
                                    || notif.type === 'card_added'
                                    || notif.type === 'list_added';

                                return (
                                    <View
                                        key={notif.id}
                                        style={[
                                            tw`bg-white p-4 rounded-[24px] mb-4 border shadow-sm flex-row`,
                                            expired
                                                ? { borderColor: '#FCA5A5', backgroundColor: '#FFF8F8' }
                                                : isCollabAccepted
                                                    ? { borderColor: '#DDD6FE' }
                                                    : { borderColor: '#F1F5F9' }
                                        ]}
                                    >
                                        {/* Icon */}
                                        <View style={[tw`w-12 h-12 rounded-full justify-center items-center mr-4`, { backgroundColor: iconBg }]}>
                                            <Ionicons name={typeIcon} size={20} color={accentColor} />
                                        </View>

                                        <View style={tw`flex-1`}>
                                            {/* Type label + relative timestamp */}
                                            <View style={tw`flex-row justify-between items-center mb-1`}>
                                                <CustomText fontFamily="bold" style={{ fontSize: 10, color: accentColor, textTransform: 'uppercase', letterSpacing: 1 }}>
                                                    {expired ? 'EXPIRED' : typeLabel}
                                                </CustomText>
                                                <CustomText fontFamily="medium" style={tw`text-[10px] text-slate-400`}>
                                                    {formatNotifTimestamp(notif.createdAt)}
                                                </CustomText>
                                            </View>

                                            {/* Full date/time */}
                                            <CustomText fontFamily="medium" style={tw`text-[10px] text-slate-300 mb-2`}>
                                                {formatFullTimestamp(notif.createdAt)}
                                            </CustomText>

                                            {/* Body */}
                                            <CustomText fontFamily="medium" style={tw`text-[14px] text-slate-600 leading-5 mb-3`}>
                                                {bodyText}
                                            </CustomText>

                                            {/* Expiry countdown for pending collab requests */}
                                            {isCollabRequest && !expired && minsLeft <= 10 && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                    <Ionicons name="time-outline" size={12} color="#F97316" />
                                                    <CustomText fontFamily="bold" style={{ color: '#F97316', fontSize: 11, marginLeft: 4 }}>
                                                        Expires in {minsLeft} min{minsLeft !== 1 ? 's' : ''}
                                                    </CustomText>
                                                </View>
                                            )}

                                            {/* Actions */}
                                            <View style={tw`flex-row justify-end`}>
                                                {isDismissOnly ? (
                                                    <TouchableOpacity
                                                        style={tw`py-2.5 px-6 rounded-xl bg-slate-100`}
                                                        onPress={() => handleDecline(notif.id)}
                                                    >
                                                        <CustomText fontFamily="bold" style={tw`text-slate-500 text-[13px]`}>Dismiss</CustomText>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <>
                                                        <TouchableOpacity
                                                            style={tw`py-2.5 px-6 rounded-xl bg-slate-100 mr-3`}
                                                            onPress={() => handleDecline(notif.id)}
                                                        >
                                                            <CustomText fontFamily="bold" style={tw`text-slate-500 text-[13px]`}>Decline</CustomText>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={tw`py-2.5 px-6 rounded-xl bg-[#00686F]`}
                                                            onPress={() => handleAccept(notif)}
                                                        >
                                                            <CustomText fontFamily="bold" style={tw`text-white text-[13px]`}>Accept</CustomText>
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}