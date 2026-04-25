import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    ActivityIndicator,
    Modal,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomText from './CustomText';
import { auth, db } from '../firebase';
import {
    collection, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import GuideModal from './GuideModal';

// ─── Brand ────────────────────────────────────────────────────────────────────
const TEAL        = '#00686F';
const TEAL_DARK   = '#004E54';
const TEAL_LIGHT  = '#F0F9FA';
const TEAL_MID    = '#E0F2F3';
const TEAL_BORDER = '#B2DEDE';

// ─── Upload ───────────────────────────────────────────────────────────────────
const CLOUD_NAME    = 'dgvbemrgw';
const UPLOAD_PRESET = 'venues';

// ─── Step config ──────────────────────────────────────────────────────────────
const TOTAL_STEPS = 4;

const STEP_META = [
    { label: 'Venue\ninfo' },
    { label: 'Details\n& media' },
    { label: '3D\nscan' },
    { label: 'Review\n& publish' },
];

const STEP_HEADER_META = [
    { icon: 'business-outline',          label: 'Venue Info',        color: TEAL },
    { icon: 'image-outline',             label: 'Details & Media',   color: '#7C3AED' },
    { icon: 'cube-outline',              label: '3D Scan',           color: '#1D4ED8' },
    { icon: 'checkmark-circle-outline',  label: 'Review & Publish',  color: '#10B981' },
];

// ─── Amenity presets ──────────────────────────────────────────────────────────
const AMENITY_PRESETS = [
    { id: 'wifi',       icon: 'wifi-outline',          label: 'Wi-Fi'        },
    { id: 'parking',    icon: 'car-outline',           label: 'Parking'      },
    { id: 'catering',   icon: 'restaurant-outline',    label: 'Catering'     },
    { id: 'av',         icon: 'tv-outline',            label: 'AV System'    },
    { id: 'aircon',     icon: 'snow-outline',          label: 'Air-con'      },
    { id: 'generator',  icon: 'flash-outline',         label: 'Generator'    },
    { id: 'stage',      icon: 'mic-outline',           label: 'Stage'        },
    { id: 'dancefloor', icon: 'musical-notes-outline', label: 'Dance Floor'  },
    { id: 'bridal',     icon: 'heart-outline',         label: 'Bridal Room'  },
    { id: 'outdoor',    icon: 'sunny-outline',         label: 'Outdoor Space'},
];

// ─── Scaniverse helpers ───────────────────────────────────────────────────────
const SCANIVERSE_DEEP_LINK      = 'scaniverse://';
const SCANIVERSE_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nianticlabs.scaniverse';
const SCANIVERSE_APP_STORE_URL  = 'https://apps.apple.com/us/app/scaniverse-3d-scanner/id1541433893';

const openScaniverse = async () => {
    const storeUrl = Platform.OS === 'ios' ? SCANIVERSE_APP_STORE_URL : SCANIVERSE_PLAY_STORE_URL;
    try {
        const isInstalled = await Linking.canOpenURL(SCANIVERSE_DEEP_LINK);
        if (isInstalled) {
            await Linking.openURL(SCANIVERSE_DEEP_LINK);
        } else {
            const storeOk = await Linking.canOpenURL(storeUrl);
            if (storeOk) await Linking.openURL(storeUrl);
            else Alert.alert('Error', 'Unable to open the store. Search for "Scaniverse" manually.');
        }
    } catch {
        Alert.alert('Error', 'Something went wrong while opening Scaniverse.');
    }
};

// ─── Empty form factory ───────────────────────────────────────────────────────
export const emptyVenueForm = () => ({
    name: '', location: '', capacity: '', price: '',
    description: '', imageLink: '', selectedImage: null,
    phone: '', fbPage: '', igHandle: '',
    amenities: [], selectedModel: null,
});

// ─── Shared styles ────────────────────────────────────────────────────────────
const fieldLabelStyle = {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
};

const inputContainerStyle = {
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4',
    borderRadius: 14, paddingHorizontal: 14,
};

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children, style }) {
    return (
        <CustomText style={[fieldLabelStyle, { marginTop: 16, marginBottom: 6 }, style]}>
            {children}
        </CustomText>
    );
}

// ─── RequiredLabel — shows red * + REQUIRED badge ────────────────────────────
function RequiredLabel({ label }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <CustomText style={fieldLabelStyle}>{label}</CustomText>
            <CustomText style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>*</CustomText>
            <View style={{
                backgroundColor: '#FEF2F2', borderRadius: 6,
                paddingHorizontal: 6, paddingVertical: 1,
                borderWidth: 1, borderColor: '#FECACA',
            }}>
                <CustomText style={{ fontSize: 9, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 }}>
                    REQUIRED
                </CustomText>
            </View>
        </View>
    );
}

// ─── FormField — plain text input with optional required badge ────────────────
function FormField({ label, placeholder, value, onChangeText, keyboardType, multiline, required, isInvalid }) {
    const [isFocused, setIsFocused] = useState(false);
    const borderColor = isInvalid ? '#EF4444' : isFocused ? TEAL : '#E8EEF4';
    const borderWidth = isFocused || isInvalid ? 2 : 1.5;

    return (
        <View style={{ marginBottom: 4 }}>
            {required
                ? <RequiredLabel label={label} />
                : <SectionLabel style={{ marginTop: 12 }}>{label}</SectionLabel>
            }
            <View style={[
                inputContainerStyle,
                { borderColor, borderWidth },
                multiline ? { minHeight: 80, paddingVertical: 12 } : { height: 50, justifyContent: 'center' },
                isInvalid && { backgroundColor: '#FFF5F5' },
            ]}>
                <TextInput
                    style={{
                        fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium',
                        textAlignVertical: multiline ? 'top' : 'center',
                    }}
                    placeholder={placeholder}
                    placeholderTextColor="#CBD5E1"
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType || 'default'}
                    multiline={multiline}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {isInvalid && (
                    <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginLeft: 4 }} />
                )}
            </View>
            {isInvalid && (
                <CustomText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 4, marginLeft: 2 }}>
                    {label} is required
                </CustomText>
            )}
        </View>
    );
}

// ─── Step 1 — Venue Info ──────────────────────────────────────────────────────
function Step1({ form, setForm, touched }) {
    const isNameInvalid     = touched.name     && !form.name.trim();
    const isLocationInvalid = touched.location && !form.location.trim();

    return (
        <View>
            <FormField
                label="Venue Name"
                placeholder="e.g. Villa Fortuna Events Hall"
                value={form.name}
                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                required
                isInvalid={isNameInvalid}
            />
            <FormField
                label="Location"
                placeholder="e.g. Tagaytay City, Cavite"
                value={form.location}
                onChangeText={v => setForm(f => ({ ...f, location: v }))}
                required
                isInvalid={isLocationInvalid}
            />

            <SectionLabel style={{ marginTop: 16 }}>Capacity & Price</SectionLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Capacity */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                        <CustomText style={fieldLabelStyle}>Capacity (pax)</CustomText>
                        <CustomText style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>*</CustomText>
                        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#FECACA' }}>
                            <CustomText style={{ fontSize: 9, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 }}>REQUIRED</CustomText>
                        </View>
                    </View>
                    <View style={[
                        inputContainerStyle, { height: 50, justifyContent: 'center' },
                        touched.capacity && !form.capacity && { borderColor: '#EF4444', borderWidth: 2, backgroundColor: '#FFF5F5' },
                    ]}>
                        <TextInput
                            style={{ fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                            placeholder="e.g. 200"
                            placeholderTextColor="#CBD5E1"
                            value={form.capacity}
                            onChangeText={v => setForm(f => ({ ...f, capacity: v.replace(/[^0-9]/g, '') }))}
                            keyboardType="numeric"
                        />
                    </View>
                    {touched.capacity && !form.capacity && (
                        <CustomText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 4, marginLeft: 2 }}>Capacity is required</CustomText>
                    )}
                </View>

                {/* Price */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                        <CustomText style={fieldLabelStyle}>Price / Day (₱)</CustomText>
                        <CustomText style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>*</CustomText>
                        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: '#FECACA' }}>
                            <CustomText style={{ fontSize: 9, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 }}>REQUIRED</CustomText>
                        </View>
                    </View>
                    <View style={[
                        inputContainerStyle, { height: 50, justifyContent: 'center' },
                        touched.price && !form.price && { borderColor: '#EF4444', borderWidth: 2, backgroundColor: '#FFF5F5' },
                    ]}>
                        <TextInput
                            style={{ fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                            placeholder="e.g. 15000"
                            placeholderTextColor="#CBD5E1"
                            value={form.price}
                            onChangeText={v => setForm(f => ({ ...f, price: v.replace(/[^0-9.]/g, '') }))}
                            keyboardType="decimal-pad"
                        />
                    </View>
                    {touched.price && !form.price && (
                        <CustomText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 4, marginLeft: 2 }}>Price is required</CustomText>
                    )}
                </View>
            </View>

            <FormField
                label="Description"
                placeholder="What makes this venue special…"
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                multiline
            />
        </View>
    );
}

// ─── Step 2 — Details & Media ─────────────────────────────────────────────────
function Step2({ form, setForm }) {
    const [amenityInput, setAmenityInput] = useState('');

    const addAmenity = () => {
        const t = amenityInput.trim();
        if (t && !form.amenities.includes(t)) {
            setForm(f => ({ ...f, amenities: [...f.amenities, t] }));
            setAmenityInput('');
        }
    };

    const removeAmenity = idx => {
        setForm(f => ({ ...f, amenities: f.amenities.filter((_, i) => i !== idx) }));
    };

    const togglePreset = id => {
        const label = AMENITY_PRESETS.find(a => a.id === id)?.label || id;
        setForm(f => ({
            ...f,
            amenities: f.amenities.includes(label)
                ? f.amenities.filter(a => a !== label)
                : [...f.amenities, label],
        }));
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [16, 9], quality: 0.8,
        });
        if (!result.canceled) {
            setForm(f => ({ ...f, selectedImage: result.assets[0], imageLink: '' }));
        }
    };

    return (
        <View>
            {/* Photos */}
            <SectionLabel style={{ marginTop: 0 }}>Photos</SectionLabel>
            <TouchableOpacity
                onPress={pickImage}
                activeOpacity={0.8}
                style={{
                    borderWidth: 1.5, borderStyle: 'dashed',
                    borderColor: form.selectedImage ? TEAL : '#CBD5E1',
                    borderRadius: 16, padding: 18, alignItems: 'center', gap: 6,
                    backgroundColor: form.selectedImage ? TEAL_LIGHT : '#FAFAFA',
                }}
            >
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: form.selectedImage ? TEAL_LIGHT : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={form.selectedImage ? 'image' : 'image-outline'} size={24} color={form.selectedImage ? TEAL : '#94A3B8'} />
                </View>
                <CustomText style={{ color: form.selectedImage ? TEAL : '#64748B', fontSize: 13, fontWeight: '600' }}>
                    {form.selectedImage ? 'Photo selected — tap to change' : 'Upload venue photo'}
                </CustomText>
                {form.selectedImage && (
                    <CustomText style={{ fontSize: 11, color: '#94A3B8' }}>
                        {form.selectedImage.fileName || 'photo.jpg'}
                    </CustomText>
                )}
            </TouchableOpacity>

            <View style={{ marginTop: 8, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4', borderRadius: 14, paddingHorizontal: 14, height: 50, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="link-outline" size={16} color="#94A3B8" />
                <TextInput
                    style={{ flex: 1, fontSize: 13, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                    placeholder="Or paste an image URL"
                    placeholderTextColor="#CBD5E1"
                    value={form.imageLink}
                    onChangeText={v => setForm(f => ({ ...f, imageLink: v, selectedImage: null }))}
                    autoCapitalize="none"
                />
            </View>

            {/* Amenity presets */}
            <SectionLabel style={{ marginTop: 16 }}>Amenities</SectionLabel>
            <CustomText style={{ fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Tap to select
            </CustomText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {AMENITY_PRESETS.map(amenity => {
                    const isSelected = form.amenities.includes(amenity.label);
                    return (
                        <TouchableOpacity
                            key={amenity.id}
                            onPress={() => togglePreset(amenity.id)}
                            style={[
                                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 5 },
                                isSelected
                                    ? { backgroundColor: TEAL_LIGHT, borderColor: TEAL }
                                    : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                            ]}
                        >
                            <Ionicons name={amenity.icon} size={14} color={isSelected ? TEAL : '#94A3B8'} />
                            <CustomText style={{ fontSize: 12, fontWeight: '700', color: isSelected ? TEAL : '#64748B' }}>
                                {amenity.label}
                            </CustomText>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Custom amenity input */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4', borderRadius: 14, paddingHorizontal: 14, height: 50, justifyContent: 'center' }}>
                    <TextInput
                        style={{ fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                        placeholder="Add custom amenity…"
                        placeholderTextColor="#CBD5E1"
                        value={amenityInput}
                        onChangeText={setAmenityInput}
                        onSubmitEditing={addAmenity}
                        returnKeyType="done"
                    />
                </View>
                <TouchableOpacity
                    style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' }}
                    onPress={addAmenity}
                >
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Custom amenity chips */}
            {form.amenities.filter(a => !AMENITY_PRESETS.map(p => p.label).includes(a)).length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8 }}>
                    {form.amenities
                        .filter(a => !AMENITY_PRESETS.map(p => p.label).includes(a))
                        .map((item, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: TEAL_LIGHT, borderWidth: 1, borderColor: TEAL_BORDER }}>
                                <CustomText style={{ color: TEAL, fontSize: 12, fontWeight: '600', marginRight: 6 }}>{item}</CustomText>
                                <TouchableOpacity onPress={() => removeAmenity(form.amenities.indexOf(item))}>
                                    <Ionicons name="close-circle" size={15} color={TEAL} />
                                </TouchableOpacity>
                            </View>
                        ))
                    }
                </View>
            )}

            {/* Contact details */}
            <SectionLabel style={{ marginTop: 16 }}>Contact details</SectionLabel>
            <FormField label="Contact number" placeholder="+63 9XX XXX XXXX" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <View style={{ height: 8 }} />
            <FormField label="Facebook page URL" placeholder="https://facebook.com/yourvenue" value={form.fbPage} onChangeText={v => setForm(f => ({ ...f, fbPage: v }))} />
            <View style={{ height: 8 }} />
            <FormField label="Instagram handle" placeholder="@yourvenue" value={form.igHandle} onChangeText={v => setForm(f => ({ ...f, igHandle: v }))} />
        </View>
    );
}

// ─── [ScaniverseTutorialModal removed — now using GuideModal component] ──────

// ─── Step 3 — 3D Scan ─────────────────────────────────────────────────────────
function Step3({ form, setForm, onSkip }) {
    const [guideVisible, setGuideVisible] = useState(false);

    const pickModel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/octet-stream', 'model/gltf-binary', 'model/gltf+json'],
                copyToCacheDirectory: true,
            });
            if (!result.canceled) setForm(f => ({ ...f, selectedModel: result.assets[0] }));
        } catch {
            Alert.alert('Error', 'Failed to pick model file.');
        }
    };

    return (
        <View>
            <GuideModal visible={guideVisible} onClose={() => setGuideVisible(false)} />

            <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="information-circle-outline" size={20} color="#1D4ED8" />
                </View>
                <View style={{ flex: 1 }}>
                    <CustomText style={{ fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginBottom: 2 }}>What is a 3D scan?</CustomText>
                    <CustomText style={{ fontSize: 12, color: '#475569', lineHeight: 18 }}>
                        A .glb file lets guests explore your venue in AR before booking. Capture it free with Scaniverse.
                    </CustomText>
                    <TouchableOpacity onPress={() => setGuideVisible(true)} style={{ marginTop: 6 }}>
                        <CustomText style={{ fontSize: 12, color: '#1D4ED8', fontWeight: '700' }}>View how-to guide →</CustomText>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, backgroundColor: '#FAFAFA', overflow: 'hidden' }}>
                <TouchableOpacity onPress={openScaniverse} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Ionicons name="cube-outline" size={22} color="#1D4ED8" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>Open Scaniverse</CustomText>
                        <CustomText style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                            {Platform.OS === 'ios' ? 'Opens App Store if not installed' : 'Opens Play Store if not installed'}
                        </CustomText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity onPress={pickModel} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: TEAL_LIGHT, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Ionicons name="cloud-upload-outline" size={22} color={TEAL} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <CustomText style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>Import .glb file</CustomText>
                        <CustomText style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Select the exported model from Scaniverse</CustomText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
            </View>

            {form.selectedModel && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: TEAL_LIGHT, borderWidth: 1.5, borderColor: TEAL_BORDER }}>
                    <Ionicons name="checkmark-circle" size={20} color={TEAL} />
                    <CustomText style={{ flex: 1, marginLeft: 10, fontSize: 13, fontWeight: '700', color: TEAL }}>
                        {form.selectedModel.name || 'model.glb'}
                    </CustomText>
                    <TouchableOpacity onPress={() => setForm(f => ({ ...f, selectedModel: null }))}>
                        <Ionicons name="close-circle-outline" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                </View>
            )}

            <TouchableOpacity onPress={onSkip} style={{ marginTop: 20, alignItems: 'center', paddingVertical: 8 }}>
                <CustomText style={{ color: '#94A3B8', fontSize: 13, textDecorationLine: 'underline' }}>Skip and do it later →</CustomText>
            </TouchableOpacity>
        </View>
    );
}

// ─── Step 4 — Review & Publish ────────────────────────────────────────────────
function Step4({ form, goToStep }) {
    const Row = ({ label, value, step }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            <CustomText style={{ fontSize: 11, color: '#94A3B8', width: 90 }}>{label}</CustomText>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
                <CustomText style={{ fontSize: 13, color: '#334155', fontWeight: '700', textAlign: 'right', flexShrink: 1 }} numberOfLines={2}>
                    {value || '—'}
                </CustomText>
                <TouchableOpacity onPress={() => goToStep(step)} style={{ marginLeft: 8 }}>
                    <CustomText style={{ color: TEAL, fontSize: 11 }}>Edit</CustomText>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <CustomText style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>{form.name || 'Unnamed venue'}</CustomText>
                {form.selectedModel && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: TEAL_LIGHT, borderWidth: 1, borderColor: TEAL_BORDER }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL, marginRight: 6 }} />
                        <CustomText style={{ color: TEAL, fontSize: 11, fontWeight: '700' }}>AR Ready</CustomText>
                    </View>
                )}
            </View>
            <Row label="Location"    value={form.location}                                                 step={1} />
            <Row label="Capacity"    value={form.capacity ? `${form.capacity} pax` : ''}                  step={1} />
            <Row label="Price"       value={form.price ? `₱${parseInt(form.price).toLocaleString()}/day` : ''} step={1} />
            <Row label="Description" value={form.description}                                             step={1} />
            <Row label="Photo"       value={form.selectedImage ? 'Photo uploaded' : form.imageLink ? 'Image URL set' : 'None'} step={2} />
            <Row label="Amenities"   value={form.amenities.length ? form.amenities.join(', ') : 'None'}  step={2} />
            <Row label="Contact"     value={form.phone}                                                   step={2} />
            <Row label="Facebook"    value={form.fbPage}                                                  step={2} />
            <Row label="Instagram"   value={form.igHandle}                                                step={2} />
            <Row label="3D scan"     value={form.selectedModel ? form.selectedModel.name : 'Not added'}  step={3} />
        </View>
    );
}

// ─── Main AddVenue component (used as a Modal from VenueOwnerScreen) ──────────
export default function AddVenue({
    visible,
    onClose,
    isEditing = false,
    initialForm,
    onSave,
    isSubmitting = false,
}) {
    const [step, setStep]   = useState(1);
    const [form, setForm]   = useState(initialForm || emptyVenueForm());
    const [touched, setTouched] = useState({});
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setForm(initialForm || emptyVenueForm());
            setStep(1);
            setTouched({});
        }
    }, [visible]);

    const animateStep = dir => {
        Animated.sequence([
            Animated.timing(slideAnim, { toValue: dir * -30, duration: 100, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0,         duration: 180, useNativeDriver: true }),
        ]).start();
    };

    const validateStep = () => {
        if (step === 1) {
            const newTouched = { name: true, location: true, capacity: true, price: true };
            setTouched(prev => ({ ...prev, ...newTouched }));
            if (!form.name.trim())     { Alert.alert('Required field', 'Please fill in the venue name.');     return false; }
            if (!form.location.trim()) { Alert.alert('Required field', 'Please fill in the location.');       return false; }
            if (!form.capacity.trim()) { Alert.alert('Required field', 'Please fill in the capacity.');       return false; }
            if (!form.price.trim())    { Alert.alert('Required field', 'Please fill in the price.');          return false; }
        }
        return true;
    };

    const next = () => {
        if (!validateStep()) return;
        if (step < TOTAL_STEPS) { animateStep(1); setStep(s => s + 1); }
        else if (onSave) onSave(form);
    };

    const back = () => {
        if (step > 1) { animateStep(-1); setStep(s => s - 1); }
    };

    const meta    = STEP_HEADER_META[step - 1];
    const isLast  = step === TOTAL_STEPS;
    const btnLabel = isLast ? (isEditing ? 'Update Venue' : 'Publish Venue 🎉') : 'Continue';

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={{
                        backgroundColor: '#F0F4F8',
                        borderTopLeftRadius: 32, borderTopRightRadius: 32,
                        maxHeight: '92%', overflow: 'hidden',
                        shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
                        shadowOpacity: 0.15, shadowRadius: 24, elevation: 20,
                    }}>
                        {/* Drag handle */}
                        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' }} />
                        </View>

                        {/* Required-fields legend */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#FFF8F0', borderBottomWidth: 1, borderBottomColor: '#FDEBD0', marginHorizontal: 16, borderRadius: 12, marginBottom: 4 }}>
                            <CustomText style={{ color: '#EF4444', fontWeight: '700', fontSize: 13, marginRight: 4 }}>*</CustomText>
                            <CustomText style={{ color: '#92400E', fontSize: 12, fontWeight: '500' }}>
                                Fields marked REQUIRED must be filled before continuing
                            </CustomText>
                        </View>

                        {/* Header card */}
                        <View style={{
                            marginHorizontal: 16, marginBottom: 8,
                            backgroundColor: '#fff', borderRadius: 24, padding: 18,
                            borderWidth: 1.5, borderColor: meta.color + '25',
                            shadowColor: meta.color, shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
                        }}>
                            {/* Title row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: meta.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name={meta.icon} size={19} color={meta.color} />
                                    </View>
                                    <View>
                                        <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.8 }}>
                                            STEP {step} OF {TOTAL_STEPS}
                                        </CustomText>
                                        <CustomText style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                                            {isEditing ? 'Edit: ' : ''}{meta.label}
                                        </CustomText>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E8EEF4', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Ionicons name="close" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            {/* Progress bar */}
                            <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                                <View style={{ width: `${(step / TOTAL_STEPS) * 100}%`, height: '100%', backgroundColor: meta.color, borderRadius: 3 }} />
                            </View>

                            {/* Step pills */}
                            <View style={{ flexDirection: 'row', marginTop: 10, gap: 6 }}>
                                {STEP_META.map((s, i) => {
                                    const n      = i + 1;
                                    const done   = n < step;
                                    const active = n === step;
                                    return (
                                        <View key={n} style={{
                                            flex: 1, paddingVertical: 5, borderRadius: 8, alignItems: 'center',
                                            backgroundColor: done ? meta.color + '15' : active ? meta.color + '10' : '#F8FAFC',
                                            borderWidth: 1,
                                            borderColor: done || active ? meta.color + '30' : '#E8EEF4',
                                        }}>
                                            {done
                                                ? <Ionicons name="checkmark" size={12} color={meta.color} />
                                                : <CustomText style={{ fontSize: 9, fontWeight: '800', color: active ? meta.color : '#CBD5E1' }}>
                                                    {s.label.replace('\n', ' ')}
                                                  </CustomText>
                                            }
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Form content */}
                        <ScrollView
                            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <Animated.View style={{
                                transform: [{ translateX: slideAnim }],
                                backgroundColor: '#fff', borderRadius: 24, padding: 20,
                                borderWidth: 1, borderColor: '#EEF2F7',
                                shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
                            }}>
                                {step === 1 && <Step1 form={form} setForm={setForm} touched={touched} />}
                                {step === 2 && <Step2 form={form} setForm={setForm} />}
                                {step === 3 && <Step3 form={form} setForm={setForm} onSkip={() => setStep(4)} />}
                                {step === 4 && <Step4 form={form} goToStep={setStep} />}
                            </Animated.View>
                        </ScrollView>

                        {/* Footer buttons */}
                        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 34 : 20, gap: 10 }}>
                            <TouchableOpacity
                                onPress={next}
                                disabled={isSubmitting}
                                activeOpacity={0.85}
                                style={{
                                    height: 56, borderRadius: 18,
                                    backgroundColor: isLast ? (isEditing ? '#10B981' : TEAL) : meta.color,
                                    alignItems: 'center', justifyContent: 'center',
                                    flexDirection: 'row', gap: 8,
                                    shadowColor: meta.color, shadowOffset: { width: 0, height: 6 },
                                    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                                    opacity: isSubmitting ? 0.75 : 1,
                                }}
                            >
                                {isSubmitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <>
                                        <CustomText style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{btnLabel}</CustomText>
                                        {!isLast && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                                      </>
                                }
                            </TouchableOpacity>

                            {step > 1 && (
                                <TouchableOpacity
                                    onPress={back}
                                    style={{ height: 46, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                                >
                                    <Ionicons name="arrow-back" size={15} color="#64748B" />
                                    <CustomText style={{ color: '#64748B', fontSize: 14, fontWeight: '700' }}>Back</CustomText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}