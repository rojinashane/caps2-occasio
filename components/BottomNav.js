import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

// ── Must match the AVATAR_MAP in ProfileScreen exactly ──────
const AVATAR_MAP = {
    'Avatar1': require('../assets/profile/Avatar1.jpg'),
    'Avatar2': require('../assets/profile/Avatar2.jpg'),
    'Avatar3': require('../assets/profile/Avatar3.jpg'),
    'Avatar4': require('../assets/profile/Avatar4.jpg'),
    'Avatar5': require('../assets/profile/Avatar5.jpg'),
    'Avatar6': require('../assets/profile/Avatar6.jpg'),
};

export default function BottomNav({ navigation, activeRoute, userData }) {
    const insets = useSafeAreaInsets();

    // Priority order:
    // 1. Local avatar chosen in ProfileScreen (stored as a key string e.g. "Avatar1")
    // 2. Remote photo URL (e.g. from Google sign-in)
    // 3. Fallback to initials / icon
    const avatarKey     = userData?.avatar || null;
    const avatarSource  = avatarKey && AVATAR_MAP[avatarKey] ? AVATAR_MAP[avatarKey] : null;
    const remoteUri     = !avatarSource ? (userData?.photoURL || userData?.profileImage || null) : null;

    const initials = userData?.name
        ? userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <View style={[
            tw`bg-white absolute bottom-0 w-full flex-row justify-around items-center pt-3 border-t border-slate-100`,
            {
                paddingBottom: Math.max(insets.bottom, 16),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 10,
            }
        ]}>
            {/* Home Tab */}
            <TouchableOpacity style={tw`items-center flex-1`} onPress={() => navigation.navigate('Dashboard')}>
                <Ionicons
                    name={activeRoute === 'Dashboard' ? 'home' : 'home-outline'}
                    size={24}
                    color={activeRoute === 'Dashboard' ? '#00686F' : '#94A3B8'}
                />
                {activeRoute === 'Dashboard' && (
                    <View style={[tw`w-1 h-1 rounded-full mt-1`, { backgroundColor: '#00686F' }]} />
                )}
            </TouchableOpacity>

            {/* Venues Tab */}
            <TouchableOpacity style={tw`items-center flex-1 mr-6`} onPress={() => navigation.navigate('Venues')}>
                <Ionicons
                    name={activeRoute === 'Venues' ? 'cube' : 'cube-outline'}
                    size={24}
                    color={activeRoute === 'Venues' ? '#00686F' : '#94A3B8'}
                />
                {activeRoute === 'Venues' && (
                    <View style={[tw`w-1 h-1 rounded-full mt-1`, { backgroundColor: '#00686F' }]} />
                )}
            </TouchableOpacity>

            {/* CENTER ADD BUTTON */}
            <View style={[tw`absolute -top-6 left-1/2`, { transform: [{ translateX: -28 }] }]}>
                <TouchableOpacity
                    style={[
                        tw`bg-[#00686F] w-14 h-14 rounded-full justify-center items-center`,
                        {
                            shadowColor: '#00686F',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.4,
                            shadowRadius: 8,
                            elevation: 6,
                        }
                    ]}
                    onPress={() => navigation.navigate('AddEvent')}
                >
                    <Ionicons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* My Events Tab */}
            <TouchableOpacity style={tw`items-center flex-1 ml-6`} onPress={() => navigation.navigate('MyEvents')}>
                <Ionicons
                    name={activeRoute === 'MyEvents' ? 'calendar' : 'calendar-outline'}
                    size={24}
                    color={activeRoute === 'MyEvents' ? '#00686F' : '#94A3B8'}
                />
                {activeRoute === 'MyEvents' && (
                    <View style={[tw`w-1 h-1 rounded-full mt-1`, { backgroundColor: '#00686F' }]} />
                )}
            </TouchableOpacity>

            {/* Profile Tab — circular avatar */}
            <TouchableOpacity style={tw`items-center flex-1`} onPress={() => navigation.navigate('Profile')}>
                <View style={[
                    tw`w-7 h-7 rounded-full overflow-hidden justify-center items-center`,
                    {
                        borderWidth: activeRoute === 'Profile' ? 2 : 1.5,
                        borderColor: activeRoute === 'Profile' ? '#00686F' : '#CBD5E1',
                    }
                ]}>
                    {/* Local avatar from ProfileScreen (highest priority) */}
                    {avatarSource ? (
                        <Image source={avatarSource} style={tw`w-full h-full`} />
                    ) : remoteUri ? (
                        /* Remote photo URL fallback */
                        <Image source={{ uri: remoteUri }} style={tw`w-full h-full`} />
                    ) : (
                        /* No image — icon fallback */
                        <View style={[
                            tw`w-full h-full justify-center items-center`,
                            { backgroundColor: activeRoute === 'Profile' ? '#E0F2F3' : '#F1F5F9' }
                        ]}>
                            <Ionicons
                                name="person"
                                size={14}
                                color={activeRoute === 'Profile' ? '#00686F' : '#94A3B8'}
                            />
                        </View>
                    )}
                </View>
                {activeRoute === 'Profile' && (
                    <View style={[tw`w-1 h-1 rounded-full mt-1`, { backgroundColor: '#00686F' }]} />
                )}
            </TouchableOpacity>
        </View>
    );
}