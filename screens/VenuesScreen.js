import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    StatusBar,
    Text
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';

// Mock data for venues - eventually, you can fetch this from your 'venues' Firebase collection
const MOCK_VENUES = [
    {
        id: '1',
        name: 'The Grand Ballroom',
        location: 'Imus, Calabarzon',
        capacity: '500 Pax',
        price: '₱50,000 / day',
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=800',
        hasAR: true,
    },
    {
        id: '2',
        name: 'Sunset Garden Pavilion',
        location: 'Tagaytay City',
        capacity: '200 Pax',
        price: '₱35,000 / day',
        image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800',
        hasAR: true,
    },
    {
        id: '3',
        name: 'Minimalist Glass Studio',
        location: 'Makati CBD',
        capacity: '50 Pax',
        price: '₱15,000 / day',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800',
        hasAR: false,
    },
];

export default function VenuesScreen({ navigation }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [venues, setVenues] = useState(MOCK_VENUES);

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
            <Image source={{ uri: item.image }} style={styles.cardImage} />

            {/* AR Badge */}
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
                    <View style={styles.infoItem}>
                        <Ionicons name="location-outline" size={14} color="#64748B" />
                        <CustomText style={styles.infoText}>{item.location}</CustomText>
                    </View>
                    <View style={styles.infoItem}>
                        <Ionicons name="people-outline" size={14} color="#64748B" />
                        <CustomText style={styles.infoText}>{item.capacity}</CustomText>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => console.log('Navigate to normal venue details')}
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

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <CustomText style={styles.headerTitle}>Discover Venues</CustomText>
                    <CustomText style={styles.headerSubtitle}>Find the perfect space for your event</CustomText>
                </View>
                <View style={{ width: 44 }} /> {/* Empty view for balance */}
            </View>

            {/* Search Bar */}
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

            {/* Venues List */}
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
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    headerTextContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        color: '#1E293B',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    cardContainer: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    cardImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#E2E8F0',
    },
    arBadge: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: 'rgba(0, 104, 111, 0.9)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    arBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '800',
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    cardContent: {
        padding: 20,
    },
    cardHeader: {
        marginBottom: 10,
    },
    venueName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4,
    },
    venuePrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#00686F',
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 15,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#64748B',
        marginLeft: 4,
        fontWeight: '500',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    detailsBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    detailsBtnText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 14,
    },
    arBtn: {
        flex: 1.2,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#00686F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arBtnText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 14,
        marginLeft: 8,
    },
    noArBtn: {
        flex: 1.2,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noArBtnText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 12,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600',
    }
});