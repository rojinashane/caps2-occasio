import React, { useState, useEffect, useRef } from 'react';
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
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomText from './CustomText';

// ─── Brand ────────────────────────────────────────────────────────────────────
const TEAL        = '#00686F';
const TEAL_DARK   = '#004E54';
const TEAL_LIGHT  = '#F0F9FA';
const TEAL_MID    = '#E0F2F3';
const TEAL_BORDER = '#B2DEDE';

// ─── Vendor categories ────────────────────────────────────────────────────────
export const VENDOR_CATEGORIES = [
    'Unassigned', 'Attire & Accessories', 'Beauty',
    'Music & Show', 'Photo & Video', 'Accessories',
    'Flower & Decor', 'Catering',
];

// ─── Category meta ────────────────────────────────────────────────────────────
const CATEGORY_META = {
    'Unassigned':          { icon: 'help-circle-outline',   color: '#94A3B8' },
    'Attire & Accessories':{ icon: 'shirt-outline',         color: '#7C3AED' },
    'Beauty':              { icon: 'sparkles-outline',      color: '#EC4899' },
    'Music & Show':        { icon: 'musical-notes-outline', color: '#F59E0B' },
    'Photo & Video':       { icon: 'camera-outline',        color: '#1D4ED8' },
    'Accessories':         { icon: 'bag-outline',           color: '#0891B2' },
    'Flower & Decor':      { icon: 'flower-outline',        color: '#10B981' },
    'Catering':            { icon: 'restaurant-outline',    color: '#EF4444' },
};

// ─── Empty form factory ───────────────────────────────────────────────────────
export const emptyVendorForm = () => ({
    name: '',
    category: 'Unassigned',
    phone: '',
    facebook: '',
    location: '',
});

// ─── Shared field styles ──────────────────────────────────────────────────────
const fieldLabelStyle = {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 0.8,
};

const inputContainerStyle = {
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E8EEF4',
    borderRadius: 14, paddingHorizontal: 14,
};

// ─── RequiredLabel ────────────────────────────────────────────────────────────
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

function SectionLabel({ children, style }) {
    return (
        <CustomText style={[fieldLabelStyle, { marginTop: 16, marginBottom: 6 }, style]}>
            {children}
        </CustomText>
    );
}

// ─── FormField ────────────────────────────────────────────────────────────────
function FormField({ label, placeholder, value, onChangeText, keyboardType, required, isInvalid, icon }) {
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
                { borderColor, borderWidth, height: 50, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
                isInvalid && { backgroundColor: '#FFF5F5' },
            ]}>
                {icon && <Ionicons name={icon} size={16} color={isInvalid ? '#EF4444' : isFocused ? TEAL : '#CBD5E1'} />}
                <TextInput
                    style={{ flex: 1, fontSize: 14, color: '#0F172A', fontFamily: 'Poppins-Medium' }}
                    placeholder={placeholder}
                    placeholderTextColor="#CBD5E1"
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType || 'default'}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                {isInvalid && <Ionicons name="alert-circle" size={16} color="#EF4444" />}
            </View>
            {isInvalid && (
                <CustomText style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginTop: 4, marginLeft: 2 }}>
                    {label} is required
                </CustomText>
            )}
        </View>
    );
}

// ─── AddVendor ────────────────────────────────────────────────────────────────
export default function AddVendor({
    visible,
    onClose,
    isEditing = false,
    initialForm,
    onSave,
    isSubmitting = false,
}) {
    const [form, setForm]     = useState(initialForm || emptyVendorForm());
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (visible) {
            setForm(initialForm || emptyVendorForm());
            setTouched({});
        }
    }, [visible]);

    const isNameInvalid     = touched.name     && !form.name.trim();
    const isPhoneInvalid    = touched.phone    && !form.phone.trim();
    const isLocationInvalid = touched.location && !form.location.trim();

    const handleSave = () => {
        setTouched({ name: true, phone: true, location: true });
        if (!form.name.trim())     { Alert.alert('Required field', 'Please enter the vendor name.');     return; }
        if (!form.phone.trim())    { Alert.alert('Required field', 'Please enter a contact number.');    return; }
        if (!form.location.trim()) { Alert.alert('Required field', 'Please enter the vendor location.'); return; }
        onSave(form);
    };

    const catMeta = CATEGORY_META[form.category] || CATEGORY_META['Unassigned'];

    return (
        <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F0F4F8' }}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Required-fields legend */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFF8F0', borderBottomWidth: 1, borderBottomColor: '#FDEBD0' }}>
                        <CustomText style={{ color: '#EF4444', fontWeight: '700', fontSize: 13, marginRight: 4 }}>*</CustomText>
                        <CustomText style={{ color: '#92400E', fontSize: 12, fontWeight: '500' }}>
                            Fields marked REQUIRED must be filled before saving
                        </CustomText>
                    </View>

                    {/* Header card */}
                    <View style={{
                        marginHorizontal: 16, marginTop: 12, marginBottom: 8,
                        backgroundColor: '#fff', borderRadius: 24, padding: 18,
                        borderWidth: 1.5, borderColor: TEAL + '25',
                        shadowColor: TEAL, shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: TEAL_MID, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="people-outline" size={22} color={TEAL} />
                                </View>
                                <View>
                                    <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.8 }}>
                                        {isEditing ? 'EDITING VENDOR' : 'NEW VENDOR'}
                                    </CustomText>
                                    <CustomText style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                                        {isEditing ? 'Update Details' : 'Add a Vendor'}
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
                    </View>

                    {/* Form content */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{
                            backgroundColor: '#fff', borderRadius: 24, padding: 20,
                            borderWidth: 1, borderColor: '#EEF2F7',
                            shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
                        }}>

                            {/* Vendor Name */}
                            <FormField
                                label="Vendor Name"
                                placeholder="e.g. Blooms & Co."
                                value={form.name}
                                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                                icon="storefront-outline"
                                required
                                isInvalid={isNameInvalid}
                            />

                            {/* Category */}
                            <View style={{ marginTop: 16, marginBottom: 4 }}>
                                <SectionLabel style={{ marginTop: 0 }}>Category</SectionLabel>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                                    {VENDOR_CATEGORIES.map(cat => {
                                        const meta = CATEGORY_META[cat] || CATEGORY_META['Unassigned'];
                                        const isSelected = form.category === cat;
                                        return (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => setForm(f => ({ ...f, category: cat }))}
                                                style={[
                                                    { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
                                                    isSelected
                                                        ? { backgroundColor: TEAL_LIGHT, borderColor: TEAL }
                                                        : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                                                ]}
                                            >
                                                <Ionicons name={meta.icon} size={14} color={isSelected ? TEAL : '#94A3B8'} />
                                                <CustomText style={{ color: isSelected ? TEAL : '#64748B', fontSize: 12, fontWeight: '700' }}>
                                                    {cat}
                                                </CustomText>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {/* Selected category badge */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: TEAL_LIGHT, borderWidth: 1.5, borderColor: TEAL_BORDER }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name={catMeta.icon} size={17} color={catMeta.color} />
                                    </View>
                                    <View>
                                        <CustomText style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600', letterSpacing: 0.5 }}>SELECTED CATEGORY</CustomText>
                                        <CustomText style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{form.category}</CustomText>
                                    </View>
                                </View>
                            </View>

                            {/* Contact number */}
                            <View style={{ marginTop: 8 }}>
                                <FormField
                                    label="Contact Number"
                                    placeholder="+63 9XX XXX XXXX"
                                    value={form.phone}
                                    onChangeText={v => setForm(f => ({ ...f, phone: v }))}
                                    keyboardType="phone-pad"
                                    icon="call-outline"
                                    required
                                    isInvalid={isPhoneInvalid}
                                />
                            </View>

                            {/* Facebook */}
                            <FormField
                                label="Facebook"
                                placeholder="e.g. Blooms and Co. PH"
                                value={form.facebook}
                                onChangeText={v => setForm(f => ({ ...f, facebook: v }))}
                                icon="logo-facebook"
                            />

                            {/* Location */}
                            <FormField
                                label="Location"
                                placeholder="e.g. Quezon City, Metro Manila"
                                value={form.location}
                                onChangeText={v => setForm(f => ({ ...f, location: v }))}
                                icon="location-outline"
                                required
                                isInvalid={isLocationInvalid}
                            />
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 34 : 20, gap: 10, borderTopWidth: 1, borderTopColor: '#E8EEF4', backgroundColor: '#F0F4F8' }}>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSubmitting}
                            activeOpacity={0.85}
                            style={{
                                height: 56, borderRadius: 18,
                                backgroundColor: isEditing ? '#10B981' : TEAL,
                                alignItems: 'center', justifyContent: 'center',
                                flexDirection: 'row', gap: 8,
                                shadowColor: isEditing ? '#10B981' : TEAL_DARK,
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                                opacity: isSubmitting ? 0.75 : 1,
                            }}
                        >
                            {isSubmitting
                                ? <ActivityIndicator color="#fff" />
                                : <>
                                    <Ionicons name={isEditing ? 'checkmark-circle-outline' : 'person-add-outline'} size={18} color="#fff" />
                                    <CustomText style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                                        {isEditing ? 'Update Vendor' : 'Add Vendor'}
                                    </CustomText>
                                  </>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ height: 46, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Ionicons name="close-outline" size={15} color="#64748B" />
                            <CustomText style={{ color: '#64748B', fontSize: 14, fontWeight: '700' }}>Cancel</CustomText>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}