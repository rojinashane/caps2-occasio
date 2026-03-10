import React, { useState, useRef, useEffect } from 'react';
import {
    View, ScrollView, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, Platform, Switch,
    KeyboardAvoidingView, Animated, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import {
    collection, addDoc, serverTimestamp,
    query, where, getDocs,
} from 'firebase/firestore';
import tw from 'twrnc';
import NotificationService from '../services/NotificationService'; // <-- Import the new service
import VenuePicker from '../components/Venuepicker';

const { width } = Dimensions.get('window');

// ── EVENT TYPE CONFIG ───────────────────────────────────────
const EVENT_TYPES = [
    { key: 'Wedding', icon: 'heart', color: '#E8626A', bg: '#FFF0F0', desc: 'Celebrate love' },
    { key: 'Birthday Party', icon: 'gift-outline', color: '#F59E0B', bg: '#FFFBEB', desc: 'Make a wish' },
    { key: 'Corporate', icon: 'briefcase-outline', color: '#3B82F6', bg: '#EFF6FF', desc: 'Business & networking' },
    { key: 'Charity', icon: 'ribbon-outline', color: '#10B981', bg: '#ECFDF5', desc: 'Give & inspire' },
    { key: 'Others', icon: 'star-outline', color: '#f65cb3', bg: '#F5F3FF', desc: 'Something special' },
];

// ── THEMES ──────────────────────────────────────────────────
const THEMES = [
    { id: 'fairy-tale', name: 'Fairy Tale', icon: 'sparkles-outline', color: '#C084FC', tags: ['Birthday Party'] },
    { id: 'golden-gala', name: 'Golden Gala', icon: 'trophy-outline', color: '#D97706', tags: ['Wedding', 'Corporate'] },
    { id: 'garden-bloom', name: 'Garden Bloom', icon: 'leaf-outline', color: '#10B981', tags: ['Wedding'] },
    { id: 'midnight-luxe', name: 'Midnight Luxe', icon: 'moon-outline', color: '#6366F1', tags: [] },
    { id: 'tropical-fest', name: 'Tropical Fest', icon: 'sunny-outline', color: '#F97316', tags: ['Birthday Party'] },
    { id: 'corporate-edge', name: 'Corporate Edge', icon: 'business-outline', color: '#2563EB', tags: ['Corporate'] },
    { id: 'rustic-charm', name: 'Rustic Charm', icon: 'bonfire-outline', color: '#B45309', tags: ['Wedding'] },
    { id: 'neon-fiesta', name: 'Neon Fiesta', icon: 'musical-notes-outline', color: '#EC4899', tags: ['Birthday Party'] },
    { id: 'ocean-breeze', name: 'Ocean Breeze', icon: 'water-outline', color: '#0EA5E9', tags: [] },
    { id: 'giving-heart', name: 'Giving Heart', icon: 'heart-circle-outline', color: '#EF4444', tags: ['Charity'] },
];

// ── HELPERS ─────────────────────────────────────────────────
const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ── SCREEN ──────────────────────────────────────────────────
export default function AddEventScreen({ navigation }) {
    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState(null);
    const [otherType, setOtherType] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date());
    const [isMultiDay, setIsMultiDay] = useState(false);
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [collaboratorEmail, setCollaboratorEmail] = useState('');
    const [selectedTheme, setSelectedTheme] = useState(null);
    const [customTheme, setCustomTheme] = useState('');
    const [venuePickerVisible, setVenuePickerVisible] = useState(false);
    const [selectedVenueId, setSelectedVenueId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Scroll-wheel picker state
    const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + i);
    const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
    const [pickerDay,   setPickerDay]   = useState(new Date().getDate() - 1);
    const [pickerYear,  setPickerYear]  = useState(0);
    const [pickerHour,  setPickerHour]  = useState(new Date().getHours());
    const [pickerMinute, setPickerMinute] = useState(0);
    // which date field is the date picker targeting: 'start' | 'end'
    const [datePickerTarget, setDatePickerTarget] = useState('start');

    // Animations
    const heroScale = useRef(new Animated.Value(0.96)).current;
    const cardAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(40))).current;
    const cardFades = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(heroScale, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
            Animated.stagger(90, cardAnims.map((anim, i) =>
                Animated.parallel([
                    Animated.spring(anim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
                    Animated.timing(cardFades[i], { toValue: 1, duration: 350, useNativeDriver: true }),
                ])
            )),
        ]).start();
    }, []);

    const handleSelectType = (type) => {
        setEventType(type);
        if (selectedTheme && !selectedTheme.tags.includes(type.key) && selectedTheme.tags.length > 0) {
            setSelectedTheme(null);
        }
    };

    const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleCreate = async () => {
        setSubmitted(true);
        const finalType = eventType?.key === 'Others' ? otherType.trim() : eventType?.key;
        const emailInvalid = collaboratorEmail.trim() && !isEmailValid(collaboratorEmail.trim());

        if (!title.trim() || !finalType || emailInvalid) return;

        setLoading(true);
        try {
            const themeValue = customTheme.trim() || selectedTheme?.name || null;

            const eventRef = await addDoc(collection(db, 'events'), {
                userId: auth.currentUser.uid,
                title: title.trim(),
                eventType: finalType,
                startDate,
                startTime: fmtTime(startTime),
                endDate: isMultiDay ? endDate : null,
                isMultiDay,
                location: location.trim() || 'To be decided',
                venueId: selectedVenueId || null,
                description: description.trim(),
                theme: themeValue,
                themeAccent: selectedTheme?.color || null,
                collaborators: [],
                createdAt: serverTimestamp(),
            });

            if (collaboratorEmail.trim()) {
                const email = collaboratorEmail.trim().toLowerCase();
                const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
                if (!snap.empty) {
                    await addDoc(collection(db, 'notifications'), {
                        recipientId: snap.docs[0].id,
                        senderId: auth.currentUser.uid,
                        senderName: auth.currentUser.displayName || 'An organizer',
                        eventId: eventRef.id,
                        eventTitle: title.trim(),
                        status: 'pending',
                        type: 'invitation',
                        createdAt: serverTimestamp(),
                    });
                }
            }

            // ── SCHEDULE DEVICE REMINDER ──────────────────────────────
            try {
                const reminderDate = new Date(startDate);
                // Set the reminder time exactly 1 hour before the start time
                reminderDate.setHours(startTime.getHours() - 1);
                reminderDate.setMinutes(startTime.getMinutes());

                // Only schedule if the calculated reminder time is in the future
                if (reminderDate > new Date()) {
                    await NotificationService.scheduleEventReminder(
                        'Upcoming Event!',
                        `Your event "${title.trim()}" is starting in 1 hour.`,
                        reminderDate
                    );
                }
            } catch (notifError) {
                console.warn('Failed to schedule local reminder:', notifError);
            }
            // ──────────────────────────────────────────────────────────

            Alert.alert('Event Created!', `"${title.trim()}" is all set.`, [
                { text: 'Great!', onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not save event. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const openDatePicker = (target, date) => {
        const base = date || new Date();
        setPickerMonth(base.getMonth());
        setPickerDay(base.getDate() - 1);
        setPickerYear(YEAR_OPTIONS.indexOf(base.getFullYear()) !== -1 ? YEAR_OPTIONS.indexOf(base.getFullYear()) : 0);
        setDatePickerTarget(target);
        setShowStartPicker(true);
    };

    const confirmDate = () => {
        const daysInMonth = new Date(YEAR_OPTIONS[pickerYear], pickerMonth + 1, 0).getDate();
        const day = Math.min(pickerDay, daysInMonth - 1) + 1;
        const picked = new Date(YEAR_OPTIONS[pickerYear], pickerMonth, day);
        if (datePickerTarget === 'start') {
            setStartDate(picked);
            if (picked > endDate) setEndDate(picked);
        } else {
            setEndDate(picked);
        }
        setShowStartPicker(false);
    };

    const openTimePicker = () => {
        setPickerHour(startTime.getHours());
        setPickerMinute(startTime.getMinutes());
        setShowTimePicker(true);
    };

    const confirmTime = () => {
        const t = new Date();
        t.setHours(pickerHour, pickerMinute, 0, 0);
        setStartTime(t);
        setShowTimePicker(false);
    };

    const accentColor = '#00686F';
    const accentBg = '#E0F2F3';
    const accentIcon = eventType?.icon || 'calendar-outline';

    const suggestedThemes = THEMES.filter(t => t.tags.includes(eventType?.key));
    const remainingThemes = THEMES.filter(t => !t.tags.includes(eventType?.key));

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F0F4F8]`} edges={['top']}>
            {/* The rest of your AddEventScreen UI remains exactly the same */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={tw`flex-1`}>
                <Animated.View style={{
                    transform: [{ scale: heroScale }],
                    marginHorizontal: 16,
                    marginTop: 12,
                    marginBottom: 4,
                    borderRadius: 28,
                    overflow: 'hidden',
                    backgroundColor: accentBg,
                    borderWidth: 1.5,
                    borderColor: accentColor + '30',
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.18,
                    shadowRadius: 20,
                    elevation: 6,
                }}>
                    <View style={{ height: 5, backgroundColor: accentColor }} />
                    <View style={tw`px-5 py-4`}>
                        <View style={tw`flex-row items-center justify-between mb-4`}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[
                                    tw`w-9 h-9 rounded-full justify-center items-center`,
                                    { backgroundColor: accentColor + '20' },
                                ]}
                            >
                                <Ionicons name="arrow-back" size={18} color={accentColor} />
                            </TouchableOpacity>
                            <CustomText fontFamily="extrabold" style={{ color: accentColor, fontSize: 16, letterSpacing: 0.3 }}>
                                Plan Your Event
                            </CustomText>
                            <View style={[
                                tw`w-9 h-9 rounded-full justify-center items-center`,
                                { backgroundColor: '#00686F20' },
                            ]}>
                                <Ionicons name={accentIcon} size={17} color="#00686F" />
                            </View>
                        </View>
                        <CustomText fontFamily="bold" style={{ color: accentColor + 'AA', fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                            EVENT NAME <CustomText style={{ color: '#EF4444' }}>*</CustomText>
                        </CustomText>
                        <TextInput
                            style={{
                                fontFamily: 'Poppins-ExtraBold',
                                fontSize: 24,
                                color: accentColor,
                                padding: 0,
                                letterSpacing: -0.5,
                                borderBottomWidth: submitted && !title.trim() ? 1.5 : 0,
                                borderBottomColor: '#EF4444',
                                paddingBottom: submitted && !title.trim() ? 4 : 0,
                            }}
                            value={title}
                            onChangeText={(v) => { setTitle(v); if (submitted && v.trim()) setSubmitted(false); }}
                            placeholder={eventType ? `Name your ${eventType.key.toLowerCase()}...` : 'What are we celebrating?'}
                            placeholderTextColor={accentColor + '45'}
                            multiline
                            returnKeyType="done"
                            blurOnSubmit
                        />
                        {submitted && !title.trim() && (
                            <InlineError message="Event name is required" />
                        )}

                        {(eventType || selectedTheme || (customTheme.trim())) && (
                            <View style={tw`flex-row items-center flex-wrap mt-3`}>
                                {eventType && (
                                    <View style={[
                                        tw`flex-row items-center px-3 py-1 rounded-full mr-2 mb-1`,
                                        { backgroundColor: accentColor + '20' },
                                    ]}>
                                        <Ionicons name={eventType.icon} size={11} color={accentColor} />
                                        <CustomText fontFamily="semibold" style={{ color: accentColor, fontSize: 11, marginLeft: 4 }}>
                                            {eventType.key === 'Others' && otherType ? otherType : eventType.key}
                                        </CustomText>
                                    </View>
                                )}
                                <View style={[
                                    tw`flex-row items-center px-3 py-1 rounded-full mr-2 mb-1`,
                                    { backgroundColor: accentColor + '20' },
                                ]}>
                                    <Ionicons name="calendar-outline" size={11} color={accentColor} />
                                    <CustomText fontFamily="semibold" style={{ color: accentColor, fontSize: 11, marginLeft: 4 }}>
                                        {fmt(startDate)}
                                    </CustomText>
                                </View>
                                {(selectedTheme || customTheme.trim()) && (
                                    <View style={[
                                        tw`flex-row items-center px-3 py-1 rounded-full mb-1`,
                                        { backgroundColor: accentColor + '20' },
                                    ]}>
                                        <Ionicons
                                            name={selectedTheme?.icon || 'color-palette-outline'}
                                            size={11}
                                            color={accentColor}
                                        />
                                        <CustomText fontFamily="semibold" style={{ color: accentColor, fontSize: 11, marginLeft: 4 }}>
                                            {customTheme.trim() || selectedTheme?.name}
                                        </CustomText>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </Animated.View>

                {/* ── SCROLLABLE FORM ──────────────────────────── */}
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
                    keyboardShouldPersistTaps="handled"
                >

                    {/* ══ SECTION 1: EVENT TYPE ════════════════════ */}
                    <FormCard anim={cardAnims[0]} fade={cardFades[0]} error={submitted && !eventType}>
                        <SectionHeader icon="apps-outline" label="Event Type" color={accentColor} required />

                        <View style={tw`flex-row flex-wrap mt-1`}>
                            {EVENT_TYPES.map((type) => {
                                const active = eventType?.key === type.key;
                                const tileColor = active ? type.color : '#64748B';
                                const tileBorder = active ? type.color : '#E8EEF4';
                                const tileBg = active ? type.color + '12' : '#F8FAFC';
                                const iconBg = active ? type.color + '25' : '#E8EEF4';
                                const iconColor = active ? type.color : '#94A3B8';
                                return (
                                    <TouchableOpacity
                                        key={type.key}
                                        onPress={() => handleSelectType(type)}
                                        activeOpacity={0.75}
                                        style={[
                                            tw`mr-2 mb-2 rounded-[16px]`,
                                            {
                                                borderWidth: 2,
                                                borderColor: tileBorder,
                                                backgroundColor: tileBg,
                                            },
                                        ]}
                                    >
                                        <View style={tw`flex-row items-center px-4 py-2.5`}>
                                            <View style={[
                                                tw`w-7 h-7 rounded-full justify-center items-center mr-2.5`,
                                                { backgroundColor: iconBg },
                                            ]}>
                                                <Ionicons name={type.icon} size={14} color={iconColor} />
                                            </View>
                                            <View>
                                                <CustomText fontFamily={active ? 'bold' : 'semibold'} style={{ fontSize: 13, color: tileColor }}>
                                                    {type.key}
                                                </CustomText>
                                                <CustomText fontFamily="medium" style={{ fontSize: 10, color: active ? type.color + 'AA' : '#94A3B8' }}>
                                                    {type.desc}
                                                </CustomText>
                                            </View>
                                            {active && (
                                                <Ionicons name="checkmark-circle" size={16} color={type.color} style={{ marginLeft: 8 }} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {eventType?.key === 'Others' && (
                            <>
                                <View style={[
                                    tw`flex-row items-center mt-2 px-4 rounded-[14px]`,
                                    {
                                        backgroundColor: '#F8FAFC',
                                        borderWidth: 1.5,
                                        borderColor: submitted && !otherType.trim() ? '#EF4444' : '#E2E8F0',
                                    },
                                ]}>
                                    <Ionicons name="pencil-outline" size={16} color={submitted && !otherType.trim() ? '#EF4444' : '#94A3B8'} />
                                    <TextInput
                                        style={[tw`flex-1 ml-3 py-3.5 text-[14px] text-slate-800`, { fontFamily: 'Poppins-Medium' }]}
                                        value={otherType}
                                        onChangeText={setOtherType}
                                        placeholder="Describe your event type"
                                        placeholderTextColor="#CBD5E1"
                                    />
                                </View>
                                {submitted && !otherType.trim() && (
                                    <InlineError message="Please describe your event type" />
                                )}
                            </>
                        )}
                        {submitted && !eventType && (
                            <InlineError message="Please select an event type" />
                        )}
                    </FormCard>

                    {/* ══ SECTION 2: DATE & TIME ═══════════════════ */}
                    <FormCard anim={cardAnims[1]} fade={cardFades[1]}>
                        <SectionHeader icon="calendar-outline" label="Date & Time" color={accentColor} />

                        <View style={tw`flex-row mb-3`}>
                            <DateTimeButton
                                label="START DATE"
                                value={fmt(startDate)}
                                icon="calendar"
                                color={accentColor}
                                onPress={() => openDatePicker('start', startDate)}
                            />
                            <View style={tw`w-3`} />
                            <DateTimeButton
                                label="TIME"
                                value={fmtTime(startTime)}
                                icon="time"
                                color={accentColor}
                                onPress={openTimePicker}
                            />
                        </View>

                        <View style={[
                            tw`flex-row items-center justify-between px-4 py-3 rounded-[14px]`,
                            {
                                backgroundColor: isMultiDay ? accentColor + '10' : '#F8FAFC',
                                borderWidth: 1.5,
                                borderColor: isMultiDay ? accentColor + '40' : '#E8EEF4',
                            },
                        ]}>
                            <View style={tw`flex-row items-center`}>
                                <View style={[
                                    tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                    { backgroundColor: isMultiDay ? accentColor + '20' : '#E8EEF4' },
                                ]}>
                                    <Ionicons name="git-branch-outline" size={15} color={isMultiDay ? accentColor : '#94A3B8'} />
                                </View>
                                <View>
                                    <CustomText fontFamily="bold" style={{ fontSize: 13, color: isMultiDay ? accentColor : '#334155' }}>
                                        Multi-day Event
                                    </CustomText>
                                    <CustomText fontFamily="medium" style={{ fontSize: 11, color: '#94A3B8' }}>
                                        Spans multiple days
                                    </CustomText>
                                </View>
                            </View>
                            <Switch
                                value={isMultiDay}
                                onValueChange={setIsMultiDay}
                                trackColor={{ false: '#E2E8F0', true: accentColor }}
                                ios_backgroundColor="#E2E8F0"
                            />
                        </View>

                        {isMultiDay && (
                            <TouchableOpacity
                                onPress={() => openDatePicker('end', endDate)}
                                activeOpacity={0.75}
                                style={[
                                    tw`flex-row items-center mt-3 px-4 py-3 rounded-[14px]`,
                                    {
                                        backgroundColor: accentColor + '10',
                                        borderWidth: 1.5,
                                        borderColor: accentColor + '30',
                                        borderStyle: 'dashed',
                                    },
                                ]}
                            >
                                <View style={[
                                    tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                    { backgroundColor: accentColor + '20' },
                                ]}>
                                    <Ionicons name="arrow-forward-circle-outline" size={16} color={accentColor} />
                                </View>
                                <View style={tw`flex-1`}>
                                    <CustomText fontFamily="semibold" style={{ fontSize: 10, color: accentColor + 'AA', letterSpacing: 0.8 }}>END DATE</CustomText>
                                    <CustomText fontFamily="bold" style={{ fontSize: 14, color: accentColor }}>
                                        {fmt(endDate)}
                                    </CustomText>
                                </View>
                                <Ionicons name="pencil-outline" size={15} color={accentColor} />
                            </TouchableOpacity>
                        )}
                    </FormCard>

                    {/* ══ SECTION 3: THEME ═════════════════════════ */}
                    <FormCard anim={cardAnims[2]} fade={cardFades[2]}>
                        <SectionHeader icon="color-palette-outline" label="Event Theme" color={accentColor} />
                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12, marginBottom: 14, marginTop: -8 }}>
                            Choose a vibe that sets the mood
                        </CustomText>

                        {suggestedThemes.length > 0 && (
                            <View style={tw`mb-3`}>
                                <View style={tw`flex-row items-center mb-2`}>
                                    <Ionicons name="star" size={11} color={accentColor} />
                                    <CustomText fontFamily="bold" style={{ color: accentColor, fontSize: 10, letterSpacing: 0.8, marginLeft: 5 }}>
                                        SUGGESTED
                                    </CustomText>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={tw`flex-row`}>
                                        {suggestedThemes.map(theme => (
                                            <ThemePill
                                                key={theme.id}
                                                theme={theme}
                                                isSelected={selectedTheme?.id === theme.id}
                                                onPress={() => setSelectedTheme(selectedTheme?.id === theme.id ? null : theme)}
                                            />
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        {suggestedThemes.length > 0 && (
                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 }} />
                        )}

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={tw`flex-row`}>
                                {(suggestedThemes.length > 0 ? remainingThemes : THEMES).map(theme => (
                                    <ThemePill
                                        key={theme.id}
                                        theme={theme}
                                        isSelected={selectedTheme?.id === theme.id}
                                        onPress={() => setSelectedTheme(selectedTheme?.id === theme.id ? null : theme)}
                                    />
                                ))}
                            </View>
                        </ScrollView>

                        <View style={[
                            tw`flex-row items-center mt-4 px-4 rounded-[14px]`,
                            {
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1.5,
                                borderColor: customTheme ? accentColor + '60' : '#E2E8F0',
                                borderStyle: 'dashed',
                            },
                        ]}>
                            <Ionicons name="brush-outline" size={16} color={customTheme ? accentColor : '#CBD5E1'} />
                            <TextInput
                                style={[tw`flex-1 ml-3 py-3 text-[14px] text-slate-800`, { fontFamily: 'Poppins-Medium' }]}
                                value={customTheme}
                                onChangeText={(v) => { setCustomTheme(v); if (v) setSelectedTheme(null); }}
                                placeholder="Or type your own theme..."
                                placeholderTextColor="#CBD5E1"
                            />
                            {customTheme.length > 0 && (
                                <TouchableOpacity onPress={() => setCustomTheme('')}>
                                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </FormCard>

                    {/* ══ SECTION 4: VENUE ═════════════════════════ */}
                    <FormCard anim={cardAnims[3]} fade={cardFades[3]}>
                        <SectionHeader icon="location-outline" label="Venue" color={accentColor} />
                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12, marginBottom: 14, marginTop: -8 }}>
                            Where is this happening? (optional)
                        </CustomText>

                        {/* Venue display / trigger button */}
                        <TouchableOpacity
                            onPress={() => setVenuePickerVisible(true)}
                            activeOpacity={0.78}
                            style={[
                                tw`flex-row items-center px-4 rounded-[14px]`,
                                {
                                    backgroundColor: location.trim() ? accentColor + '08' : '#F8FAFC',
                                    borderWidth: 1.5,
                                    borderColor: location.trim() ? accentColor + '50' : '#E8EEF4',
                                    minHeight: 52,
                                },
                            ]}
                        >
                            <View style={[
                                tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                { backgroundColor: location.trim() ? accentColor + '20' : accentColor + '15' },
                            ]}>
                                <Ionicons
                                    name={location.trim() ? 'location' : 'location-outline'}
                                    size={16}
                                    color={accentColor}
                                />
                            </View>
                            <CustomText
                                fontFamily={location.trim() ? 'semibold' : 'medium'}
                                style={{
                                    flex: 1,
                                    fontSize: 14,
                                    color: location.trim() ? '#0F172A' : '#CBD5E1',
                                    paddingVertical: 14,
                                }}
                                numberOfLines={1}
                            >
                                {location.trim() || 'Tap to choose a venue...'}
                            </CustomText>
                            {location.trim() ? (
                                <TouchableOpacity
                                    onPress={() => { setLocation(''); setSelectedVenueId(null); }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            ) : (
                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            )}
                        </TouchableOpacity>

                        {/* Pinned from DB badge */}
                        {selectedVenueId && (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                marginTop: 8, paddingHorizontal: 10, paddingVertical: 6,
                                backgroundColor: accentColor + '10',
                                borderRadius: 10, borderWidth: 1, borderColor: accentColor + '25',
                            }}>
                                <Ionicons name="cube-outline" size={12} color={accentColor} />
                                <CustomText fontFamily="semibold" style={{ color: accentColor, fontSize: 11, marginLeft: 5 }}>
                                    Pinned from Occasio venues
                                </CustomText>
                            </View>
                        )}
                    </FormCard>

                    {/* Venue Picker Modal */}
                    <VenuePicker
                        visible={venuePickerVisible}
                        onClose={() => setVenuePickerVisible(false)}
                        onSelect={({ name, venueId }) => {
                            setLocation(name);
                            setSelectedVenueId(venueId);
                        }}
                        currentValue={location}
                    />

                    {/* ══ SECTION 5: INVITE COLLABORATOR ══════════ */}
                    <FormCard anim={cardAnims[4]} fade={cardFades[4]}>
                        <SectionHeader icon="people-outline" label="Invite Collaborator" color={accentColor} />
                        <CustomText fontFamily="medium" style={{ color: '#94A3B8', fontSize: 12, marginBottom: 14, marginTop: -8 }}>
                            Co-manage this event with someone
                        </CustomText>

                        <View style={[
                            tw`flex-row items-center px-4 rounded-[14px]`,
                            {
                                backgroundColor: '#F8FAFC',
                                borderWidth: 1.5,
                                borderColor: submitted && collaboratorEmail.trim() && !isEmailValid(collaboratorEmail.trim())
                                    ? '#EF4444' : '#E8EEF4',
                            },
                        ]}>
                            <View style={[
                                tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                {
                                    backgroundColor: submitted && collaboratorEmail.trim() && !isEmailValid(collaboratorEmail.trim())
                                        ? '#FEF2F2' : accentColor + '15',
                                },
                            ]}>
                                <Ionicons
                                    name="person-add-outline"
                                    size={16}
                                    color={submitted && collaboratorEmail.trim() && !isEmailValid(collaboratorEmail.trim())
                                        ? '#EF4444' : accentColor}
                                />
                            </View>
                            <TextInput
                                style={[tw`flex-1 py-3.5 text-[14px] text-slate-800`, { fontFamily: 'Poppins-Medium' }]}
                                value={collaboratorEmail}
                                onChangeText={setCollaboratorEmail}
                                placeholder="Enter their email address"
                                placeholderTextColor="#CBD5E1"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            {collaboratorEmail.length > 0 && (
                                <TouchableOpacity onPress={() => setCollaboratorEmail('')}>
                                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {submitted && collaboratorEmail.trim() && !isEmailValid(collaboratorEmail.trim()) && (
                            <InlineError message="Please enter a valid email address" />
                        )}

                        <View style={[
                            tw`flex-row items-start mt-3 px-3 py-2.5 rounded-[12px]`,
                            { backgroundColor: accentColor + '08', borderWidth: 1, borderColor: accentColor + '20' },
                        ]}>
                            <Ionicons name="information-circle-outline" size={14} color={accentColor} style={{ marginTop: 1 }} />
                            <CustomText fontFamily="medium" style={{ color: accentColor + 'BB', fontSize: 11, marginLeft: 6, flex: 1, lineHeight: 16 }}>
                                They'll receive an invitation notification and can help manage this event.
                            </CustomText>
                        </View>
                    </FormCard>

                    {/* ══ SECTION 6: NOTES ═════════════════════════ */}
                    <FormCard anim={cardAnims[5]} fade={cardFades[5]}>
                        <SectionHeader icon="document-text-outline" label="Notes" color={accentColor} />
                        <TextInput
                            style={[
                                tw`px-4 py-3.5 text-[14px] text-slate-800 rounded-[14px]`,
                                {
                                    fontFamily: 'Poppins-Medium',
                                    minHeight: 100,
                                    textAlignVertical: 'top',
                                    backgroundColor: '#F8FAFC',
                                    borderWidth: 1.5,
                                    borderColor: '#E8EEF4',
                                },
                            ]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Dress code, special instructions, details..."
                            placeholderTextColor="#CBD5E1"
                            multiline
                        />
                    </FormCard>

                </ScrollView>

                {/* ── FIXED BOTTOM CTA ─────────────────────────── */}
                <View style={[
                    tw`px-5 pb-8 pt-4`,
                    { backgroundColor: '#F0F4F8', borderTopWidth: 1, borderTopColor: '#E8EEF4' },
                ]}>
                    <View style={tw`flex-row items-center mb-3 flex-wrap`}>
                        <ReadinessChip label="Name" done={!!title.trim()} color={accentColor} />
                        <ReadinessChip label="Type" done={!!eventType} color={accentColor} />
                        <ReadinessChip label="Date" done color={accentColor} />
                        <ReadinessChip label="Theme" done={!!(selectedTheme || customTheme.trim())} color={accentColor} optional />
                        <ReadinessChip label="Venue" done={!!location.trim()} color={accentColor} optional />
                    </View>

                    <TouchableOpacity
                        onPress={handleCreate}
                        disabled={loading}
                        activeOpacity={0.88}
                        style={[
                            tw`flex-row items-center justify-center py-4 rounded-[20px]`,
                            {
                                backgroundColor: loading ? '#94A3B8' : accentColor,
                                shadowColor: accentColor,
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.35,
                                shadowRadius: 16,
                                elevation: 8,
                            },
                        ]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <View style={[
                                    tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                    { backgroundColor: 'rgba(255,255,255,0.2)' },
                                ]}>
                                    <Ionicons name={accentIcon} size={17} color="#FFF" />
                                </View>
                                <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 17 }}>
                                    Create Event
                                </CustomText>
                                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.65)" style={{ marginLeft: 10 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>

            {/* ── DATE PICKER MODAL ─────────────────────────── */}
            {(() => {
                const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const daysInMonth = new Date(YEAR_OPTIONS[pickerYear], pickerMonth + 1, 0).getDate();
                const DAYS = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                return (
                    <Modal visible={showStartPicker} transparent animationType="slide" onRequestClose={() => setShowStartPicker(false)}>
                        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowStartPicker(false)}>
                            <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36 }}>
                                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <TouchableOpacity onPress={() => setShowStartPicker(false)}>
                                        <CustomText style={{ color: '#94A3B8', fontSize: 15, fontWeight: '600' }}>Cancel</CustomText>
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="calendar-outline" size={15} color="#00686F" />
                                        <CustomText style={{ color: '#0F172A', fontSize: 15, fontWeight: '800', marginLeft: 6 }}>
                                            {datePickerTarget === 'start' ? 'Start Date' : 'End Date'}
                                        </CustomText>
                                    </View>
                                    <TouchableOpacity onPress={confirmDate} style={{ backgroundColor: '#00686F', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 }}>
                                        <CustomText style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>Done</CustomText>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFC' }}>
                                    <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700' }}>
                                        {MONTHS[pickerMonth]} {Math.min(pickerDay + 1, daysInMonth)}, {YEAR_OPTIONS[pickerYear]}
                                    </CustomText>
                                </View>
                                <View style={{ flexDirection: 'row', height: 200, overflow: 'hidden', position: 'relative' }}>
                                    <View style={{ position: 'absolute', top: '50%', left: 16, right: 16, height: 40, marginTop: -20, backgroundColor: '#E8F5F5', borderRadius: 12, zIndex: 0 }} />
                                    <ScrollView style={{ flex: 2 }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 80 }} onMomentumScrollEnd={(e) => setPickerMonth(Math.round(e.nativeEvent.contentOffset.y / 40))} contentOffset={{ x: 0, y: pickerMonth * 40 }}>
                                        {MONTHS.map((m, i) => (
                                            <TouchableOpacity key={m} onPress={() => setPickerMonth(i)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 15, fontWeight: pickerMonth === i ? '800' : '500', color: pickerMonth === i ? '#00686F' : '#64748B' }}>{m}</CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 80 }} onMomentumScrollEnd={(e) => setPickerDay(Math.round(e.nativeEvent.contentOffset.y / 40))} contentOffset={{ x: 0, y: pickerDay * 40 }}>
                                        {DAYS.map((d, i) => (
                                            <TouchableOpacity key={d} onPress={() => setPickerDay(i)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 15, fontWeight: pickerDay === i ? '800' : '500', color: pickerDay === i ? '#00686F' : '#64748B' }}>{String(d).padStart(2, '0')}</CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <ScrollView style={{ flex: 1.2 }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 80 }} onMomentumScrollEnd={(e) => setPickerYear(Math.round(e.nativeEvent.contentOffset.y / 40))} contentOffset={{ x: 0, y: pickerYear * 40 }}>
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

            {/* ── TIME PICKER MODAL ─────────────────────────── */}
            {(() => {
                const HOURS   = Array.from({ length: 24 }, (_, i) => i);
                const MINUTES = Array.from({ length: 60 }, (_, i) => i);
                const h12 = pickerHour % 12 === 0 ? 12 : pickerHour % 12;
                const ampm = pickerHour < 12 ? 'AM' : 'PM';

                return (
                    <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
                        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
                            <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 36 }}>
                                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
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
                                <View style={{ alignItems: 'center', paddingVertical: 10, backgroundColor: '#F8FAFC' }}>
                                    <CustomText style={{ color: '#00686F', fontSize: 13, fontWeight: '700' }}>
                                        {String(h12).padStart(2, '0')}:{String(pickerMinute).padStart(2, '0')} {ampm}
                                    </CustomText>
                                </View>
                                <View style={{ flexDirection: 'row', height: 200, overflow: 'hidden', position: 'relative' }}>
                                    <View style={{ position: 'absolute', top: '50%', left: 16, right: 16, height: 40, marginTop: -20, backgroundColor: '#E8F5F5', borderRadius: 12, zIndex: 0 }} />
                                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 80 }} onMomentumScrollEnd={(e) => setPickerHour(Math.round(e.nativeEvent.contentOffset.y / 40))} contentOffset={{ x: 0, y: pickerHour * 40 }}>
                                        {HOURS.map((h) => (
                                            <TouchableOpacity key={h} onPress={() => setPickerHour(h)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 22, fontWeight: pickerHour === h ? '800' : '400', color: pickerHour === h ? '#00686F' : '#64748B' }}>
                                                    {String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}
                                                </CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <View style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
                                        <CustomText style={{ fontSize: 24, fontWeight: '800', color: '#00686F' }}>:</CustomText>
                                    </View>
                                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} snapToInterval={40} decelerationRate="fast" contentContainerStyle={{ paddingVertical: 80 }} onMomentumScrollEnd={(e) => setPickerMinute(Math.round(e.nativeEvent.contentOffset.y / 40))} contentOffset={{ x: 0, y: pickerMinute * 40 }}>
                                        {MINUTES.map((m) => (
                                            <TouchableOpacity key={m} onPress={() => setPickerMinute(m)} style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                                                <CustomText style={{ fontSize: 22, fontWeight: pickerMinute === m ? '800' : '400', color: pickerMinute === m ? '#00686F' : '#64748B' }}>
                                                    {String(m).padStart(2, '0')}
                                                </CustomText>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
                                        <TouchableOpacity onPress={() => { if (pickerHour >= 12) setPickerHour(pickerHour - 12); }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pickerHour < 12 ? '#00686F' : '#F1F5F9' }}>
                                            <CustomText style={{ color: pickerHour < 12 ? '#FFF' : '#94A3B8', fontSize: 13, fontWeight: '800' }}>AM</CustomText>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { if (pickerHour < 12) setPickerHour(pickerHour + 12); }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pickerHour >= 12 ? '#00686F' : '#F1F5F9' }}>
                                            <CustomText style={{ color: pickerHour >= 12 ? '#FFF' : '#94A3B8', fontSize: 13, fontWeight: '800' }}>PM</CustomText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                );
            })()}
        </SafeAreaView>
    );
}

// ── SUB-COMPONENTS ───────────────────────────────────────────
const FormCard = ({ children, anim, fade, error }) => (
    <Animated.View style={{
        opacity: fade,
        transform: [{ translateY: anim }],
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        marginBottom: 12,
        borderWidth: error ? 1.5 : 1,
        borderColor: error ? '#EF4444' : '#EEF2F7',
        shadowColor: error ? '#EF4444' : '#94A3B8',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: error ? 0.1 : 0.07,
        shadowRadius: 10,
        elevation: 2,
    }}>
        {children}
    </Animated.View>
);

const InlineError = ({ message }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Ionicons name="alert-circle" size={13} color="#EF4444" />
        <CustomText fontFamily="semibold" style={{ color: '#EF4444', fontSize: 12, marginLeft: 4 }}>
            {message}
        </CustomText>
    </View>
);

const SectionHeader = ({ icon, label, color, required }) => (
    <View style={[tw`flex-row items-center`, { marginBottom: 14 }]}>
        <View style={[
            tw`w-7 h-7 rounded-full justify-center items-center mr-2.5`,
            { backgroundColor: color + '18' },
        ]}>
            <Ionicons name={icon} size={14} color={color} />
        </View>
        <CustomText fontFamily="bold" style={{ color: '#0F172A', fontSize: 14 }}>
            {label}
            {required && <CustomText style={{ color: '#EF4444' }}> *</CustomText>}
        </CustomText>
    </View>
);

const DateTimeButton = ({ label, value, icon, color, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[
            tw`flex-1 flex-row items-center p-3.5 rounded-[16px]`,
            { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4' },
        ]}
    >
        <View style={[
            tw`w-9 h-9 rounded-full justify-center items-center mr-3`,
            { backgroundColor: color + '15' },
        ]}>
            <Ionicons name={icon} size={16} color={color} />
        </View>
        <View>
            <CustomText fontFamily="semibold" style={{ fontSize: 9, color: '#94A3B8', letterSpacing: 0.8 }}>
                {label}
            </CustomText>
            <CustomText fontFamily="bold" style={{ fontSize: 12, color: '#0F172A', marginTop: 1 }}>
                {value}
            </CustomText>
        </View>
    </TouchableOpacity>
);

const ThemePill = ({ theme, isSelected, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[
            tw`mr-2 mb-1 flex-row items-center px-4 py-2.5 rounded-[14px]`,
            {
                backgroundColor: isSelected ? theme.color + '15' : '#F8FAFC',
                borderWidth: 2,
                borderColor: isSelected ? theme.color : '#E8EEF4',
                shadowColor: isSelected ? theme.color : 'transparent',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: isSelected ? 0.2 : 0,
                shadowRadius: 6,
                elevation: isSelected ? 3 : 0,
            },
        ]}
    >
        <View style={[
            tw`w-6 h-6 rounded-full justify-center items-center mr-2`,
            { backgroundColor: isSelected ? theme.color + '25' : '#E8EEF4' },
        ]}>
            <Ionicons name={theme.icon} size={12} color={isSelected ? theme.color : '#94A3B8'} />
        </View>
        <CustomText fontFamily={isSelected ? 'bold' : 'semibold'} style={{ fontSize: 12, color: isSelected ? theme.color : '#64748B' }}>
            {theme.name}
        </CustomText>
        {isSelected && (
            <Ionicons name="checkmark-circle" size={14} color={theme.color} style={{ marginLeft: 6 }} />
        )}
    </TouchableOpacity>
);

const ReadinessChip = ({ label, done, color, optional }) => (
    <View style={[
        tw`flex-row items-center mr-2 mb-1 px-2.5 py-1 rounded-full`,
        {
            backgroundColor: done ? color + '18' : optional ? '#F8FAFC' : '#FEF2F2',
            borderWidth: 1,
            borderColor: done ? color + '40' : optional ? '#E8EEF4' : '#FECACA',
        },
    ]}>
        <Ionicons
            name={done ? 'checkmark-circle' : optional ? 'ellipse-outline' : 'alert-circle-outline'}
            size={11}
            color={done ? color : optional ? '#CBD5E1' : '#F87171'}
        />
        <CustomText fontFamily="semibold" style={{
            fontSize: 10,
            marginLeft: 3,
            color: done ? color : optional ? '#CBD5E1' : '#F87171',
        }}>
            {label}
        </CustomText>
    </View>
);