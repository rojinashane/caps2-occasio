import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    StatusBar,
    Linking,
    Platform,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';

const { width } = Dimensions.get('window');

const MOCK_VENUES = [
    {
        id: '1',
        name: "Lilia's Fortune Hall",
        location: 'Ricacho Subdivision, Sorsogon City',
        coordinates: { latitude: 12.973938, longitude: 124.005313 },
        capacity: '500 Pax',
        price: '₱50,000 / day',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
        hasAR: true,
        description: "A grand hall perfect for weddings and large corporate events with state-of-the-art facilities and elegant lighting."
    },
    {
        id: '2',
        name: "Hilda's Love Function Hall",
        location: 'Quezon Street, Sorsogon City',
        coordinates: { latitude: 12.9691, longitude: 124.0044 },
        capacity: '200 Pax',
        price: '₱35,000 / day',
        image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
        hasAR: true,
        description: "An elegant space designed for intimate gatherings and celebrations of love, offering a romantic ambiance."
    },
    {
        id: '3',
        name: 'The Clover Leaf Place',
        location: 'El Retiro, Sorsogon City',
        coordinates: { latitude: 12.9622, longitude: 123.9961 },
        capacity: '50 Pax',
        price: '₱15,000 / day',
        image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800',
        hasAR: false,
        description: "A cozy and modern venue ideal for seminars, workshops, and small private parties."
    },
    {
        id: '4',
        name: "Fortune's Hall Event Center",
        location: 'Bibincahan, Sorsogon City',
        coordinates: { latitude: 12.9768, longitude: 124.0125 },
        capacity: '50 Pax',
        price: '₱15,000 / day',
        image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
        hasAR: false,
        description: "Conveniently located in Bibincahan, this center offers a professional and air-conditioned setting for various events."
    },
    {
        id: '5',
        name: "Juliana's Events and Function Hall",
        location: 'Sitio Sirangan, Macabog, Sorsogon City',
        coordinates: { latitude: 12.9815, longitude: 124.0089 },
        capacity: '50 Pax',
        price: '₱15,000 / day',
        image: 'https://images.unsplash.com/photo-1470753951487-d0d62b10da61?auto=format&fit=crop&q=80&w=800',
        hasAR: false,
        description: "A versatile function hall situated in Macabog, known for its friendly service and flexible layout options."
    },
    {
        id: '6',
        name: 'Sorsogon Convention Center',
        location: 'Diversion Road, Brgy. Cabid-An, Sorsogon City',
        coordinates: { latitude: 12.9856, longitude: 124.0201 },
        capacity: '1000 Pax', // Updated to match a "Convention Center" scale
        price: '₱75,000 / day',
        image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=800',
        hasAR: false,
        description: "The premier destination for large-scale conventions, exhibitions, and grand social gatherings in Sorsogon City."
    },
];

export default function VenuesScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [venues, setVenues] = useState(MOCK_VENUES);

    const openInGoogleMaps = (item) => {
        if (!item.coordinates) return;
        const { latitude, longitude } = item.coordinates;
        const label = item.name;
        const url = Platform.select({
            ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${label})`
        });
        Linking.openURL(url);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        if (text.trim() === '') {
            setVenues(MOCK_VENUES);
        } else {
            const filtered = MOCK_VENUES.filter(venue =>
                venue.name.toLowerCase().includes(text.toLowerCase()) ||
                venue.location.toLowerCase().includes(text.toLowerCase())
            );
            setVenues(filtered);
        }
    };

    const renderVenueCard = ({ item }) => (
        <View style={styles.cardContainer}>
            <Image 
                source={{ uri: item.image }} 
                style={styles.cardImage} 
                resizeMode="cover"
            />

            {item.hasAR && (
                <View style={styles.arBadge}>
                    <Ionicons name="cube" size={12} color="#FFF" />
                    <CustomText style={styles.arBadgeText}>AR Ready</CustomText>
                </View>
            )}

            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <CustomText style={styles.venueName} numberOfLines={1}>{item.name}</CustomText>
                    <CustomText style={styles.venuePrice}>{item.price}</CustomText>
                </View>

                <View style={styles.infoRow}>
                    <TouchableOpacity 
                        style={[styles.infoItem, { flex: 1 }]} 
                        onPress={() => openInGoogleMaps(item)}
                    >
                        <Ionicons name="location" size={14} color="#00686F" />
                        <CustomText 
                            style={[styles.infoText, { color: '#00686F', fontWeight: '700' }]}
                            numberOfLines={1}
                        >
                            {item.location}
                        </CustomText>
                    </TouchableOpacity>

                    <View style={styles.infoItem}>
                        <Ionicons name="people-outline" size={14} color="#64748B" />
                        <CustomText style={styles.infoText}>{item.capacity}</CustomText>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => navigation.navigate('VenueDetails', { venue: item })}
                    >
                        <CustomText style={styles.detailsBtnText}>View Details</CustomText>
                    </TouchableOpacity>

                    {item.hasAR ? (
                        <TouchableOpacity
                            style={styles.arBtn}
                            onPress={() => navigation.navigate('ARVenue', { venueId: item.id, venueName: item.name })}
                        >
                            <Ionicons name="walk-outline" size={18} color="#FFF" />
                            <CustomText style={styles.arBtnText}>Walk in AR</CustomText>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.noArBtn}>
                            <CustomText style={styles.noArBtnText}>No AR Available</CustomText>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <CustomText style={styles.headerTitle}>Discover Venues</CustomText>
                    <CustomText style={styles.headerSubtitle}>Find the perfect space for your event</CustomText>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or location..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={venues}
                keyExtractor={item => item.id}
                renderItem={renderVenueCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={48} color="#CBD5E1" />
                        <CustomText style={styles.emptyText}>No venues found.</CustomText>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    headerTextContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
    searchContainer: { paddingHorizontal: 20, marginBottom: 15 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1E293B' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    cardContainer: { backgroundColor: '#FFF', borderRadius: 24, marginBottom: 20, overflow: 'hidden', elevation: 4 },
    cardImage: { width: '100%', height: 180, backgroundColor: '#E2E8F0' },
    arBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0, 104, 111, 0.9)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    arBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', marginLeft: 4 },
    cardContent: { padding: 20 },
    cardHeader: { marginBottom: 10 },
    venueName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    venuePrice: { fontSize: 14, fontWeight: '700', color: '#00686F' },
    infoRow: { flexDirection: 'row', marginBottom: 20, gap: 15 },
    infoItem: { flexDirection: 'row', alignItems: 'center' },
    infoText: { fontSize: 12, color: '#64748B', marginLeft: 4, fontWeight: '500' },
    actionRow: { flexDirection: 'row', gap: 12 },
    detailsBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
    detailsBtnText: { color: '#475569', fontWeight: '700', fontSize: 14 },
    arBtn: { flex: 1.2, flexDirection: 'row', paddingVertical: 12, borderRadius: 14, backgroundColor: '#00686F', alignItems: 'center', justifyContent: 'center' },
    arBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, marginLeft: 8 },
    noArBtn: { flex: 1.2, paddingVertical: 12, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
    noArBtnText: { color: '#94A3B8', fontWeight: '600', fontSize: 12 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#94A3B8', marginTop: 15, fontSize: 16, fontWeight: '600' }
});