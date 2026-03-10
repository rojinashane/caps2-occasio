import React, { useState, useEffect } from 'react';
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
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

export default function AdminDashboardScreen({ navigation }) {
    const [venues, setVenues] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [vendorModalVisible, setVendorModalVisible] = useState(false);
    const [fabMenuVisible, setFabMenuVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('venues');
    const [isEditing, setIsEditing] = useState(false);
    const [currentVenueId, setCurrentVenueId] = useState(null);

    // Filter State
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Venue Form State
    const [newName, setNewName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newCapacity, setNewCapacity] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [imageLink, setImageLink] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [phone, setPhone] = useState('');
    const [fbPage, setFbPage] = useState('');
    const [igHandle, setIgHandle] = useState('');
    const [selectedModel, setSelectedModel] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Amenities State
    const [amenities, setAmenities] = useState([]);
    const [currentAmenity, setCurrentAmenity] = useState('');

    // Vendor Form State
    const [vendorName, setVendorName] = useState('');
    const [vendorCategory, setVendorCategory] = useState('Unassigned');
    const [vendorPhone, setVendorPhone] = useState('');
    const [vendorFb, setVendorFb] = useState('');
    const [vendorLocation, setVendorLocation] = useState('');

    const categories = ['Unassigned', 'Attire & Accessories', 'Beauty', 'Music & Show', 'Photo & Video', 'Accessories', 'Flower & Decor', "Catering"];
    const filterCategories = ['All', ...categories];

    const CLOUD_NAME = 'dgvbemrgw';
    const UPLOAD_PRESET = 'venues';

    useEffect(() => {
        const qVenues = query(collection(db, 'venues'));
        const unsubscribeVenues = onSnapshot(qVenues, (snapshot) => {
            const venueList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVenues(venueList);
            setLoading(false);
        });

        const qVendors = query(collection(db, 'vendors'));
        const unsubscribeVendors = onSnapshot(qVendors, (snapshot) => {
            const vendorList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVendors(vendorList);
        });

        return () => {
            unsubscribeVenues();
            unsubscribeVendors();
        };
    }, []);

    const filteredVendors = selectedCategory === 'All'
        ? vendors
        : vendors.filter(v => v.category === selectedCategory);

    const resetForm = () => {
        setNewName(''); setNewLocation(''); setNewCapacity(''); setNewPrice('');
        setNewDescription(''); setImageLink(''); setSelectedImage(null);
        setPhone(''); setFbPage(''); setIgHandle(''); setSelectedModel(null);
        setAmenities([]); setCurrentAmenity('');
        setIsEditing(false); setCurrentVenueId(null);
    };

    const resetVendorForm = () => {
        setVendorName('');
        setVendorCategory('Unassigned');
        setVendorPhone('');
        setVendorFb('');
        setVendorLocation('');
    };

    const handleEditPress = (item) => {
        setNewName(item.name || '');
        setNewLocation(item.location || '');
        setNewCapacity(item.capacity ? item.capacity.replace(' Pax', '') : '');
        setNewPrice(item.price ? item.price.replace(/[^\d]/g, '') : '');
        setNewDescription(item.description || '');
        setImageLink(item.image || '');
        setPhone(item.contact?.phone || '');
        setFbPage(item.contact?.facebook || '');
        setIgHandle(item.contact?.instagram || '');
        setAmenities(item.amenities || []);
        setCurrentVenueId(item.id);
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleDelete = (venueId) => {
        Alert.alert("Delete Venue", "Are you sure you want to remove this venue permanently?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'venues', venueId));
                    } catch (e) { Alert.alert("Error", "Could not delete venue."); }
                }
            }
        ]);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });
        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
            setImageLink('');
        }
    };

    const pickModel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/octet-stream', 'model/gltf-binary', 'model/gltf+json'],
                copyToCacheDirectory: true
            });
            if (!result.canceled) {
                setSelectedModel(result.assets[0]);
            }
        } catch (err) {
            Alert.alert("Error", "Failed to pick model file");
        }
    };

    const uploadFile = async (file, type = 'image') => {
        const isModel = type === 'auto';
        const data = new FormData();
        const resourceType = isModel ? 'raw' : 'image';
        const CLOUDINARY_ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

        data.append('file', {
            uri: file.uri,
            type: isModel ? 'application/octet-stream' : 'image/jpeg',
            name: file.name || (isModel ? 'model.glb' : 'upload.jpg')
        });

        data.append('upload_preset', UPLOAD_PRESET);

        if (isModel) {
            data.append('chunk_size', '6000000');
        }

        const response = await fetch(CLOUDINARY_ENDPOINT, {
            method: 'POST',
            body: data,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data',
            }
        });

        const result = await response.json();
        if (!result.secure_url) throw new Error(result.error?.message || "Upload failed");
        return result.secure_url;
    };

    const handleAddAmenity = () => {
        const trimmed = currentAmenity.trim();
        if (trimmed && !amenities.includes(trimmed)) {
            setAmenities([...amenities, trimmed]);
            setCurrentAmenity('');
        }
    };

    const handleRemoveAmenity = (indexToRemove) => {
        setAmenities(amenities.filter((_, index) => index !== indexToRemove));
    };

    const handleSaveVenue = async () => {
        if (!newName.trim() || !newLocation.trim()) {
            Alert.alert("Required Fields", "Name and Location are required.");
            return;
        }

        setIsSubmitting(true);
        try {
            let finalImageUrl = imageLink;
            if (selectedImage) finalImageUrl = await uploadFile(selectedImage, 'image');

            let modelUrl = null;
            if (selectedModel) modelUrl = await uploadFile(selectedModel, 'auto');

            const venueData = {
                name: newName,
                location: newLocation,
                capacity: newCapacity ? `${newCapacity} Pax` : "N/A",
                price: newPrice ? `₱${newPrice} / day` : "Price on Request",
                description: newDescription,
                contact: {
                    phone: phone || '',
                    facebook: fbPage || '',
                    instagram: igHandle || ''
                },
                amenities: amenities, // Storing array of amenities
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
                    ...venueData,
                    userId: auth.currentUser?.uid,
                    createdAt: serverTimestamp(),
                });
            }

            setModalVisible(false);
            resetForm();
            Alert.alert("Success", isEditing ? "Venue updated!" : "Venue published!");
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.message || "Transaction failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveVendor = async () => {
        if (!vendorName.trim() || !vendorPhone.trim() || !vendorLocation.trim()) {
            Alert.alert("Required Fields", "Name, Phone, and Location are required.");
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'vendors'), {
                name: vendorName,
                category: vendorCategory,
                phone: vendorPhone,
                facebook: vendorFb,
                location: vendorLocation,
                createdAt: serverTimestamp(),
            });

            setVendorModalVisible(false);
            resetVendorForm();
            Alert.alert("Success", "Vendor profile created!");
        } catch (error) {
            Alert.alert("Error", "Failed to save vendor.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderVenueCard = ({ item }) => (
        <View style={[tw`bg-white rounded-[24px] mb-6 overflow-hidden`, { elevation: 3 }]}>
            <View style={tw`relative w-full h-48 bg-slate-200`}>
                <Image source={{ uri: item.image }} style={tw`w-full h-full absolute`} resizeMode="cover" />
                <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={tw`absolute top-4 left-4 bg-red-500 w-10 h-10 rounded-full items-center justify-center shadow-md`}
                >
                    <Ionicons name="trash" size={18} color="#FFF" />
                </TouchableOpacity>
                {item.hasAR && (
                    <View style={tw`absolute top-4 right-4 bg-[#00686F]/90 flex-row items-center px-3 py-1.5 rounded-full`}>
                        <Ionicons name="cube" size={14} color="#FFF" />
                        <CustomText style={tw`text-white text-[11px] ml-1.5 font-bold uppercase`}>AR Ready</CustomText>
                    </View>
                )}
            </View>

            <View style={tw`p-5`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                    <View style={tw`flex-1 mr-4`}>
                        <CustomText style={tw`text-lg text-slate-800 font-bold`} numberOfLines={1}>{item.name}</CustomText>
                        <View style={tw`flex-row items-center mt-1`}>
                            <Ionicons name="location" size={14} color="#00686F" />
                            <CustomText style={tw`text-[13px] text-[#00686F] ml-1`} numberOfLines={1}>{item.location}</CustomText>
                        </View>
                    </View>
                    <View style={tw`bg-[#F0F9FA] px-3 py-2 rounded-xl`}>
                        <CustomText style={tw`text-[13px] text-[#00686F] font-bold`}>
                            {item.price ? item.price.split(' ')[0] : 'N/A'}
                        </CustomText>
                        <CustomText style={tw`text-[10px] text-slate-500 text-center`}>per day</CustomText>
                    </View>
                </View>

                {item.amenities && item.amenities.length > 0 && (
                    <View style={tw`flex-row flex-wrap mb-4`}>
                        {item.amenities.slice(0, 3).map((amenity, idx) => (
                            <View key={idx} style={tw`bg-slate-100 rounded-md px-2 py-1 mr-2 mb-1`}>
                                <CustomText style={tw`text-[10px] text-slate-500`}>{amenity}</CustomText>
                            </View>
                        ))}
                        {item.amenities.length > 3 && (
                            <View style={tw`bg-slate-100 rounded-md px-2 py-1 mr-2 mb-1`}>
                                <CustomText style={tw`text-[10px] text-slate-500`}>+{item.amenities.length - 3} more</CustomText>
                            </View>
                        )}
                    </View>
                )}

                <View style={tw`flex-row`}>
                    <TouchableOpacity
                        style={tw`flex-1 py-3.5 mr-3 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center`}
                        onPress={() => handleEditPress(item)}
                    >
                        <CustomText style={tw`text-slate-600 font-bold text-[14px]`}>Edit Details</CustomText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={tw`flex-1 flex-row py-3.5 rounded-2xl bg-[#00686F] items-center justify-center`}
                        onPress={() => navigation.navigate('ARVenue', {
                            venueId: item.id,
                            venueName: item.name,
                            modelUrl: item.modelUrl,
                            price: item.price,
                            capacity: item.capacity,
                            location: item.location
                        })}
                    >
                        <Ionicons name="walk" size={18} color="#FFF" />
                        <CustomText style={tw`text-white font-bold text-[14px] ml-2`}>Test AR</CustomText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderVendorCard = ({ item }) => (
        <View style={tw`bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm`}>
            <View style={tw`flex-row justify-between items-center`}>
                <View>
                    <CustomText style={tw`text-base font-bold text-slate-800`}>{item.name}</CustomText>
                    <View style={tw`flex-row items-center mt-1`}>
                        <View style={tw`bg-slate-100 px-2 py-0.5 rounded-md mr-2`}>
                            <CustomText style={tw`text-[10px] text-slate-500 uppercase font-bold`}>{item.category}</CustomText>
                        </View>
                        <CustomText style={tw`text-xs text-slate-400`}>{item.location}</CustomText>
                    </View>
                </View>
                <TouchableOpacity style={tw`bg-slate-50 p-2 rounded-full`}>
                    <Ionicons name="call" size={18} color="#00686F" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`}>
            <StatusBar barStyle="dark-content" />
            <View style={tw`px-6 pt-4 flex-row justify-between items-center`}>
                <View>
                    <CustomText style={tw`text-2xl font-bold text-slate-800`}>Admin Console</CustomText>
                    <CustomText style={tw`text-[#94A3B8] text-sm`}>Manage your platform data</CustomText>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2 bg-white rounded-full shadow-sm`}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
            </View>

            <View style={tw`flex-row px-6 mt-6 mb-2`}>
                <TouchableOpacity
                    onPress={() => setActiveTab('venues')}
                    style={tw`mr-4 pb-2 border-b-2 ${activeTab === 'venues' ? 'border-[#00686F]' : 'border-transparent'}`}
                >
                    <CustomText style={tw`font-bold ${activeTab === 'venues' ? 'text-[#00686F]' : 'text-slate-400'}`}>Venues</CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('vendors')}
                    style={tw`pb-2 border-b-2 ${activeTab === 'vendors' ? 'border-[#00686F]' : 'border-transparent'}`}
                >
                    <CustomText style={tw`font-bold ${activeTab === 'vendors' ? 'text-[#00686F]' : 'text-slate-400'}`}>Vendors</CustomText>
                </TouchableOpacity>
            </View>

            {activeTab === 'vendors' && (
                <View style={tw`mb-2`}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={tw`px-6 py-2`}
                    >
                        {filterCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                onPress={() => setSelectedCategory(cat)}
                                style={tw`mr-2 px-4 py-2 rounded-full border ${selectedCategory === cat ? 'bg-[#00686F] border-[#00686F]' : 'bg-white border-slate-200'}`}
                            >
                                <CustomText style={tw`${selectedCategory === cat ? 'text-white' : 'text-slate-500'} text-xs font-bold`}>{cat}</CustomText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {loading ? <ActivityIndicator size="large" color="#00686F" style={tw`mt-20`} /> : (
                <FlatList
                    data={activeTab === 'venues' ? venues : filteredVendors}
                    keyExtractor={item => item.id}
                    renderItem={activeTab === 'venues' ? renderVenueCard : renderVendorCard}
                    contentContainerStyle={tw`px-6 pb-24 pt-2`}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={tw`mt-20 items-center`}>
                            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
                            <CustomText style={tw`text-slate-400 mt-2`}>No {activeTab} found</CustomText>
                        </View>
                    }
                />
            )}

            <Modal visible={fabMenuVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={tw`flex-1 bg-black/40 justify-end items-end p-6`}
                    activeOpacity={1}
                    onPress={() => setFabMenuVisible(false)}
                >
                    <View style={tw`items-end mb-4`}>
                        <View style={tw`flex-row items-center mb-4`}>
                            <View style={tw`bg-white px-3 py-1.5 rounded-lg mr-3 shadow-sm`}>
                                <CustomText style={tw`text-slate-700 font-bold`}>Add New Vendor</CustomText>
                            </View>
                            <TouchableOpacity
                                style={tw`w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg`}
                                onPress={() => { setFabMenuVisible(false); setVendorModalVisible(true); }}
                            >
                                <Ionicons name="people" size={24} color="#00686F" />
                            </TouchableOpacity>
                        </View>

                        <View style={tw`flex-row items-center mb-4`}>
                            <View style={tw`bg-white px-3 py-1.5 rounded-lg mr-3 shadow-sm`}>
                                <CustomText style={tw`text-slate-700 font-bold`}>Add New Venue</CustomText>
                            </View>
                            <TouchableOpacity
                                style={tw`w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg`}
                                onPress={() => { setFabMenuVisible(false); setIsEditing(false); setModalVisible(true); }}
                            >
                                <Ionicons name="business" size={24} color="#00686F" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={tw`w-16 h-16 rounded-2xl bg-red-500 items-center justify-center shadow-lg`}
                            onPress={() => setFabMenuVisible(false)}
                        >
                            <Ionicons name="close" size={32} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={modalVisible} animationType="fade" transparent>
                <View style={tw`flex-1 bg-black/50 justify-center items-center px-6 py-10`}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={tw`w-full`}
                    >
                        <View style={tw`bg-white rounded-[32px] w-full max-h-[90%] overflow-hidden shadow-2xl`}>
                            <ScrollView contentContainerStyle={tw`p-6 pb-12`}>
                                <View style={tw`flex-row justify-between mb-6`}>
                                    <CustomText style={tw`text-xl font-bold`}>{isEditing ? "Edit Venue" : "New Venue"}</CustomText>
                                    <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                                        <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                                    </TouchableOpacity>
                                </View>

                                <TextInput style={styles.input} placeholder="Venue Name" value={newName} onChangeText={setNewName} />
                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Location" value={newLocation} onChangeText={setNewLocation} />

                                <View style={tw`flex-row justify-between mt-3`}>
                                    <TextInput style={[styles.input, { width: '48%' }]} placeholder="Capacity (Pax)" value={newCapacity} onChangeText={setNewCapacity} keyboardType="numeric" />
                                    <TextInput style={[styles.input, { width: '48%' }]} placeholder="Price (Numeric)" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" />
                                </View>

                                <TextInput
                                    style={[styles.input, tw`mt-3 h-24`, { textAlignVertical: 'top' }]}
                                    placeholder="Description"
                                    multiline
                                    value={newDescription}
                                    onChangeText={setNewDescription}
                                />

                                {/* AMENITIES SECTION */}
                                <CustomText style={tw`text-xs font-bold text-slate-400 mt-4 mb-2 uppercase`}>Amenities</CustomText>
                                <View style={tw`flex-row items-center`}>
                                    <TextInput 
                                        style={[styles.input, tw`flex-1 mr-2`]} 
                                        placeholder="E.g., WiFi, Parking, Catering" 
                                        value={currentAmenity} 
                                        onChangeText={setCurrentAmenity}
                                        onSubmitEditing={handleAddAmenity}
                                    />
                                    <TouchableOpacity 
                                        style={tw`bg-[#00686F] w-12 h-12 rounded-xl items-center justify-center shadow-sm`}
                                        onPress={handleAddAmenity}
                                    >
                                        <Ionicons name="add" size={24} color="#FFF" />
                                    </TouchableOpacity>
                                </View>

                                {amenities.length > 0 && (
                                    <View style={tw`flex-row flex-wrap mt-3`}>
                                        {amenities.map((item, index) => (
                                            <View key={index} style={tw`flex-row items-center bg-[#F0F9FA] px-3 py-1.5 rounded-full mr-2 mb-2 border border-[#E0F2F3]`}>
                                                <CustomText style={tw`text-[#00686F] text-xs font-bold mr-1`}>{item}</CustomText>
                                                <TouchableOpacity onPress={() => handleRemoveAmenity(index)}>
                                                    <Ionicons name="close-circle" size={16} color="#00686F" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                <CustomText style={tw`text-xs font-bold text-slate-400 mt-4 mb-2 uppercase`}>Contact Details</CustomText>
                                <TextInput style={styles.input} placeholder="Contact Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                                <View style={tw`h-3`} />
                                <TextInput style={styles.input} placeholder="Facebook Page URL" value={fbPage} onChangeText={setFbPage} />
                                <View style={tw`h-3`} />
                                <TextInput style={styles.input} placeholder="Instagram Handle (@...)" value={igHandle} onChangeText={setIgHandle} />

                                <CustomText style={tw`text-xs font-bold text-slate-400 mt-4 mb-2 uppercase`}>Media & 3D Assets</CustomText>
                                <TextInput style={styles.input} placeholder="Image URL (Optional)" value={imageLink} onChangeText={setImageLink} />

                                <View style={tw`flex-row mt-2`}>
                                    <TouchableOpacity style={tw`flex-1 mr-2 p-4 border-dashed border border-slate-300 rounded-xl items-center`} onPress={pickImage}>
                                        <Ionicons name="image-outline" size={20} color={selectedImage ? "#00686F" : "#64748B"} />
                                        <CustomText style={tw`text-[11px] mt-1 text-slate-500`}>{selectedImage ? "Image Ready" : "Upload Image"}</CustomText>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={tw`flex-1 p-4 border-dashed border border-slate-300 rounded-xl items-center`} onPress={pickModel}>
                                        <Ionicons name="cube-outline" size={20} color={selectedModel ? "#00686F" : "#64748B"} />
                                        <CustomText style={tw`text-[11px] mt-1 text-slate-500`}>{selectedModel ? "Model Ready" : "Upload 3D (.glb)"}</CustomText>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[tw`mt-8 h-14 rounded-2xl items-center justify-center`, { backgroundColor: '#00686F' }]}
                                    onPress={handleSaveVenue}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : <CustomText style={tw`text-white font-bold text-lg`}>{isEditing ? "Update Venue" : "Publish Venue"}</CustomText>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <Modal visible={vendorModalVisible} animationType="fade" transparent>
                <View style={tw`flex-1 bg-black/50 justify-center items-center px-6`}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={tw`w-full`}
                    >
                        <View style={tw`bg-white rounded-[32px] w-full overflow-hidden shadow-2xl`}>
                            <View style={tw`p-6`}>
                                <View style={tw`flex-row justify-between mb-6`}>
                                    <CustomText style={tw`text-xl font-bold`}>New Vendor</CustomText>
                                    <TouchableOpacity onPress={() => { setVendorModalVisible(false); resetVendorForm(); }}>
                                        <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                                    </TouchableOpacity>
                                </View>

                                <TextInput style={styles.input} placeholder="Vendor Name*" value={vendorName} onChangeText={setVendorName} />

                                <CustomText style={tw`text-xs font-bold text-slate-400 mt-4 mb-2 uppercase`}>Category*</CustomText>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`mb-2`}>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            onPress={() => setVendorCategory(cat)}
                                            style={tw`mr-2 px-4 py-2 rounded-full border ${vendorCategory === cat ? 'bg-[#00686F] border-[#00686F]' : 'bg-white border-slate-200'}`}
                                        >
                                            <CustomText style={tw`${vendorCategory === cat ? 'text-white' : 'text-slate-500'} text-xs font-bold`}>{cat}</CustomText>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Contact Number*" value={vendorPhone} onChangeText={setVendorPhone} keyboardType="phone-pad" />
                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Facebook Page URL" value={vendorFb} onChangeText={setVendorFb} />
                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Location*" value={vendorLocation} onChangeText={setVendorLocation} />

                                <TouchableOpacity
                                    style={[tw`mt-8 h-14 rounded-2xl items-center justify-center`, { backgroundColor: '#00686F' }]}
                                    onPress={handleSaveVendor}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? <ActivityIndicator color="#FFF" /> : <CustomText style={tw`text-white font-bold text-lg`}>Add Vendor</CustomText>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {!fabMenuVisible && (
                <TouchableOpacity
                    style={tw`absolute bottom-8 right-6 w-16 h-16 rounded-2xl bg-[#00686F] items-center justify-center shadow-lg`}
                    onPress={() => setFabMenuVisible(true)}
                >
                    <Ionicons name="add" size={32} color="#FFF" />
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = {
    input: tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800`
};