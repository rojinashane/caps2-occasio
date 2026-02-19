import React from 'react';
import { View, Image, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VenueDetailsScreen({ route, navigation }) {
    // Get the venue item passed from the previous screen
    const { venue } = route.params;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    <Image source={{ uri: venue.image }} style={styles.image} />
                    <TouchableOpacity 
                        style={styles.backButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.header}>
                        <CustomText style={styles.name}>{venue.name}</CustomText>
                        <CustomText style={styles.price}>{venue.price}</CustomText>
                    </View>

                    <View style={styles.divider} />

                    {/* Quick Info Section */}
                    <View style={styles.section}>
                        <CustomText style={styles.sectionTitle}>Details</CustomText>
                        <View style={styles.infoRow}>
                            <Ionicons name="people" size={20} color="#00686F" />
                            <CustomText style={styles.infoText}>Capacity: {venue.capacity}</CustomText>
                        </View>
                        <TouchableOpacity 
                            style={styles.infoRow} 
                            onPress={() => {
                                // Re-using your map logic
                                const url = Platform.select({
                                    ios: `maps:0,0?q=${venue.name}@${venue.coordinates.latitude},${venue.coordinates.longitude}`,
                                    android: `geo:0,0?q=${venue.coordinates.latitude},${venue.coordinates.longitude}(${venue.name})`
                                });
                                Linking.openURL(url);
                            }}
                        >
                            <Ionicons name="location" size={20} color="#00686F" />
                            <CustomText style={[styles.infoText, { color: '#00686F', textDecorationLine: 'underline' }]}>
                                {venue.location}
                            </CustomText>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <CustomText style={styles.sectionTitle}>Description</CustomText>
                        <CustomText style={styles.description}>
                            This is a beautiful venue located in the heart of Sorsogon City. 
                            Perfect for weddings, birthdays, and corporate events. 
                            Features include spacious seating, excellent ventilation, and prime location.
                        </CustomText>
                    </View>
                </View>
            </ScrollView>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    imageContainer: { position: 'relative' },
    image: { width: '100%', height: 300 },
    backButton: { position: 'absolute', top: 20, left: 20, backgroundColor: '#FFF', padding: 10, borderRadius: 12, elevation: 5 },
    content: { padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 24, fontWeight: '800', color: '#1E293B', flex: 1 },
    price: { fontSize: 18, fontWeight: '700', color: '#00686F' },
    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoText: { marginLeft: 10, fontSize: 15, color: '#475569' },
    description: { fontSize: 15, color: '#64748B', lineHeight: 24 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    bookBtn: { backgroundColor: '#00686F', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    bookBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});