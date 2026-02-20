import React, { useState } from 'react';
import {
    View,
    FlatList,
    TouchableOpacity,
    TextInput,
    Image,
    StatusBar,
    Linking,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

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
    }
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
        <View style={[tw`bg-white rounded-[24px] mb-6 overflow-hidden`, { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }]}>
            <View style={tw`relative w-full h-48 bg-slate-200`}>
                <Image
                    source={{ uri: item.image }}
                    style={tw`w-full h-full absolute`}
                    resizeMode="cover"
                />

                {item.hasAR && (
                    <View style={tw`absolute top-4 right-4 bg-[#00686F]/90 flex-row items-center px-3 py-1.5 rounded-full`}>
                        <Ionicons name="cube" size={14} color="#FFF" />
                        <CustomText fontFamily="bold" style={tw`text-white text-[11px] ml-1.5 tracking-wide uppercase`}>AR Ready</CustomText>
                    </View>
                )}
            </View>

            <View style={tw`p-5`}>
                <View style={tw`flex-row justify-between items-start mb-3`}>
                    <View style={tw`flex-1 mr-4`}>
                        <CustomText fontFamily="extrabold" style={tw`text-lg text-slate-800`} numberOfLines={1}>{item.name}</CustomText>
                        <TouchableOpacity
                            style={tw`flex-row items-center mt-1`}
                            onPress={() => openInGoogleMaps(item)}
                        >
                            <Ionicons name="location" size={14} color="#00686F" />
                            <CustomText fontFamily="medium" style={tw`text-[13px] text-[#00686F] ml-1`} numberOfLines={1}>
                                {item.location}
                            </CustomText>
                        </TouchableOpacity>
                    </View>
                    <View style={tw`bg-[#F0F9FA] px-3 py-2 rounded-xl`}>
                        <CustomText fontFamily="bold" style={tw`text-[13px] text-[#00686F]`}>{item.price.split(' ')[0]}</CustomText>
                        <CustomText fontFamily="medium" style={tw`text-[10px] text-slate-500 text-center`}>per day</CustomText>
                    </View>
                </View>

                <View style={tw`flex-row items-center mb-5`}>
                    <View style={tw`flex-row items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100`}>
                        <Ionicons name="people" size={14} color="#64748B" />
                        <CustomText fontFamily="semibold" style={tw`text-[12px] text-slate-600 ml-1.5`}>{item.capacity}</CustomText>
                    </View>
                </View>

                {/* FIXED BUTTON ROW: Removed 'gap-3' and complex flex ratios. Now perfectly split 50/50 with margin-right */}
                <View style={tw`flex-row`}>
                    <TouchableOpacity
                        style={tw`flex-1 py-3.5 mr-3 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center`}
                        onPress={() => navigation.navigate('VenueDetails', { venue: item })}
                    >
                        <CustomText fontFamily="bold" style={tw`text-slate-600 text-[14px]`}>Details</CustomText>
                    </TouchableOpacity>

                    {item.hasAR ? (
                        <TouchableOpacity
                            style={tw`flex-1 flex-row py-3.5 rounded-2xl bg-[#00686F] items-center justify-center shadow-sm`}
                            onPress={() => navigation.navigate('ARVenue', { venueId: item.id, venueName: item.name })}
                        >
                            <Ionicons name="walk" size={18} color="#FFF" />
                            <CustomText fontFamily="bold" style={tw`text-white text-[14px] ml-2`}>Walk in AR</CustomText>
                        </TouchableOpacity>
                    ) : (
                        <View style={tw`flex-1 py-3.5 rounded-2xl bg-slate-100 border border-slate-200 border-dashed items-center justify-center`}>
                            <CustomText fontFamily="semibold" style={tw`text-slate-400 text-[13px]`}>No AR Available</CustomText>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Header */}
            <View style={tw`flex-row items-center px-6 py-4`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`w-11 h-11 rounded-full bg-white justify-center items-center shadow-sm border border-slate-100`}>
                    <Ionicons name="chevron-back" size={20} color="#1E293B" />
                </TouchableOpacity>
                <View style={tw`flex-1 items-center`}>
                    <CustomText fontFamily="extrabold" style={tw`text-xl text-slate-800`}>Venues</CustomText>
                </View>
                <View style={tw`w-11`} />
            </View>

            {/* Search Bar */}
            <View style={tw`px-6 mb-4`}>
                <View style={tw`flex-row items-center bg-white rounded-2xl px-4 h-14 border border-slate-200 shadow-sm`}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={tw`flex-1 ml-3 text-[15px] text-slate-800 font-normal`}
                        placeholder="Search venues or locations..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')} style={tw`p-1`}>
                            <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* NEW: Scan Venue Button added right below the search bar */}
            <View style={tw`px-6 mb-6`}>
                <TouchableOpacity
                    style={tw`flex-row bg-[#00686F] p-4 rounded-2xl items-center justify-center shadow-sm`}
                    onPress={() => navigation.navigate('CaptureVenue')}
                >
                    <Ionicons name="scan" size={20} color="#FFF" />
                    <CustomText fontFamily="bold" style={tw`text-white text-[15px] ml-2`}>
                        Scan a Room into 3D
                    </CustomText>
                </TouchableOpacity>
            </View>

            {/* List of Venues */}
            <FlatList
                data={venues}
                keyExtractor={item => item.id}
                renderItem={renderVenueCard}
                contentContainerStyle={tw`px-6 pb-10 pt-2`}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={tw`items-center justify-center pt-20`}>
                        <View style={tw`w-20 h-20 rounded-full bg-slate-100 items-center justify-center mb-4`}>
                            <Ionicons name="search-outline" size={32} color="#94A3B8" />
                        </View>
                        <CustomText fontFamily="bold" style={tw`text-slate-500 text-lg`}>No venues found</CustomText>
                        <CustomText fontFamily="medium" style={tw`text-slate-400 text-sm mt-1`}>Try adjusting your search terms.</CustomText>
                    </View>
                }
            />
        </SafeAreaView>
    );
}