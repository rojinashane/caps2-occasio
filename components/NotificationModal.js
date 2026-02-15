import React, { useState, useEffect } from 'react';
import { 
    View, Modal, StyleSheet, TouchableOpacity, ScrollView, 
    ActivityIndicator, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { 
    collection, query, where, onSnapshot, 
    doc, updateDoc, arrayUnion, deleteDoc 
} from 'firebase/firestore';
import CustomText from './CustomText';

export default function NotificationModal({ visible, onClose }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Essential: only run if the modal is visible and user is logged in
        if (!visible || !auth.currentUser) return;

        setLoading(true);
        
        // Use the current user's ID
        const uid = auth.currentUser.uid;

        const q = query(
            collection(db, 'notifications'),
            where('recipientId', '==', uid),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setNotifications(list);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Subscription Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [visible]); // Re-run when modal opens to ensure fresh data

    const handleAccept = async (notif) => {
        try {
            if (!notif.eventId) {
                Alert.alert("Error", "Event ID is missing from this invitation.");
                return;
            }

            // 1. Add user's email to the event's collaborators array
            const eventRef = doc(db, 'events', notif.eventId);
            await updateDoc(eventRef, {
                collaborators: arrayUnion(auth.currentUser.email.toLowerCase())
            });

            // 2. Delete the notification after success
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
            <View style={styles.overlay}>
                {/* Touchable background to close modal */}
                <TouchableOpacity 
                    style={StyleSheet.absoluteFill} 
                    onPress={onClose} 
                    activeOpacity={1} 
                />
                
                <View style={styles.container}>
                    <View style={styles.header}>
                        <CustomText style={styles.headerTitle}>Notifications</CustomText>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#1E293B" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color="#00686F" />
                        </View>
                    ) : notifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-off-outline" size={60} color="#CBD5E1" />
                            <CustomText style={styles.emptyText}>No new invitations</CustomText>
                        </View>
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                            {notifications.map((notif) => (
                                <View key={notif.id} style={styles.notifCard}>
                                    <View style={styles.notifIcon}>
                                        <Ionicons name="people" size={20} color="#00686F" />
                                    </View>
                                    <View style={styles.notifContent}>
                                        <CustomText style={styles.notifTitle}>Collaboration Request</CustomText>
                                        <CustomText style={styles.notifBody}>
                                            <CustomText style={{fontWeight: '700'}}>
                                                {notif.senderName || 'Someone'}
                                            </CustomText> invited you to work on <CustomText style={{fontWeight: '700'}}>
                                                {notif.eventTitle || 'an event'}
                                            </CustomText>.
                                        </CustomText>
                                        
                                        <View style={styles.actionRow}>
                                            <TouchableOpacity 
                                                style={styles.declineBtn} 
                                                onPress={() => handleDecline(notif.id)}
                                            >
                                                <CustomText style={styles.declineText}>Decline</CustomText>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={styles.acceptBtn} 
                                                onPress={() => handleAccept(notif)}
                                            >
                                                <CustomText style={styles.acceptText}>Accept</CustomText>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: '#FFF', height: '75%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, elevation: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    closeBtn: { padding: 4 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingBottom: 40 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 100 },
    emptyText: { color: '#94A3B8', marginTop: 15, fontSize: 16, fontWeight: '600' },
    notifCard: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#F1F5F9' },
    notifIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2F1', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 13, fontWeight: '800', color: '#00686F', marginBottom: 4, textTransform: 'uppercase' },
    notifBody: { fontSize: 15, color: '#475569', lineHeight: 22 },
    actionRow: { flexDirection: 'row', marginTop: 15, justifyContent: 'flex-end' },
    acceptBtn: { backgroundColor: '#00686F', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, marginLeft: 10 },
    acceptText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
    declineBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1' },
    declineText: { color: '#64748B', fontWeight: '700', fontSize: 14 }
});