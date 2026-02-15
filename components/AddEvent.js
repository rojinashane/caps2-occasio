import React, { useState } from 'react';
import {
    View, ScrollView, TextInput, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator, Platform, Switch, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText'; 
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { 
    collection, addDoc, serverTimestamp, 
    query, where, getDocs 
} from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker'; 
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AddEvent({ navigation }) {
    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState('');
    const [otherType, setOtherType] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    
    // Time State (Start only)
    const [startTime, setStartTime] = useState(new Date());
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);

    const [isMultiDay, setIsMultiDay] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [collaboratorEmail, setCollaboratorEmail] = useState(''); 
    const [loading, setLoading] = useState(false);

    const eventTypes = ['Wedding', 'Birthday Party', 'Corporate', 'Charity', 'Others'];

    const formatDateDisplay = (date) => {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatTimeDisplay = (time) => {
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const onStartChange = (event, selectedDate) => {
        setShowStartPicker(Platform.OS === 'ios');
        if (selectedDate) {
            setStartDate(selectedDate);
            if (selectedDate > endDate) setEndDate(selectedDate);
        }
    };

    const onEndChange = (event, selectedDate) => {
        setShowEndPicker(Platform.OS === 'ios');
        if (selectedDate) setEndDate(selectedDate);
    };

    const onStartTimeChange = (event, selectedTime) => {
        setShowStartTimePicker(Platform.OS === 'ios');
        if (selectedTime) setStartTime(selectedTime);
    };

    const handleCreateEvent = async () => {
        const finalType = eventType === 'Others' ? otherType : eventType;
        if (!title || !finalType) {
            Alert.alert('Missing Info', 'Please fill in the required fields (*)');
            return;
        }

        setLoading(true);
        try {
            const eventRef = await addDoc(collection(db, 'events'), {
                userId: auth.currentUser.uid,
                title,
                eventType: finalType,
                startDate: startDate, 
                startTime: formatTimeDisplay(startTime),
                endDate: isMultiDay ? endDate : null,
                isMultiDay,
                location: location || 'To be decided',
                description,
                collaborators: [], 
                createdAt: serverTimestamp(),
            });

            if (collaboratorEmail.trim()) {
                const cleanEmail = collaboratorEmail.trim().toLowerCase();
                const userQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
                const userSnapshot = await getDocs(userQuery);

                if (!userSnapshot.empty) {
                    const recipientId = userSnapshot.docs[0].id;
                    await addDoc(collection(db, 'notifications'), {
                        recipientId: recipientId,
                        senderId: auth.currentUser.uid,
                        senderName: auth.currentUser.displayName || "An organizer",
                        eventId: eventRef.id,
                        eventTitle: title,
                        status: 'pending',
                        type: 'invitation',
                        createdAt: serverTimestamp()
                    });
                }
            }

            Alert.alert('Success ✨', 'Event listed!', [{ text: 'Done', onPress: () => navigation.goBack() }]);
        } catch (error) {
            console.error("Create Event Error:", error);
            Alert.alert('Error', 'Could not save event.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{flex: 1}}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.roundButton}>
                        <Ionicons name="chevron-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <CustomText style={styles.headerTitle}>New Event</CustomText>
                    <View style={{ width: 40 }} /> 
                </View>

                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    {/* Basic Info Card */}
                    <View style={styles.card}>
                        <CustomText style={styles.label}>Event Name *</CustomText>
                        <TextInput 
                            style={styles.input} 
                            value={title} 
                            onChangeText={setTitle} 
                            placeholder="e.g. Maureen's Birthday" 
                            placeholderTextColor="#9CA3AF"
                        />
                        
                        <CustomText style={[styles.label, {marginTop: 20}]}>Event Type *</CustomText>
                        <View style={styles.pickerContainer}>
                            <Picker 
                                selectedValue={eventType} 
                                onValueChange={(itemValue) => setEventType(itemValue)}
                            >
                                <Picker.Item label="Select type..." value="" color="#9CA3AF" />
                                {eventTypes.map(t => <Picker.Item key={t} label={t} value={t} />)}
                            </Picker>
                        </View>

                        {eventType === 'Others' && (
                            <TextInput 
                                style={[styles.input, {marginTop: 10}]} 
                                value={otherType} 
                                onChangeText={setOtherType} 
                                placeholder="Specify event type" 
                            />
                        )}
                    </View>

                    {/* Date & Time Card */}
                    <View style={styles.card}>
                        <CustomText style={styles.label}>Date & Time</CustomText>
                        
                        <View style={styles.dateTimeRow}>
                            <TouchableOpacity style={[styles.dateSelector, {flex: 1, marginRight: 8}]} onPress={() => setShowStartPicker(true)}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="calendar" size={18} color="#00686F" />
                                </View>
                                <View style={{marginLeft: 10}}>
                                    <CustomText style={styles.dateLabel}>Start Date</CustomText>
                                    <CustomText style={styles.dateValue}>{formatDateDisplay(startDate)}</CustomText>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.dateSelector, {flex: 0.8}]} onPress={() => setShowStartTimePicker(true)}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="time-outline" size={18} color="#00686F" />
                                </View>
                                <View style={{marginLeft: 10}}>
                                    <CustomText style={styles.dateLabel}>Start Time</CustomText>
                                    <CustomText style={styles.dateValue}>{formatTimeDisplay(startTime)}</CustomText>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inlineSwitchRow}>
                            <CustomText style={styles.switchText}>This is a multi-day event</CustomText>
                            <Switch 
                                value={isMultiDay} 
                                onValueChange={setIsMultiDay} 
                                trackColor={{ false: "#E5E7EB", true: "#00686F" }} 
                            />
                        </View>

                        {isMultiDay && (
                            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowEndPicker(true)}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="calendar-outline" size={18} color="#00686F" />
                                </View>
                                <View style={{marginLeft: 12}}>
                                    <CustomText style={styles.dateLabel}>End Date</CustomText>
                                    <CustomText style={styles.dateValue}>{formatDateDisplay(endDate)}</CustomText>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Collaborator Card */}
                    <View style={styles.card}>
                        <CustomText style={styles.label}>Invite Collaborator</CustomText>
                        <TextInput 
                            style={styles.input} 
                            value={collaboratorEmail} 
                            onChangeText={setCollaboratorEmail} 
                            placeholder="Enter friend's email address" 
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* Additional Details Card */}
                    <View style={styles.card}>
                        <CustomText style={styles.label}>Location</CustomText>
                        <TextInput 
                            style={styles.input} 
                            value={location} 
                            onChangeText={setLocation} 
                            placeholder="Venue address or 'TBD'" 
                        />
                        
                        <CustomText style={[styles.label, {marginTop: 20}]}>Notes (Optional)</CustomText>
                        <TextInput 
                            style={[styles.input, {minHeight: 80}]} 
                            value={description} 
                            onChangeText={setDescription} 
                            placeholder="Additional details..." 
                            multiline
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.submitButton, loading && {opacity: 0.7}]} 
                        onPress={handleCreateEvent} 
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#FFF" /> : <CustomText style={styles.submitButtonText}>Create Event</CustomText>}
                    </TouchableOpacity>
                    
                    <View style={{height: 40}} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* DateTime Pickers */}
            {showStartPicker && <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartChange} />}
            {showEndPicker && <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onEndChange} />}
            {showStartTimePicker && <DateTimePicker value={startTime} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartTimeChange} />}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#F8F9FA'
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
    roundButton: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center', elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1, shadowRadius: 2,
    },
    scrollContainer: { padding: 20 },
    card: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 20,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8,
    },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: {
        fontSize: 15, borderBottomWidth: 1, borderColor: '#E5E7EB',
        paddingVertical: 10, color: '#111827',
    },
    pickerContainer: { backgroundColor: '#F9FAFB', borderRadius: 12, marginTop: 5, overflow: 'hidden' },
    dateTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateSelector: {
        flexDirection: 'row', alignItems: 'center', padding: 12,
        backgroundColor: '#F9FAFB', borderRadius: 16, marginTop: 10,
    },
    iconCircle: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center'
    },
    dateLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
    dateValue: { fontSize: 13, fontWeight: 'bold', color: '#111827' },
    inlineSwitchRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginVertical: 15, paddingHorizontal: 5
    },
    switchText: { fontSize: 14, color: '#4B5563' },
    submitButton: {
        backgroundColor: '#00686F', padding: 18, borderRadius: 16,
        alignItems: 'center', elevation: 4, shadowColor: '#00686F',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    submitButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});