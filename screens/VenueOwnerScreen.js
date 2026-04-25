import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    StatusBar,
    ActivityIndicator,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import {
    collection, onSnapshot, query, addDoc,
    updateDoc, deleteDoc, doc, serverTimestamp,
    where, getDoc,
} from 'firebase/firestore';
import CustomText from '../components/CustomText';
import tw from 'twrnc';
import AddVenue, { emptyVenueForm } from '../components/AddVenue';
import AddVendor, { emptyVendorForm, VENDOR_CATEGORIES } from '../components/AddVendor';
import GuideModal from '../components/GuideModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const CLOUD_NAME    = 'dgvbemrgw';
const UPLOAD_PRESET = 'venues';
const TEAL        = '#00686F';
const TEAL_DARK   = '#004E54';
const TEAL_LIGHT  = '#F0F9FA';
const TEAL_MID    = '#E0F2F3';
const TEAL_BORDER = '#B2DEDE';
const { width } = Dimensions.get('window');



// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, bg }) {
    return (
        <View style={[
            tw`flex-1 rounded-[18px] p-4 items-center`,
            { backgroundColor: bg, borderWidth: 1, borderColor: color + '25' },
        ]}>
            <View style={[tw`w-10 h-10 rounded-full items-center justify-center mb-2`, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <CustomText style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', lineHeight: 26 }}>{value}</CustomText>
            <CustomText style={{ fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' }}>{label}</CustomText>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function VenueOwnerScreen({ navigation }) {
    const [venues, setVenues]  = useState([]);
    const [vendors, setVendors] = useState([]);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('venues');
    const [greeting, setGreeting] = useState('');

    // Venue modal
    const [venueModalVisible, setVenueModalVisible] = useState(false);
    const [isEditing, setIsEditing]   = useState(false);
    const [currentVenueId, setCurrentVenueId] = useState(null);
    const [venueForm, setVenueForm]   = useState(emptyVenueForm());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Vendor modal
    const [vendorModalVisible, setVendorModalVisible] = useState(false);
    const [isEditingVendor, setIsEditingVendor]     = useState(false);
    const [currentVendorId, setCurrentVendorId]     = useState(null);
    const [vendorForm, setVendorForm]               = useState(emptyVendorForm());

    // Guide modal
    const [guideModalVisible, setGuideModalVisible] = useState(false);

    // FAB & filter
    const [fabMenuVisible, setFabMenuVisible]     = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Drawer States
    const [menuVisible, setMenuVisible]   = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // Animations
    const fadeAnim   = useRef(new Animated.Value(0)).current;
    const slideAnim  = useRef(new Animated.Value(width)).current;
    const heroSlide  = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        const h = new Date().getHours();
        if (h < 12)      { setGreeting('Good morning'); }
        else if (h < 18) { setGreeting('Good afternoon'); }
        else             { setGreeting('Good evening'); }
    }, []);

    useEffect(() => {
        if (!auth.currentUser) return;
        const uid = auth.currentUser.uid;

        getDoc(doc(db, 'users', uid)).then(snap => {
            if (snap.exists()) setUserData(snap.data());
        });

        const qV = query(collection(db, 'venues'), where('userId', '==', uid));
        const unsubV = onSnapshot(qV, snap => {
            setVenues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
            Animated.parallel([
                Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
                Animated.spring(heroSlide, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
            ]).start();
        });

        const qVd = query(collection(db, 'vendors'), where('userId', '==', uid));
        const unsubVd = onSnapshot(qVd, snap => {
            setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubV(); unsubVd(); };
    }, []);

    const toggleMenu = (open) => {
        if (open) {
            setMenuVisible(true);
            Animated.timing(slideAnim, { toValue: width * 0.25, duration: 300, useNativeDriver: true }).start();
        } else {
            Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true })
                .start(() => setMenuVisible(false));
        }
    };

    const handleLogout = () => {
        toggleMenu(false);
        setTimeout(() => setLogoutModalVisible(true), 280);
    };

    const confirmLogout = async () => {
        setLoggingOut(true);
        try {
            await signOut(auth);
            navigation.replace('Landing');
        } catch {
            Alert.alert('Error', 'Failed to logout.');
        } finally {
            setLoggingOut(false);
            setLogoutModalVisible(false);
        }
    };

    const filteredVendors = selectedCategory === 'All'
        ? vendors
        : vendors.filter(v => v.category === selectedCategory);

    // ── Upload ────────────────────────────────────────────────────────────────
    const uploadFile = async (file, type = 'image') => {
        const isModel = type === 'auto';
        const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isModel ? 'raw' : 'image'}/upload`;
        const data = new FormData();
        data.append('file', {
            uri: file.uri,
            type: isModel ? 'application/octet-stream' : 'image/jpeg',
            name: file.name || (isModel ? 'model.glb' : 'upload.jpg'),
        });
        data.append('upload_preset', UPLOAD_PRESET);
        if (isModel) data.append('chunk_size', '6000000');
        const res = await fetch(endpoint, {
            method: 'POST', body: data,
            headers: { 'Accept': 'application/json', 'Content-Type': 'multipart/form-data' },
        });
        const json = await res.json();
        if (!json.secure_url) throw new Error(json.error?.message || 'Upload failed');
        return json.secure_url;
    };

    // ── Save venue ────────────────────────────────────────────────────────────
    const handleSaveVenue = async (form) => {
        setIsSubmitting(true);
        try {
            let finalImageUrl = form.imageLink;
            if (form.selectedImage) finalImageUrl = await uploadFile(form.selectedImage, 'image');

            let modelUrl = null;
            if (form.selectedModel) modelUrl = await uploadFile(form.selectedModel, 'auto');

            const venueData = {
                name: form.name,
                location: form.location,
                capacity: form.capacity ? `${form.capacity} Pax` : 'N/A',
                price: form.price ? `₱${form.price} / day` : 'Price on Request',
                description: form.description,
                contact: { phone: form.phone, facebook: form.fbPage, instagram: form.igHandle },
                amenities: form.amenities,
                image: finalImageUrl,
                updatedAt: serverTimestamp(),
            };

            if (modelUrl) {
                venueData.hasAR = true;
                venueData.modelUrl = modelUrl;
            } else if (isEditing) {
                const old = venues.find(v => v.id === currentVenueId);
                venueData.hasAR = old?.hasAR || false;
                if (old?.modelUrl) venueData.modelUrl = old.modelUrl;
            } else {
                venueData.hasAR = false;
            }

            if (isEditing) {
                await updateDoc(doc(db, 'venues', currentVenueId), venueData);
            } else {
                await addDoc(collection(db, 'venues'), {
                    ...venueData, userId: auth.currentUser?.uid, createdAt: serverTimestamp(),
                });
            }

            setVenueModalVisible(false);
            Alert.alert('Success', isEditing ? 'Venue updated!' : 'Venue published!');
        } catch (err) {
            Alert.alert('Error', err.message || 'Something went wrong.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Edit venue ────────────────────────────────────────────────────────────
    const handleEditVenuePress = (item) => {
        setVenueForm({
            name: item.name || '',
            location: item.location || '',
            capacity: item.capacity ? item.capacity.replace(' Pax', '') : '',
            price: item.price ? item.price.replace(/[^\d]/g, '') : '',
            description: item.description || '',
            imageLink: item.image || '',
            selectedImage: null,
            phone: item.contact?.phone || '',
            fbPage: item.contact?.facebook || '',
            igHandle: item.contact?.instagram || '',
            amenities: item.amenities || [],
            selectedModel: null,
        });
        setCurrentVenueId(item.id);
        setIsEditing(true);
        setVenueModalVisible(true);
    };

    const handleDeleteVenue = (id) => {
        Alert.alert('Delete Venue', 'Remove this venue permanently?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await deleteDoc(doc(db, 'venues', id)); }
                    catch (err) { Alert.alert('Error', err.message); }
                },
            },
        ]);
    };

    // ── Vendor helpers ────────────────────────────────────────────────────────
    const resetVendorForm = () => {
        setVendorForm(emptyVendorForm());
        setIsEditingVendor(false); setCurrentVendorId(null);
    };

    const handleEditVendorPress = (item) => {
        setVendorForm({
            name:     item.name     || '',
            category: item.category || 'Unassigned',
            phone:    item.phone    || '',
            facebook: item.facebook || '',
            location: item.location || '',
        });
        setCurrentVendorId(item.id);
        setIsEditingVendor(true);
        setVendorModalVisible(true);
    };

    const handleDeleteVendor = (id) => {
        Alert.alert('Delete Vendor', 'Remove this vendor?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try { await deleteDoc(doc(db, 'vendors', id)); }
                    catch (err) { Alert.alert('Error', err.message); }
                },
            },
        ]);
    };

    const handleSaveVendor = async (form) => {
        setIsSubmitting(true);
        try {
            const data = {
                name:     form.name.trim(),
                category: form.category,
                phone:    form.phone.trim(),
                facebook: form.facebook.trim(),
                location: form.location.trim(),
                updatedAt: serverTimestamp(),
                userId: auth.currentUser?.uid,
            };
            if (isEditingVendor) {
                await updateDoc(doc(db, 'vendors', currentVendorId), data);
            } else {
                await addDoc(collection(db, 'vendors'), { ...data, createdAt: serverTimestamp() });
            }
            setVendorModalVisible(false);
            resetVendorForm();
            Alert.alert('Success', isEditingVendor ? 'Vendor updated!' : 'Vendor added!');
        } catch (err) {
            Alert.alert('Error', err.message || 'Something went wrong.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── AR count ──────────────────────────────────────────────────────────────
    const arCount = venues.filter(v => v.hasAR).length;

    // ── Derived greeting name ─────────────────────────────────────────────────
    const firstName = (
        userData?.firstName ||
        userData?.name?.split(' ')[0] ||
        userData?.username ||
        auth.currentUser?.displayName?.split(' ')[0] ||
        'there'
    );

    const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
    });

    // ── Render cards ──────────────────────────────────────────────────────────
    const renderVenueCard = ({ item }) => (
        <View style={[
            tw`bg-white rounded-[22px] mb-4 overflow-hidden`,
            { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 3 },
        ]}>
            {item.image ? (
                <Image source={{ uri: item.image }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
            ) : (
                <View style={[tw`w-full h-24 items-center justify-center`, { backgroundColor: TEAL_MID }]}>
                    <Ionicons name="business-outline" size={36} color={TEAL + '60'} />
                </View>
            )}

            {item.hasAR && (
                <View style={{
                    position: 'absolute', top: 12, right: 12,
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: 'rgba(0,104,111,0.9)', paddingHorizontal: 10,
                    paddingVertical: 4, borderRadius: 20,
                }}>
                    <Ionicons name="cube-outline" size={12} color="#fff" />
                    <CustomText style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>AR</CustomText>
                </View>
            )}

            <View style={tw`p-4`}>
                <CustomText style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 }} numberOfLines={1}>
                    {item.name}
                </CustomText>
                <View style={tw`flex-row items-center mb-3`}>
                    <Ionicons name="location-outline" size={12} color="#94A3B8" />
                    <CustomText style={tw`text-xs text-slate-400 ml-1`} numberOfLines={1}>{item.location}</CustomText>
                </View>

                <View style={tw`flex-row gap-2 mb-4`}>
                    <View style={[tw`flex-row items-center px-3 py-1.5 rounded-full`, { backgroundColor: TEAL_LIGHT }]}>
                        <Ionicons name="people-outline" size={12} color={TEAL} />
                        <CustomText style={{ color: TEAL, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>{item.capacity}</CustomText>
                    </View>
                    <View style={[tw`flex-row items-center px-3 py-1.5 rounded-full`, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="pricetag-outline" size={12} color="#D97706" />
                        <CustomText style={{ color: '#D97706', fontSize: 11, fontWeight: '600', marginLeft: 4 }}>{item.price}</CustomText>
                    </View>
                </View>

                {item.amenities?.length > 0 && (
                    <View style={tw`flex-row flex-wrap gap-1.5 mb-4`}>
                        {item.amenities.slice(0, 3).map((a, i) => (
                            <View key={i} style={tw`bg-slate-100 px-2.5 py-1 rounded-lg`}>
                                <CustomText style={tw`text-[10px] text-slate-500 font-bold`}>{a}</CustomText>
                            </View>
                        ))}
                        {item.amenities.length > 3 && (
                            <View style={tw`bg-slate-100 px-2.5 py-1 rounded-lg`}>
                                <CustomText style={tw`text-[10px] text-slate-400 font-bold`}>+{item.amenities.length - 3} more</CustomText>
                            </View>
                        )}
                    </View>
                )}

                <View style={tw`flex-row gap-2`}>
                    <TouchableOpacity
                        style={[tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-1.5`, { backgroundColor: TEAL_LIGHT, borderWidth: 1, borderColor: TEAL_BORDER }]}
                        onPress={() => handleEditVenuePress(item)}
                    >
                        <Ionicons name="create-outline" size={14} color={TEAL} />
                        <CustomText style={{ color: TEAL, fontSize: 13, fontWeight: '700' }}>Edit</CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={tw`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-1.5 bg-red-50 border border-red-100`}
                        onPress={() => handleDeleteVenue(item.id)}
                    >
                        <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        <CustomText style={tw`text-red-500 text-[13px] font-bold`}>Delete</CustomText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderVendorCard = ({ item }) => (
        <View style={[
            tw`bg-white rounded-[20px] p-4 mb-4`,
            { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
        ]}>
            <View style={tw`flex-row justify-between items-start`}>
                <View style={[tw`w-12 h-12 rounded-2xl items-center justify-center mr-3`, { backgroundColor: TEAL_LIGHT }]}>
                    <Ionicons name="people-outline" size={22} color={TEAL} />
                </View>
                <View style={tw`flex-1`}>
                    <CustomText style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 3 }}>{item.name}</CustomText>
                    <View style={tw`flex-row items-center flex-wrap gap-1.5 mb-1`}>
                        <View style={[tw`px-2.5 py-0.5 rounded-lg`, { backgroundColor: TEAL + '15' }]}>
                            <CustomText style={{ fontSize: 10, color: TEAL, fontWeight: '700', textTransform: 'uppercase' }}>{item.category}</CustomText>
                        </View>
                    </View>
                    {item.phone && (
                        <View style={tw`flex-row items-center mt-1`}>
                            <Ionicons name="call-outline" size={11} color="#94A3B8" />
                            <CustomText style={tw`text-xs text-slate-400 ml-1`}>{item.phone}</CustomText>
                        </View>
                    )}
                    {item.location && (
                        <View style={tw`flex-row items-center mt-0.5`}>
                            <Ionicons name="location-outline" size={11} color="#94A3B8" />
                            <CustomText style={tw`text-xs text-slate-400 ml-1`}>{item.location}</CustomText>
                        </View>
                    )}
                </View>
                <View style={tw`flex-row gap-2`}>
                    <TouchableOpacity
                        style={[tw`p-2.5 rounded-xl`, { backgroundColor: TEAL_LIGHT, borderWidth: 1, borderColor: TEAL_BORDER }]}
                        onPress={() => handleEditVendorPress(item)}
                    >
                        <Ionicons name="create-outline" size={18} color={TEAL} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={tw`bg-red-50 p-2.5 rounded-xl border border-red-100`}
                        onPress={() => handleDeleteVendor(item.id)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: '#F0F4F8' }]} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* ── HEADER ───────────────────────────────────────────────────── */}
            <View style={[
                tw`px-5 pt-3 pb-3 flex-row items-center justify-between`,
                { backgroundColor: '#F0F4F8', borderBottomWidth: 1, borderBottomColor: '#E8EEF4' },
            ]}>
                <View style={tw`flex-1`}>
                    <CustomText style={{ color: TEAL, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 }}>OCCASIO</CustomText>
                    <View style={tw`flex-row items-center mt-0.5`}>
                        <CustomText style={{ color: '#0F172A', fontSize: 21, fontWeight: '800' }}>
                            {greeting},{' '}
                        </CustomText>
                        <CustomText style={{ color: TEAL, fontSize: 21, fontWeight: '800' }}>
                            {firstName}
                        </CustomText>
                    </View>
                    <CustomText style={{ color: '#94A3B8', fontSize: 11, marginTop: 1 }}>{todayStr}</CustomText>
                </View>
                <View style={tw`flex-row items-center gap-2`}>
                    <TouchableOpacity
                        onPress={() => toggleMenu(true)}
                        style={[
                            tw`w-10 h-10 rounded-full justify-center items-center`,
                            { backgroundColor: TEAL_MID, borderWidth: 1, borderColor: TEAL + '30' },
                        ]}
                    >
                        <Ionicons name="menu-outline" size={22} color={TEAL} />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={activeTab === 'venues' ? venues : filteredVendors}
                keyExtractor={item => item.id}
                renderItem={activeTab === 'venues' ? renderVenueCard : renderVendorCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={tw`px-5 pb-28`}
                ListHeaderComponent={
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: heroSlide }] }}>
                        {/* ── WELCOME HERO CARD ─────────────────────── */}
                        <View style={[
                            tw`rounded-[26px] mt-4 mb-5 overflow-hidden`,
                            { shadowColor: TEAL, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 6 },
                        ]}>
                            <View style={{ backgroundColor: TEAL_LIGHT }}>
                                <View style={{ height: 5, backgroundColor: TEAL, borderTopLeftRadius: 26, borderTopRightRadius: 26 }} />
                                <View style={tw`p-5`}>
                                    <View style={tw`flex-row items-center mb-3`}>
                                        <View style={[tw`flex-row items-center px-3 py-1 rounded-full`, { backgroundColor: TEAL + '18' }]}>
                                            <View style={[tw`w-1.5 h-1.5 rounded-full mr-1.5`, { backgroundColor: TEAL }]} />
                                            <CustomText style={{ color: TEAL, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                                                VENUE OWNER DASHBOARD
                                            </CustomText>
                                        </View>
                                    </View>
                                    <CustomText style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', lineHeight: 26, marginBottom: 8 }}>
                                        Your venues are{'\n'}looking great!
                                    </CustomText>
                                    <CustomText style={{ fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 16 }}>
                                        Manage your listings, track your vendors, and keep your portfolio up to date — all in one place.
                                    </CustomText>

                                    <View style={tw`flex-row gap-3`}>
                                        <StatCard icon="business-outline" value={venues.length} label="Venues Listed" color={TEAL} bg="#ffffff" />
                                        <StatCard icon="cube-outline" value={arCount} label="AR Enabled" color="#7C3AED" bg="#F5F3FF" />
                                        <StatCard icon="people-outline" value={vendors.length} label="Vendors" color="#D97706" bg="#FFFBEB" />
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => {
                                            setIsEditing(false); setCurrentVenueId(null);
                                            setVenueForm(emptyVenueForm());
                                            setVenueModalVisible(true);
                                        }}
                                        style={[
                                            tw`flex-row items-center justify-center mt-4 py-3 rounded-[14px] gap-2`,
                                            { backgroundColor: TEAL, shadowColor: TEAL_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
                                        ]}
                                    >
                                        <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                                        <CustomText style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Add New Venue</CustomText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* ── TABS ─────────────────────────────────────── */}
                        <View style={[tw`flex-row rounded-2xl p-1 mb-4`, { backgroundColor: '#E8EEF4' }]}>
                            {['venues', 'vendors'].map(tab => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab)}
                                    style={[
                                        tw`flex-1 py-2.5 rounded-xl items-center`,
                                        activeTab === tab && { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
                                    ]}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons
                                            name={tab === 'venues' ? 'business-outline' : 'people-outline'}
                                            size={14}
                                            color={activeTab === tab ? TEAL : '#94A3B8'}
                                        />
                                        <CustomText style={{ fontSize: 13, fontWeight: '700', color: activeTab === tab ? TEAL : '#94A3B8' }}>
                                            {tab === 'venues' ? 'Venues' : 'Vendors'}
                                        </CustomText>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* ── VENDOR CATEGORY FILTER ───────────────── */}
                        {activeTab === 'vendors' && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`pb-3 pr-4`}>
                                {['All', ...VENDOR_CATEGORIES].map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setSelectedCategory(cat)}
                                        style={[
                                            tw`mr-2 px-4 py-2 rounded-full border`,
                                            selectedCategory === cat
                                                ? { backgroundColor: TEAL, borderColor: TEAL }
                                                : { backgroundColor: '#fff', borderColor: '#E2E8F0' },
                                        ]}
                                    >
                                        <CustomText style={{ color: selectedCategory === cat ? '#fff' : '#64748B', fontSize: 12, fontWeight: '700' }}>
                                            {cat}
                                        </CustomText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}

                        <View style={tw`flex-row items-center justify-between mb-3`}>
                            <CustomText style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                                {activeTab === 'venues' ? 'Your Venues' : 'Your Vendors'}
                            </CustomText>
                            <CustomText style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>
                                {activeTab === 'venues' ? venues.length : filteredVendors.length} listed
                            </CustomText>
                        </View>
                    </Animated.View>
                }
                ListEmptyComponent={
                    loading ? (
                        <ActivityIndicator size="large" color={TEAL} style={tw`mt-10`} />
                    ) : (
                        <View style={[tw`rounded-[20px] p-8 items-center`, { backgroundColor: '#fff' }]}>
                            <View style={[tw`w-16 h-16 rounded-full items-center justify-center mb-3`, { backgroundColor: TEAL_LIGHT }]}>
                                <Ionicons name={activeTab === 'venues' ? 'business-outline' : 'people-outline'} size={32} color={TEAL + '80'} />
                            </View>
                            <CustomText style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>
                                No {activeTab} yet
                            </CustomText>
                            <CustomText style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center' }}>
                                Tap the + button below to add your first {activeTab === 'venues' ? 'venue' : 'vendor'}.
                            </CustomText>
                        </View>
                    )
                }
            />

            {/* ── Add / Edit Venue Modal (from components/AddVenue) ────────── */}
            <AddVenue
                visible={venueModalVisible}
                onClose={() => { setVenueModalVisible(false); setIsEditing(false); setCurrentVenueId(null); }}
                isEditing={isEditing}
                initialForm={venueForm}
                onSave={handleSaveVenue}
                isSubmitting={isSubmitting}
            />

            {/* ── Add / Edit Vendor Modal ─────────────────────────────────── */}
            <AddVendor
                visible={vendorModalVisible}
                onClose={() => { setVendorModalVisible(false); resetVendorForm(); }}
                isEditing={isEditingVendor}
                initialForm={vendorForm}
                onSave={handleSaveVendor}
                isSubmitting={isSubmitting}
            />

                        {/* ── SIDE DRAWER ──────────────────────────────────────────────── */}
            {menuVisible && (
                <View style={tw`absolute inset-0 z-50`} pointerEvents="box-none">
                    <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
                        <View style={tw`absolute inset-0 bg-slate-900/40`} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[
                        tw`absolute top-0 right-0 bottom-0 bg-white rounded-l-[32px] px-6 pt-16`,
                        { width: width * 0.75, transform: [{ translateX: slideAnim }], shadowColor: '#000', shadowOffset: { width: -10, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, marginRight: 20 },
                    ]}>
                        <View style={tw`flex-row justify-between items-center pb-6 border-b border-slate-100`}>
                            <View>
                                <CustomText style={{ color: TEAL, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>OCCASIO</CustomText>
                                <CustomText style={tw`text-xl font-bold text-slate-800`}>Menu</CustomText>
                            </View>
                            <TouchableOpacity onPress={() => toggleMenu(false)} style={[tw`p-2 rounded-full`, { backgroundColor: TEAL_LIGHT }]}>
                                <Ionicons name="close" size={20} color={TEAL} />
                            </TouchableOpacity>
                        </View>
                        <View style={tw`mt-6`}>
                            <TouchableOpacity style={tw`flex-row items-center py-4`} onPress={() => { toggleMenu(false); navigation.navigate('VenueOwnerProfile'); }}>
                                <View style={[tw`w-12 h-12 rounded-2xl justify-center items-center mr-4`, { backgroundColor: TEAL_MID }]}>
                                    <Ionicons name="person-outline" size={20} color={TEAL} />
                                </View>
                                <View>
                                    <CustomText style={tw`text-[16px] font-bold text-slate-700`}>Profile Settings</CustomText>
                                    <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 1 }}>Manage your account</CustomText>
                                </View>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />

                            <TouchableOpacity
                                style={tw`flex-row items-center py-4`}
                                onPress={() => { toggleMenu(false); setTimeout(() => setGuideModalVisible(true), 300); }}
                            >
                                <View style={[tw`w-12 h-12 rounded-2xl justify-center items-center mr-4`, { backgroundColor: '#EFF6FF' }]}>
                                    <Ionicons name="book-outline" size={20} color="#1D4ED8" />
                                </View>
                                <View>
                                    <CustomText style={[tw`text-[16px] font-bold`, { color: '#1D4ED8' }]}>Scaniverse Guide</CustomText>
                                    <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 1 }}>Learn how to 3D scan your venue</CustomText>
                                </View>
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />

                            <TouchableOpacity style={tw`flex-row items-center py-4`} onPress={handleLogout}>
                                <View style={tw`w-12 h-12 rounded-2xl bg-red-50 justify-center items-center mr-4`}>
                                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                                </View>
                                <View>
                                    <CustomText style={tw`text-[16px] font-bold text-red-500`}>Log Out</CustomText>
                                    <CustomText style={{ fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 1 }}>Sign out of your account</CustomText>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            )}

            {/* ── SCANIVERSE GUIDE MODAL ───────────────────────────────────── */}
            <GuideModal visible={guideModalVisible} onClose={() => setGuideModalVisible(false)} />

            {/* ── LOGOUT CONFIRMATION MODAL ─────────────────────────────────── */}
            <Modal
                visible={logoutModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => !loggingOut && setLogoutModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => !loggingOut && setLogoutModalVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
                        <TouchableWithoutFeedback>
                            <View style={{ width: '100%', backgroundColor: '#FFF', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 40, elevation: 24 }}>
                                <View style={{ flexDirection: 'row', height: 5 }}>
                                    <View style={{ flex: 1, backgroundColor: TEAL }} />
                                    <View style={{ flex: 1, backgroundColor: '#EF4444' }} />
                                </View>
                                <View style={{ paddingHorizontal: 28, paddingTop: 30, paddingBottom: 26, alignItems: 'center' }}>
                                    <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 22, borderWidth: 1.5, borderColor: '#FECACA' }}>
                                        <Ionicons name="log-out-outline" size={36} color="#EF4444" />
                                    </View>
                                    <CustomText style={{ fontSize: 23, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 10 }}>Leaving so soon?</CustomText>
                                    <CustomText style={{ fontSize: 14, fontWeight: '500', color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 4 }}>
                                        You'll need to sign in again to access your venues and vendors.
                                    </CustomText>
                                    <TouchableOpacity
                                        onPress={confirmLogout}
                                        disabled={loggingOut}
                                        activeOpacity={0.85}
                                        style={{
                                            width: '100%', height: 54, borderRadius: 17, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: 11, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 14, elevation: 8, opacity: loggingOut ? 0.75 : 1,
                                        }}
                                    >
                                        {loggingOut ? (
                                            <ActivityIndicator color="#FFF" size="small" />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Ionicons name="log-out-outline" size={19} color="#FFF" />
                                                <CustomText style={{ color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 }}>Yes, Log Out</CustomText>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setLogoutModalVisible(false)}
                                        disabled={loggingOut}
                                        activeOpacity={0.8}
                                        style={{ width: '100%', height: 54, borderRadius: 17, backgroundColor: TEAL_LIGHT, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: TEAL + '35' }}
                                    >
                                        <CustomText style={{ color: TEAL, fontSize: 15, fontWeight: '800' }}>Stay Signed In</CustomText>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* ── FAB menu ─────────────────────────────────────────────────── */}
            <Modal visible={fabMenuVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={tw`flex-1 bg-black/40 justify-end items-end p-6`}
                    activeOpacity={1}
                    onPress={() => setFabMenuVisible(false)}
                >
                    <View style={tw`items-end mb-4 gap-4`}>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`px-4 py-2 rounded-2xl mr-3 shadow-sm`, { backgroundColor: '#fff' }]}>
                                <CustomText style={tw`text-slate-700 font-bold`}>Add New Vendor</CustomText>
                            </View>
                            <TouchableOpacity
                                style={[tw`w-13 h-13 rounded-2xl items-center justify-center shadow-lg`, { backgroundColor: '#fff', width: 52, height: 52 }]}
                                onPress={() => { setFabMenuVisible(false); resetVendorForm(); setIsEditingVendor(false); setVendorModalVisible(true); }}
                            >
                                <Ionicons name="people" size={24} color={TEAL} />
                            </TouchableOpacity>
                        </View>
                        <View style={tw`flex-row items-center`}>
                            <View style={[tw`px-4 py-2 rounded-2xl mr-3 shadow-sm`, { backgroundColor: '#fff' }]}>
                                <CustomText style={tw`text-slate-700 font-bold`}>Add New Venue</CustomText>
                            </View>
                            <TouchableOpacity
                                style={[tw`items-center justify-center shadow-lg`, { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff' }]}
                                onPress={() => {
                                    setFabMenuVisible(false);
                                    setIsEditing(false); setCurrentVenueId(null);
                                    setVenueForm(emptyVenueForm());
                                    setVenueModalVisible(true);
                                }}
                            >
                                <Ionicons name="business" size={24} color={TEAL} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[tw`items-center justify-center shadow-lg`, { width: 60, height: 60, borderRadius: 18, backgroundColor: '#EF4444' }]}
                            onPress={() => setFabMenuVisible(false)}
                        >
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {!fabMenuVisible && (
                <TouchableOpacity
                    style={[
                        tw`absolute bottom-8 right-6 items-center justify-center shadow-lg`,
                        { width: 60, height: 60, borderRadius: 18, backgroundColor: TEAL,
                          shadowColor: TEAL_DARK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
                    ]}
                    onPress={() => setFabMenuVisible(true)}
                >
                    <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const sharedStyles = {
    input:      tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm`,
    outlineBtn: tw`px-4 py-2.5 rounded-xl border border-slate-200 bg-white`,
    tealBtn:    [tw`px-4 py-2.5 rounded-xl`, { backgroundColor: TEAL }],
};