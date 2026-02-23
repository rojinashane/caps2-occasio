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
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentVenueId, setCurrentVenueId] = useState(null);
    
    // Form State
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

    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dgvbemrgw/image/upload';
    const UPLOAD_PRESET = 'venues';

    useEffect(() => {
        const q = query(collection(db, 'venues'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const venueList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVenues(venueList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setNewName(''); setNewLocation(''); setNewCapacity(''); setNewPrice('');
        setNewDescription(''); setImageLink(''); setSelectedImage(null);
        setPhone(''); setFbPage(''); setIgHandle(''); setSelectedModel(null);
        setIsEditing(false); setCurrentVenueId(null);
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
        setCurrentVenueId(item.id);
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleDelete = (venueId) => {
        Alert.alert("Delete Venue", "Are you sure you want to remove this venue permanently?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await deleteDoc(doc(db, 'venues', venueId));
                } catch (e) { Alert.alert("Error", "Could not delete venue."); }
            }}
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
        const data = new FormData();
        data.append('file', { 
            uri: file.uri, 
            type: type === 'image' ? 'image/jpeg' : 'application/octet-stream', 
            name: file.name || (type === 'image' ? 'upload.jpg' : 'model.glb') 
        });
        data.append('upload_preset', UPLOAD_PRESET);
        const response = await fetch(CLOUDINARY_URL, { method: 'POST', body: data });
        const result = await response.json();
        return result.secure_url;
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
            Alert.alert("Error", "Transaction failed.");
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

                <View style={tw`flex-row`}>
                    <TouchableOpacity
                        style={tw`flex-1 py-3.5 mr-3 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center`}
                        onPress={() => handleEditPress(item)}
                    >
                        <CustomText style={tw`text-slate-600 font-bold text-[14px]`}>Edit Details</CustomText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={tw`flex-1 flex-row py-3.5 rounded-2xl bg-[#00686F] items-center justify-center`}
                        onPress={() => navigation.navigate('ARVenue', { venueId: item.id, venueName: item.name })}
                    >
                        <Ionicons name="walk" size={18} color="#FFF" />
                        <CustomText style={tw`text-white font-bold text-[14px] ml-2`}>Test AR</CustomText>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`}>
            <StatusBar barStyle="dark-content" />
            <View style={tw`px-6 py-4 flex-row justify-between items-center`}>
                <View>
                    <CustomText style={tw`text-2xl font-bold text-slate-800`}>Admin Console</CustomText>
                    <CustomText style={tw`text-[#94A3B8] text-sm`}>Manage Published Venues</CustomText>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`p-2 bg-white rounded-full shadow-sm`}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator size="large" color="#00686F" style={tw`mt-20`} /> : (
                <FlatList
                    data={venues}
                    keyExtractor={item => item.id}
                    renderItem={renderVenueCard}
                    contentContainerStyle={tw`px-6 pb-24`}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={tw`bg-white rounded-t-[32px] max-h-[90%]`}>
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

                                <CustomText style={tw`text-xs font-bold text-slate-400 mt-4 mb-2 uppercase`}>Contact Details</CustomText>
                                <TextInput style={styles.input} placeholder="Contact Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Facebook Page URL" value={fbPage} onChangeText={setFbPage} />
                                <TextInput style={[styles.input, tw`mt-3`]} placeholder="Instagram Handle (@...)" value={igHandle} onChangeText={setIgHandle} />

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

            <TouchableOpacity 
                style={tw`absolute bottom-8 right-6 w-16 h-16 rounded-2xl bg-[#00686F] items-center justify-center shadow-lg`}
                onPress={() => { setIsEditing(false); setModalVisible(true); }}
            >
                <Ionicons name="add" size={32} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = {
    input: tw`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800`
};