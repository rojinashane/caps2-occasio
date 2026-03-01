import React, { useState, useEffect } from 'react';
import {
    View, Modal, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
    collection, query, where, onSnapshot,
    doc, updateDoc, arrayUnion, deleteDoc
} from 'firebase/firestore';
import CustomText from './CustomText';
import tw from 'twrnc';

export default function NotificationModal({ visible, onClose }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!visible || !auth.currentUser) return;

        setLoading(true);
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
    }, [visible]);

    const handleAccept = async (notif) => {
        try {
            if (!notif.eventId) {
                Alert.alert("Error", "Event ID is missing from this invitation.");
                return;
            }

            const eventRef = doc(db, 'events', notif.eventId);
            await updateDoc(eventRef, {
                collaborators: arrayUnion(auth.currentUser.email.toLowerCase())
            });

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
                {/* Touchable background to close modal */}
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    activeOpacity={1}
                />

                {/* Bottom Sheet Container */}
                <View style={[
                    tw`bg-white h-[75%] rounded-t-[32px] px-6 pt-3 pb-8`,
                    { shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 }
                ]}>

                    {/* Drag Indicator Pill */}
                    <View style={tw`w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6`} />

                    {/* Header */}
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

                    {/* Content Area */}
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
                                const isChecklistDone  = notif.type === 'checklist_done';
                                const isChecklistAdded = notif.type === 'checklist_added';
                                const isChecklist      = isChecklistDone || isChecklistAdded;

                                return (
                                    <View
                                        key={notif.id}
                                        style={tw`bg-white p-4 rounded-[24px] mb-4 border border-slate-100 shadow-sm flex-row`}
                                    >
                                        {/* Icon */}
                                        <View style={[
                                            tw`w-12 h-12 rounded-full justify-center items-center mr-4`,
                                            { backgroundColor: isChecklist ? '#E8F5F5' : '#E0F2F3' }
                                        ]}>
                                            <Ionicons
                                                name={
                                                    isChecklistDone  ? 'checkmark-circle' :
                                                    isChecklistAdded ? 'add-circle'       :
                                                    'people'
                                                }
                                                size={20}
                                                color="#00686F"
                                            />
                                        </View>

                                        <View style={tw`flex-1`}>
                                            {/* Badge */}
                                            <CustomText fontFamily="bold" style={tw`text-[11px] text-[#00686F] mb-1 uppercase tracking-widest`}>
                                                {isChecklistDone  ? 'Checklist Update' :
                                                 isChecklistAdded ? 'Checklist Added'  :
                                                 'Collaboration Request'}
                                            </CustomText>

                                            {/* Body */}
                                            <CustomText fontFamily="medium" style={tw`text-[14px] text-slate-600 leading-5 mb-4`}>
                                                {isChecklist ? (
                                                    notif.body || (
                                                        <>
                                                            <CustomText fontFamily="bold" style={tw`text-slate-800`}>
                                                                {notif.senderName || 'Someone'}
                                                            </CustomText>
                                                            {' '}{isChecklistDone ? 'completed a checklist item in ' : 'added a checklist item to '}
                                                            <CustomText fontFamily="bold" style={tw`text-slate-800`}>
                                                                {notif.eventTitle || 'a workspace'}
                                                            </CustomText>.
                                                        </>
                                                    )
                                                ) : (
                                                    <>
                                                        <CustomText fontFamily="bold" style={tw`text-slate-800`}>
                                                            {notif.senderName || 'Someone'}
                                                        </CustomText> invited you to work on <CustomText fontFamily="bold" style={tw`text-slate-800`}>
                                                            {notif.eventTitle || 'an event'}
                                                        </CustomText>.
                                                    </>
                                                )}
                                            </CustomText>

                                            {/* Actions */}
                                            <View style={tw`flex-row justify-end`}>
                                                {isChecklist ? (
                                                    // Checklist notifications — Dismiss only
                                                    <TouchableOpacity
                                                        style={tw`py-2.5 px-6 rounded-xl bg-slate-100`}
                                                        onPress={() => handleDecline(notif.id)}
                                                    >
                                                        <CustomText fontFamily="bold" style={tw`text-slate-500 text-[13px]`}>Dismiss</CustomText>
                                                    </TouchableOpacity>
                                                ) : (
                                                    // Collaboration — Decline + Accept
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