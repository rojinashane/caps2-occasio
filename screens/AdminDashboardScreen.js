import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    StatusBar,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, auth } from '../firebase'; 
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

export default function AdminDashboardScreen({ navigation }) {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal & Form States (Restored here since AddVenue was deleted)
    const [modalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'venues'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const venueList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setVenues(venueList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching venues: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to exit the Admin Console?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Logout", 
                    style: "destructive", 
                    onPress: () => {
                        signOut(auth)
                            .then(() => navigation.replace('Login'))
                            .catch((error) => Alert.alert("Error", error.message));
                    } 
                }
            ]
        );
    };

    const handleCreateVenue = async () => {
        if (!newName.trim() || !newLocation.trim()) {
            Alert.alert("Required", "Please provide a name and location.");
            return;
        }

        setIsSubmitting(true);
        try {
            const docRef = await addDoc(collection(db, 'venues'), {
                name: newName,
                location: newLocation,
                hasAR: false,
                createdAt: serverTimestamp(),
                image: '' 
            });

            const vId = docRef.id;
            const vName = newName;

            // Reset Form
            setNewName('');
            setNewLocation('');
            setModalVisible(false);

            // Navigate to capture
            navigation.navigate('CaptureVenue', { venueId: vId, venueName: vName });

        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderVenueItem = ({ item }) => (
        <View style={styles.venueCard}>
            <View style={tw`w-14 h-14 rounded-2xl bg-[#F0F9FA] justify-center items-center overflow-hidden`}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.venueImage} />
                ) : (
                    <Ionicons name="business" size={24} color="#00686F" />
                )}
            </View>

            <View style={styles.venueInfo}>
                <CustomText style={tw`text-[15px] text-slate-800 font-bold`}>{item.name}</CustomText>
                <View style={styles.statusRow}>
                    <View style={[styles.dot, { backgroundColor: item.hasAR ? '#10B981' : '#F59E0B' }]} />
                    <CustomText style={tw`text-[#94A3B8] text-[12px]`}>
                        {item.hasAR ? 'AR Model Ready' : 'Awaiting Scan'}
                    </CustomText>
                </View>
            </View>

            <TouchableOpacity 
                style={styles.scanBtn}
                onPress={() => navigation.navigate('CaptureVenue', { venueId: item.id, venueName: item.name })}
            >
                <Ionicons name="camera" size={18} color="#FFF" />
                <CustomText style={styles.scanBtnText}>{item.hasAR ? 'Re-scan' : 'Scan'}</CustomText>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
            
            {/* HEADER */}
            <View style={styles.header}>
                <View>
                    <CustomText style={tw`text-2xl font-bold text-slate-800`}>Admin Console</CustomText>
                    <CustomText style={tw`text-[#94A3B8] text-sm`}>Venue & AR Management</CustomText>
                </View>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                    <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                </TouchableOpacity>
            </View>

            {/* STATS */}
            <View style={styles.statsRow}>
                <View style={[styles.statBox, tw`bg-[#F0F9FA]`]}>
                    <CustomText style={tw`text-xl font-bold text-[#00686F]`}>{venues.length}</CustomText>
                    <CustomText style={tw`text-[#00686F] text-xs opacity-70`}>Venues</CustomText>
                </View>
                <View style={[styles.statBox, tw`bg-slate-50`]}>
                    <CustomText style={tw`text-xl font-bold text-slate-700`}>
                        {venues.filter(v => v.hasAR).length}
                    </CustomText>
                    <CustomText style={tw`text-slate-500 text-xs`}>AR Models</CustomText>
                </View>
            </View>

            <View style={tw`px-6 mb-4`}>
                <CustomText style={tw`text-lg font-bold text-slate-800`}>Venue Registry</CustomText>
            </View>

            {loading ? (
                <View style={tw`flex-1 justify-center items-center`}>
                    <ActivityIndicator size="large" color="#00686F" />
                </View>
            ) : (
                <FlatList
                    data={venues}
                    keyExtractor={item => item.id}
                    renderItem={renderVenueItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={tw`items-center mt-20`}>
                            <Ionicons name="business-outline" size={48} color="#CBD5E1" />
                            <CustomText style={tw`text-[#94A3B8] mt-2`}>No venues found.</CustomText>
                        </View>
                    }
                />
            )}

            {/* RESTORED MODAL CONTENT */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContent}
                    >
                        <View style={tw`flex-row justify-between items-center mb-6`}>
                            <CustomText style={tw`text-xl font-bold text-slate-800`}>New Venue Setup</CustomText>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#CBD5E1" />
                            </TouchableOpacity>
                        </View>

                        <CustomText style={tw`text-slate-500 mb-2 ml-1`}>Venue Name</CustomText>
                        <TextInput 
                            style={styles.input}
                            placeholder="e.g. Grand Ballroom"
                            value={newName}
                            onChangeText={setNewName}
                        />

                        <CustomText style={tw`text-slate-500 mb-2 mt-4 ml-1`}>Location</CustomText>
                        <TextInput 
                            style={styles.input}
                            placeholder="Street Address, City"
                            value={newLocation}
                            onChangeText={setNewLocation}
                        />

                        <TouchableOpacity 
                            style={[styles.captureBtn, isSubmitting && { opacity: 0.7 }]}
                            onPress={handleCreateVenue}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="camera" size={22} color="#FFF" style={tw`mr-2`} />
                                    <CustomText style={tw`text-white font-bold text-lg`}>Create & Scan</CustomText>
                                </>
                            )}
                        </TouchableOpacity>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => setModalVisible(true)}
            >
                <Ionicons name="add" size={30} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logoutBtn: { 
        width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center', elevation: 2,
    },
    statsRow: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 20, gap: 15 },
    statBox: { flex: 1, padding: 16, borderRadius: 20, elevation: 1 },
    listContent: { paddingHorizontal: 24, paddingBottom: 100 },
    venueCard: { 
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 24, 
        padding: 12, marginBottom: 16, alignItems: 'center', elevation: 2,
    },
    venueImage: { width: '100%', height: '100%' },
    venueInfo: { flex: 1, marginLeft: 14 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
    scanBtn: { 
        backgroundColor: '#00686F', flexDirection: 'row', paddingHorizontal: 14, 
        paddingVertical: 10, borderRadius: 14, alignItems: 'center' 
    },
    scanBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
    fab: { 
        position: 'absolute', bottom: 30, right: 24, width: 60, height: 60, 
        borderRadius: 20, backgroundColor: '#00686F', justifyContent: 'center', 
        alignItems: 'center', elevation: 8
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
    },
    input: { 
        backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', 
        borderRadius: 16, padding: 16, fontSize: 16, color: '#1E293B' 
    },
    captureBtn: { 
        backgroundColor: '#00686F', borderRadius: 18, height: 60, 
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 30 
    }
});