import React, { useState } from 'react';
import { 
    View, StyleSheet, ScrollView, TouchableOpacity, 
    TextInput, Switch, ActivityIndicator, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import CustomText from '../components/CustomText';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function UpdateEvent({ route, navigation }) {
    const { eventId, eventData } = route.params;

    // --- FIXED PARSE TIME FUNCTION ---
    const parseTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return new Date();
        try {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            let date = new Date();
            let h = parseInt(hours, 10);
            let m = parseInt(minutes, 10);

            if (modifier === 'PM' && h < 12) h += 12;
            if (modifier === 'AM' && h === 12) h = 0;

            date.setHours(h);
            date.setMinutes(m);
            date.setSeconds(0);
            return date;
        } catch (error) {
            console.error("Error parsing time:", error);
            return new Date();
        }
    };

    // --- STATE ---
    const [title, setTitle] = useState(eventData?.title || '');
    const [description, setDescription] = useState(eventData?.description || '');
    const [location, setLocation] = useState(eventData?.location || '');
    const [eventType, setEventType] = useState(eventData?.eventType || '');
    const [isMultiDay, setIsMultiDay] = useState(eventData?.isMultiDay || false);
    
    const [startDate, setStartDate] = useState(
        eventData?.startDate?.seconds ? new Date(eventData.startDate.seconds * 1000) : new Date()
    );
    const [endDate, setEndDate] = useState(
        eventData?.endDate?.seconds ? new Date(eventData.endDate.seconds * 1000) : new Date()
    );

    const [startTime, setStartTime] = useState(parseTime(eventData?.startTime));
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const formatTimeDisplay = (time) => {
        return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const onDateChange = (event, selectedDate, isStart) => {
        if (Platform.OS === 'android') {
            setShowStartPicker(false);
            setShowEndPicker(false);
        }
        if (selectedDate) {
            if (isStart) setStartDate(selectedDate);
            else setEndDate(selectedDate);
        }
    };

    const onStartTimeChange = (event, selectedTime) => {
        if (Platform.OS === 'android') setShowStartTimePicker(false);
        if (selectedTime) setStartTime(selectedTime);
    };

    const handleUpdate = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            const docRef = doc(db, 'events', eventId);
            const updatedFields = {
                title: title.trim(),
                description: description.trim(),
                location: location.trim(),
                eventType: eventType.trim(),
                isMultiDay: isMultiDay,
                startDate: Timestamp.fromDate(startDate),
                startTime: formatTimeDisplay(startTime),
                endDate: isMultiDay ? Timestamp.fromDate(endDate) : null,
                updatedAt: Timestamp.now(),
            };
            await updateDoc(docRef, updatedFields);
            setShowSuccess(true); 
        } catch (error) {
            console.error("Firebase Update Error:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Success Modal - Uses View instead of div to prevent crash */}
            <Modal transparent visible={showSuccess} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.successBox}>
                        <View style={styles.successIconCircle}>
                            <Ionicons name="checkmark-circle" size={50} color="#00686F" />
                        </View>
                        <CustomText style={styles.successTitle}>Updated!</CustomText>
                        <CustomText style={styles.successSub}>Your event changes have been synced successfully.</CustomText>
                        <TouchableOpacity 
                            style={styles.successBtn} 
                            onPress={() => {
                                setShowSuccess(false);
                                navigation.goBack();
                            }}
                        >
                            <CustomText style={styles.successBtnText}>Continue</CustomText>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={28} color="#1E293B" />
                </TouchableOpacity>
                <CustomText style={styles.headerTitle}>Edit Event</CustomText>
                <TouchableOpacity onPress={handleUpdate} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#00686F" /> : <CustomText style={styles.saveBtn}>Save</CustomText>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
                <CustomText style={styles.label}>EVENT TITLE</CustomText>
                <TextInput 
                    style={styles.input} 
                    value={title} 
                    onChangeText={setTitle} 
                    placeholder="Enter event name" 
                    placeholderTextColor="#94A3B8"
                />

                <CustomText style={styles.label}>EVENT TYPE</CustomText>
                <TextInput 
                    style={styles.input} 
                    value={eventType} 
                    onChangeText={setEventType} 
                    placeholder="e.g. Wedding, Business" 
                    placeholderTextColor="#94A3B8"
                />

                <CustomText style={styles.label}>LOCATION</CustomText>
                <View style={styles.inputContainer}>
                    <Ionicons name="location-outline" size={20} color="#64748B" style={{marginRight: 8}} />
                    <TextInput 
                        style={[styles.input, { flex: 1, borderBottomWidth: 0, marginBottom: 0 }]} 
                        value={location} 
                        onChangeText={setLocation} 
                        placeholder="Location" 
                        placeholderTextColor="#94A3B8"
                    />
                </View>

                <View style={styles.switchRow}>
                    <View>
                        <CustomText style={styles.switchLabel}>Multi-day Event</CustomText>
                        <CustomText style={styles.switchSub}>Does this span multiple dates?</CustomText>
                    </View>
                    <Switch 
                        value={isMultiDay} 
                        onValueChange={setIsMultiDay} 
                        trackColor={{ false: "#CBD5E1", true: "#00686F" }} 
                    />
                </View>

                {/* Date & Time Row - Styled like AddEvent */}
                <View style={styles.dateTimeContainer}>
                    <View style={styles.dateRow}>
                        <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowStartPicker(true)}>
                            <CustomText style={styles.label}>START DATE</CustomText>
                            <View style={styles.pickerValueBox}>
                                <Ionicons name="calendar-outline" size={18} color="#00686F" style={{marginRight: 8}} />
                                <CustomText style={styles.dateValue}>{startDate.toLocaleDateString()}</CustomText>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.datePickerBtn, { marginLeft: 15 }]} onPress={() => setShowStartTimePicker(true)}>
                            <CustomText style={styles.label}>START TIME</CustomText>
                            <View style={styles.pickerValueBox}>
                                <Ionicons name="time-outline" size={18} color="#00686F" style={{marginRight: 8}} />
                                <CustomText style={styles.dateValue}>{formatTimeDisplay(startTime)}</CustomText>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {isMultiDay && (
                        <TouchableOpacity style={[styles.datePickerBtn, { marginTop: 20 }]} onPress={() => setShowEndPicker(true)}>
                            <CustomText style={styles.label}>END DATE</CustomText>
                            <View style={styles.pickerValueBox}>
                                <Ionicons name="calendar-outline" size={18} color="#00686F" style={{marginRight: 8}} />
                                <CustomText style={styles.dateValue}>{endDate.toLocaleDateString()}</CustomText>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {showStartPicker && (
                    <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(e, d) => onDateChange(e, d, true)} />
                )}

                {showEndPicker && (
                    <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(e, d) => onDateChange(e, d, false)} />
                )}

                {showStartTimePicker && (
                    <DateTimePicker value={startTime} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartTimeChange} />
                )}

                <CustomText style={[styles.label, { marginTop: 20 }]}>DESCRIPTION</CustomText>
                <TextInput 
                    style={[styles.input, styles.textArea]} 
                    value={description} 
                    onChangeText={setDescription} 
                    multiline 
                    placeholder="Enter event details..." 
                    placeholderTextColor="#94A3B8"
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingVertical: 15, 
        borderBottomWidth: 1, 
        borderBottomColor: '#F1F5F9' 
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    backBtn: { padding: 4 },
    saveBtn: { color: '#00686F', fontWeight: '800', fontSize: 16 },
    form: { padding: 20 },
    label: { fontSize: 11, fontWeight: '900', color: '#94A3B8', marginBottom: 10, letterSpacing: 1 },
    input: { 
        fontSize: 16, 
        color: '#1E293B', 
        borderBottomWidth: 1, 
        borderBottomColor: '#E2E8F0', 
        paddingVertical: 12, 
        marginBottom: 25 
    },
    inputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        borderBottomColor: '#E2E8F0', 
        marginBottom: 25 
    },
    textArea: { height: 120, textAlignVertical: 'top' },
    switchRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 30, 
        backgroundColor: '#F8FAFC', 
        padding: 15, 
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    switchLabel: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    switchSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    dateTimeContainer: { marginBottom: 10 },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
    datePickerBtn: { flex: 1 },
    pickerValueBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        padding: 12,
        borderRadius: 12,
    },
    dateValue: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    successBox: { 
        width: '85%', 
        backgroundColor: '#FFF', 
        borderRadius: 30, 
        padding: 30, 
        alignItems: 'center', 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 20,
        elevation: 5
    },
    successIconCircle: { 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: '#F0F9FA', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: 20 
    },
    successTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
    successSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 },
    successBtn: { backgroundColor: '#00686F', paddingVertical: 16, borderRadius: 16, width: '100%', alignItems: 'center' },
    successBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});