import React, { useState, useRef, useEffect } from 'react';
import {
    View, ScrollView, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, Platform, Switch, KeyboardAvoidingView,
    Animated
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
import tw from 'twrnc';

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

    // --- ANIMATION VALUES ---
    const headerFade = useRef(new Animated.Value(0)).current;
    const headerSlide = useRef(new Animated.Value(-20)).current;
    
    // Create animated values for 5 distinct form sections
    const numSections = 6; 
    const fieldAnims = useRef([...Array(numSections)].map(() => new Animated.Value(40))).current;
    const fieldFades = useRef([...Array(numSections)].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        // 1. Animate Header
        Animated.parallel([
            Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();

        // 2. Stagger Form Sections
        const staggerAnimations = fieldAnims.map((anim, index) => {
            return Animated.parallel([
                Animated.spring(anim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(fieldFades[index], {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                })
            ]);
        });

        Animated.stagger(80, staggerAnimations).start();
    }, []);

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
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`} edges={['top']}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={tw`flex-1`}
            >
                {/* HEADER */}
                <Animated.View 
                    style={[
                        tw`px-6 pt-4 pb-4 flex-row items-center justify-between z-10 bg-[#F8FAFC]`,
                        { opacity: headerFade, transform: [{ translateY: headerSlide }] }
                    ]}
                >
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()}
                        style={tw`w-10 h-10 bg-white rounded-full justify-center items-center border border-slate-200 shadow-sm`}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={22} color="#334155" />
                    </TouchableOpacity>
                    <CustomText fontFamily="extrabold" style={tw`text-xl text-slate-800 tracking-tight`}>
                        New Event
                    </CustomText>
                    <View style={tw`w-10 h-10`} /> 
                </Animated.View>

                <ScrollView contentContainerStyle={tw`px-6 pt-2 pb-24`} showsVerticalScrollIndicator={false}>
                    
                    {/* SECTION 1: Basic Info Card */}
                    <Animated.View style={{ opacity: fieldFades[0], transform: [{ translateY: fieldAnims[0] }] }}>
                        <View style={tw`bg-white p-5 rounded-[24px] mb-5 border border-slate-100 shadow-sm`}>
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-2`}>Event Name *</CustomText>
                            <TextInput 
                                style={[tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-800 mb-5`, { fontFamily: 'Poppins-Medium' }]}
                                value={title} 
                                onChangeText={setTitle} 
                                placeholder="e.g. Maureen's Birthday" 
                                placeholderTextColor="#94A3B8"
                            />
                            
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-2`}>Event Type *</CustomText>
                            <View style={tw`bg-slate-50 border border-slate-200 rounded-xl overflow-hidden`}>
                                <Picker 
                                    selectedValue={eventType} 
                                    onValueChange={(itemValue) => setEventType(itemValue)}
                                    style={Platform.OS === 'android' ? tw`text-slate-800` : {}}
                                >
                                    <Picker.Item label="Select type..." value="" color="#94A3B8" />
                                    {eventTypes.map(t => <Picker.Item key={t} label={t} value={t} color={Platform.OS === 'ios' ? '#1E293B' : 'black'} />)}
                                </Picker>
                            </View>

                            {eventType === 'Others' && (
                                <TextInput 
                                    style={[tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-800 mt-4`, { fontFamily: 'Poppins-Medium' }]}
                                    value={otherType} 
                                    onChangeText={setOtherType} 
                                    placeholder="Specify event type" 
                                    placeholderTextColor="#94A3B8"
                                />
                            )}
                        </View>
                    </Animated.View>

                    {/* SECTION 2: Date & Time Card */}
                    <Animated.View style={{ opacity: fieldFades[1], transform: [{ translateY: fieldAnims[1] }] }}>
                        <View style={tw`bg-white p-5 rounded-[24px] mb-5 border border-slate-100 shadow-sm`}>
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-3`}>Date & Time</CustomText>
                            
                            <View style={tw`flex-row justify-between mb-2`}>
                                <TouchableOpacity 
                                    style={tw`flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 mr-2 flex-row items-center`} 
                                    onPress={() => setShowStartPicker(true)}
                                >
                                    <View style={tw`w-10 h-10 rounded-full bg-white justify-center items-center shadow-sm mr-3`}>
                                        <Ionicons name="calendar" size={18} color="#00686F" />
                                    </View>
                                    <View>
                                        <CustomText fontFamily="semibold" style={tw`text-[10px] text-slate-500`}>START DATE</CustomText>
                                        <CustomText fontFamily="bold" style={tw`text-[13px] text-slate-800 mt-0.5`}>{formatDateDisplay(startDate)}</CustomText>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={tw`flex-1 bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row items-center`} 
                                    onPress={() => setShowStartTimePicker(true)}
                                >
                                    <View style={tw`w-10 h-10 rounded-full bg-white justify-center items-center shadow-sm mr-3`}>
                                        <Ionicons name="time" size={18} color="#00686F" />
                                    </View>
                                    <View>
                                        <CustomText fontFamily="semibold" style={tw`text-[10px] text-slate-500`}>TIME</CustomText>
                                        <CustomText fontFamily="bold" style={tw`text-[13px] text-slate-800 mt-0.5`}>{formatTimeDisplay(startTime)}</CustomText>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View style={tw`flex-row justify-between items-center py-3 px-1 border-b border-slate-100 mb-2`}>
                                <CustomText fontFamily="medium" style={tw`text-[14px] text-slate-600`}>This is a multi-day event</CustomText>
                                <Switch 
                                    value={isMultiDay} 
                                    onValueChange={setIsMultiDay} 
                                    trackColor={{ false: "#E2E8F0", true: "#00686F" }} 
                                    ios_backgroundColor="#E2E8F0"
                                />
                            </View>

                            {isMultiDay && (
                                <TouchableOpacity 
                                    style={tw`w-full bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row items-center mt-2`} 
                                    onPress={() => setShowEndPicker(true)}
                                >
                                    <View style={tw`w-10 h-10 rounded-full bg-white justify-center items-center shadow-sm mr-3`}>
                                        <Ionicons name="calendar-outline" size={18} color="#00686F" />
                                    </View>
                                    <View>
                                        <CustomText fontFamily="semibold" style={tw`text-[10px] text-slate-500`}>END DATE</CustomText>
                                        <CustomText fontFamily="bold" style={tw`text-[13px] text-slate-800 mt-0.5`}>{formatDateDisplay(endDate)}</CustomText>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>

                    {/* SECTION 3: Collaborator Card */}
                    <Animated.View style={{ opacity: fieldFades[2], transform: [{ translateY: fieldAnims[2] }] }}>
                        <View style={tw`bg-white p-5 rounded-[24px] mb-5 border border-slate-100 shadow-sm`}>
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-2`}>Invite Collaborator</CustomText>
                            <TextInput 
                                style={[tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-800`, { fontFamily: 'Poppins-Medium' }]}
                                value={collaboratorEmail} 
                                onChangeText={setCollaboratorEmail} 
                                placeholder="Enter friend's email address" 
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    </Animated.View>

                    {/* SECTION 4: Additional Details Card */}
                    <Animated.View style={{ opacity: fieldFades[3], transform: [{ translateY: fieldAnims[3] }] }}>
                        <View style={tw`bg-white p-5 rounded-[24px] mb-8 border border-slate-100 shadow-sm`}>
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-2`}>Location</CustomText>
                            <TextInput 
                                style={[tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-800 mb-5`, { fontFamily: 'Poppins-Medium' }]}
                                value={location} 
                                onChangeText={setLocation} 
                                placeholder="Venue address or 'TBD'" 
                                placeholderTextColor="#94A3B8"
                            />
                            
                            <CustomText fontFamily="bold" style={tw`text-slate-400 text-[11px] uppercase tracking-wider mb-2`}>Notes (Optional)</CustomText>
                            <TextInput 
                                style={[tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-[15px] text-slate-800 min-h-[100px]`, { fontFamily: 'Poppins-Medium', textAlignVertical: 'top' }]}
                                value={description} 
                                onChangeText={setDescription} 
                                placeholder="Additional details..." 
                                placeholderTextColor="#94A3B8"
                                multiline
                            />
                        </View>
                    </Animated.View>

                    {/* SECTION 5: Submit Button */}
                    <Animated.View style={{ opacity: fieldFades[4], transform: [{ translateY: fieldAnims[4] }] }}>
                        <TouchableOpacity 
                            style={[
                                tw`bg-[#00686F] py-4 rounded-[20px] items-center flex-row justify-center`,
                                loading && {opacity: 0.7},
                                { shadowColor: '#00686F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }
                            ]} 
                            onPress={handleCreateEvent} 
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" /> 
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={22} color="#FFF" style={tw`mr-2`} />
                                    <CustomText fontFamily="bold" style={tw`text-white text-[16px] tracking-wide`}>Create Event</CustomText>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                    
                </ScrollView>
            </KeyboardAvoidingView>

            {/* DateTime Pickers */}
            {showStartPicker && <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartChange} />}
            {showEndPicker && <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onEndChange} />}
            {showStartTimePicker && <DateTimePicker value={startTime} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onStartTimeChange} />}
        </SafeAreaView>
    );
}