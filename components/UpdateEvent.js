import React, { useState, useRef, useEffect } from 'react';
import {
    View, ScrollView, TextInput, TouchableOpacity,
    ActivityIndicator, Platform, Switch,
    KeyboardAvoidingView, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomText from '../components/CustomText';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import tw from 'twrnc';

const { width } = Dimensions.get('window');

// ── EVENT TYPE CONFIG ───────────────────────────────────────
const EVENT_TYPES = [
    { key: 'Wedding',        icon: 'heart',              color: '#E8626A', bg: '#FFF0F0', desc: 'Celebrate love'        },
    { key: 'Birthday Party', icon: 'gift-outline',       color: '#F59E0B', bg: '#FFFBEB', desc: 'Make a wish'           },
    { key: 'Corporate',      icon: 'briefcase-outline',  color: '#3B82F6', bg: '#EFF6FF', desc: 'Business & networking' },
    { key: 'Charity',        icon: 'ribbon-outline',     color: '#10B981', bg: '#ECFDF5', desc: 'Give & inspire'        },
    { key: 'Others',         icon: 'star-outline',       color: '#8B5CF6', bg: '#F5F3FF', desc: 'Something special'     },
];

// ── THEMES ──────────────────────────────────────────────────
const THEMES = [
    { id: 'fairy-tale',     name: 'Fairy Tale',     icon: 'sparkles-outline',        color: '#C084FC', tags: ['Birthday Party'] },
    { id: 'golden-gala',    name: 'Golden Gala',    icon: 'trophy-outline',           color: '#D97706', tags: ['Wedding', 'Corporate'] },
    { id: 'garden-bloom',   name: 'Garden Bloom',   icon: 'leaf-outline',             color: '#10B981', tags: ['Wedding'] },
    { id: 'midnight-luxe',  name: 'Midnight Luxe',  icon: 'moon-outline',             color: '#6366F1', tags: [] },
    { id: 'tropical-fest',  name: 'Tropical Fest',  icon: 'sunny-outline',            color: '#F97316', tags: ['Birthday Party'] },
    { id: 'corporate-edge', name: 'Corporate Edge', icon: 'business-outline',         color: '#2563EB', tags: ['Corporate'] },
    { id: 'rustic-charm',   name: 'Rustic Charm',   icon: 'bonfire-outline',          color: '#B45309', tags: ['Wedding'] },
    { id: 'neon-fiesta',    name: 'Neon Fiesta',    icon: 'musical-notes-outline',    color: '#EC4899', tags: ['Birthday Party'] },
    { id: 'ocean-breeze',   name: 'Ocean Breeze',   icon: 'water-outline',            color: '#0EA5E9', tags: [] },
    { id: 'giving-heart',   name: 'Giving Heart',   icon: 'heart-circle-outline',     color: '#EF4444', tags: ['Charity'] },
];

// ── HELPERS ─────────────────────────────────────────────────
const fmt     = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    } catch {
        return new Date();
    }
};

// ── SCREEN ──────────────────────────────────────────────────
export default function UpdateEvent({ route, navigation }) {
    const { eventId, eventData } = route.params;

    // Resolve initial event type object
    const knownTypeKeys = EVENT_TYPES.map(t => t.key);
    const savedType     = eventData?.eventType || '';
    const matchedType   = EVENT_TYPES.find(t => t.key === savedType) || null;
    const isOther       = savedType && !knownTypeKeys.includes(savedType);

    // Resolve initial theme object
    const savedTheme    = eventData?.theme || null;
    const matchedTheme  = THEMES.find(t => t.name === savedTheme) || null;

    const [title, setTitle]             = useState(eventData?.title || '');
    const [eventType, setEventType]     = useState(matchedType || (isOther ? EVENT_TYPES.find(t => t.key === 'Others') : null));
    const [otherType, setOtherType]     = useState(isOther ? savedType : '');
    const [startDate, setStartDate]     = useState(
        eventData?.startDate?.seconds ? new Date(eventData.startDate.seconds * 1000) : new Date()
    );
    const [endDate, setEndDate]         = useState(
        eventData?.endDate?.seconds ? new Date(eventData.endDate.seconds * 1000) : new Date()
    );
    const [startTime, setStartTime]     = useState(parseTime(eventData?.startTime));
    const [isMultiDay, setIsMultiDay]   = useState(eventData?.isMultiDay || false);
    const [location, setLocation]       = useState(eventData?.location || '');
    const [description, setDescription] = useState(eventData?.description || '');
    const [selectedTheme, setSelectedTheme] = useState(matchedTheme);
    const [customTheme, setCustomTheme] = useState(!matchedTheme && savedTheme ? savedTheme : '');
    const [loading, setLoading]         = useState(false);
    const [submitted, setSubmitted]     = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker]     = useState(false);
    const [showTimePicker, setShowTimePicker]   = useState(false);

    // Animations
    const heroScale = useRef(new Animated.Value(0.96)).current;
    const cardAnims = useRef([0,1,2,3,4].map(() => new Animated.Value(40))).current;
    const cardFades = useRef([0,1,2,3,4].map(() => new Animated.Value(0))).current;

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

    const handleUpdate = async () => {
        setSubmitted(true);
        const finalType = eventType?.key === 'Others' ? otherType.trim() : eventType?.key;
        if (!title.trim() || !finalType) return;

        setLoading(true);
        try {
            const themeValue = customTheme.trim() || selectedTheme?.name || null;
            const docRef = doc(db, 'events', eventId);
            await updateDoc(docRef, {
                title:        title.trim(),
                eventType:    finalType,
                startDate:    Timestamp.fromDate(startDate),
                startTime:    fmtTime(startTime),
                endDate:      isMultiDay ? Timestamp.fromDate(endDate) : null,
                isMultiDay,
                location:     location.trim() || 'To be decided',
                description:  description.trim(),
                theme:        themeValue,
                themeAccent:  selectedTheme?.color || null,
                updatedAt:    Timestamp.now(),
            });
            setShowSuccess(true);
        } catch (e) {
            console.error('Update error:', e);
        } finally {
            setLoading(false);
        }
    };

    const accentColor   = '#00686F';
    const accentBg      = '#E0F2F3';
    const accentIcon    = eventType?.icon || 'create-outline';

    const suggestedThemes = THEMES.filter(t => t.tags.includes(eventType?.key));
    const remainingThemes = THEMES.filter(t => !t.tags.includes(eventType?.key));

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F0F4F8]`} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={tw`flex-1`}>

                {/* ── HERO HEADER ─────────────────────────────── */}
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
                                Edit Event
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
                            placeholder="Edit your event name..."
                            placeholderTextColor={accentColor + '45'}
                            multiline
                            returnKeyType="done"
                            blurOnSubmit
                        />
                        {submitted && !title.trim() && (
                            <InlineError message="Event name is required" />
                        )}

                        {(eventType || selectedTheme || customTheme.trim()) && (
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
                                const active     = eventType?.key === type.key;
                                const tileColor  = active ? type.color : '#64748B';
                                const tileBorder = active ? type.color : '#E8EEF4';
                                const tileBg     = active ? type.color + '12' : '#F8FAFC';
                                const iconBg     = active ? type.color + '25' : '#E8EEF4';
                                const iconColor  = active ? type.color : '#94A3B8';
                                return (
                                    <TouchableOpacity
                                        key={type.key}
                                        onPress={() => handleSelectType(type)}
                                        activeOpacity={0.75}
                                        style={[
                                            tw`mr-2 mb-2 rounded-[16px]`,
                                            { borderWidth: 2, borderColor: tileBorder, backgroundColor: tileBg },
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
                                onPress={() => setShowStartPicker(true)}
                            />
                            <View style={tw`w-3`} />
                            <DateTimeButton
                                label="TIME"
                                value={fmtTime(startTime)}
                                icon="time"
                                color={accentColor}
                                onPress={() => setShowTimePicker(true)}
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
                                onPress={() => setShowEndPicker(true)}
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
                            Where is this happening?
                        </CustomText>

                        <View style={[
                            tw`flex-row items-center px-4 rounded-[14px]`,
                            { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4' },
                        ]}>
                            <View style={[
                                tw`w-8 h-8 rounded-full justify-center items-center mr-3`,
                                { backgroundColor: accentColor + '15' },
                            ]}>
                                <Ionicons name="location-outline" size={16} color={accentColor} />
                            </View>
                            <TextInput
                                style={[tw`flex-1 py-3.5 text-[14px] text-slate-800`, { fontFamily: 'Poppins-Medium' }]}
                                value={location}
                                onChangeText={setLocation}
                                placeholder="Venue name or address (optional)"
                                placeholderTextColor="#CBD5E1"
                            />
                            {location.length > 0 && (
                                <TouchableOpacity onPress={() => setLocation('')}>
                                    <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </FormCard>

                    {/* ══ SECTION 5: NOTES ═════════════════════════ */}
                    <FormCard anim={cardAnims[4]} fade={cardFades[4]}>
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
                        <ReadinessChip label="Name"  done={!!title.trim()}                          color={accentColor} />
                        <ReadinessChip label="Type"  done={!!eventType}                             color={accentColor} />
                        <ReadinessChip label="Date"  done                                           color={accentColor} />
                        <ReadinessChip label="Theme" done={!!(selectedTheme || customTheme.trim())} color={accentColor} optional />
                        <ReadinessChip label="Venue" done={!!location.trim()}                       color={accentColor} optional />
                    </View>

                    <TouchableOpacity
                        onPress={handleUpdate}
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
                                    <Ionicons name="checkmark-outline" size={17} color="#FFF" />
                                </View>
                                <CustomText fontFamily="extrabold" style={{ color: '#FFF', fontSize: 17 }}>
                                    Save Changes
                                </CustomText>
                                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.65)" style={{ marginLeft: 10 }} />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>

            {/* ── PICKERS ──────────────────────────────────────── */}
            {showStartPicker && (
                <DateTimePicker
                    value={startDate} mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => {
                        setShowStartPicker(Platform.OS === 'ios');
                        if (d) { setStartDate(d); if (d > endDate) setEndDate(d); }
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate} mode="date" minimumDate={startDate}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, d) => { setShowEndPicker(Platform.OS === 'ios'); if (d) setEndDate(d); }}
                />
            )}
            {showTimePicker && (
                <DateTimePicker
                    value={startTime} mode="time" is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(e, t) => { setShowTimePicker(Platform.OS === 'ios'); if (t) setStartTime(t); }}
                />
            )}

            {/* ── SUCCESS OVERLAY ──────────────────────────────── */}
            {showSuccess && (
                <Animated.View style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    justifyContent: 'center', alignItems: 'center',
                }}>
                    <View style={{
                        width: '85%', backgroundColor: '#FFF', borderRadius: 30,
                        padding: 30, alignItems: 'center',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
                        shadowOpacity: 0.1, shadowRadius: 20, elevation: 5,
                    }}>
                        <View style={{
                            width: 80, height: 80, borderRadius: 40,
                            backgroundColor: '#F0F9FA', justifyContent: 'center',
                            alignItems: 'center', marginBottom: 20,
                        }}>
                            <Ionicons name="checkmark-circle" size={50} color="#00686F" />
                        </View>
                        <CustomText fontFamily="extrabold" style={{ fontSize: 22, color: '#1E293B', marginBottom: 10 }}>
                            Updated!
                        </CustomText>
                        <CustomText fontFamily="medium" style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 }}>
                            Your event changes have been synced successfully.
                        </CustomText>
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#00686F', paddingVertical: 16,
                                borderRadius: 16, width: '100%', alignItems: 'center',
                            }}
                            onPress={() => { setShowSuccess(false); navigation.goBack(); }}
                        >
                            <CustomText fontFamily="bold" style={{ color: '#FFF', fontSize: 16 }}>Continue</CustomText>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
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