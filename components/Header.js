import React, { useMemo, useRef } from 'react';
import {
    View,
    Image,
    Pressable,
    Animated,
    Platform
} from 'react-native';
import CustomText from './CustomText';
import { Ionicons } from '@expo/vector-icons';
import tw from 'twrnc';

const AVATAR_MAP = {
    Avatar1: require('../assets/profile/Avatar1.jpg'),
    Avatar2: require('../assets/profile/Avatar2.jpg'),
    Avatar3: require('../assets/profile/Avatar3.jpg'),
    Avatar4: require('../assets/profile/Avatar4.jpg'),
    Avatar5: require('../assets/profile/Avatar5.jpg'),
    Avatar6: require('../assets/profile/Avatar6.jpg'),
};

export default function DashboardHeader({
    userData,
    greeting,
    onOpenNotifications,
    onPressAvatar,
    hasUnread = false
}) {
    const avatarSource = useMemo(() => {
        if (!userData?.avatar) return null;
        if (AVATAR_MAP[userData.avatar]) {
            return AVATAR_MAP[userData.avatar];
        }
        return { uri: userData.avatar };
    }, [userData?.avatar]);

    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View
            style={[
                tw`bg-[#00686F] px-6 pb-7 rounded-b-[28px] relative`,
                {
                    paddingTop: Platform.OS === 'ios' ? 50 : 40,
                    elevation: 8,
                    shadowColor: '#002C30',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12
                }
            ]}
        >
            {/* Sleek Abstract Background Pattern */}
            <View style={tw`absolute inset-0 overflow-hidden rounded-b-[28px]`}>
                <View style={tw`absolute -top-10 -right-5 w-40 h-40 rounded-full bg-white/5`} />
                <View style={tw`absolute -bottom-20 -left-10 w-[220px] h-[220px] rounded-full bg-white/5`} />
                <View style={tw`absolute top-6 left-[35%] w-12 h-12 rounded-full border-2 border-white/5`} />
            </View>

            <View style={tw`flex-row items-center justify-between z-10`}>
                <Pressable
                    onPress={onPressAvatar}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    style={tw`justify-center items-center`}
                >
                    <Animated.View
                        style={[
                            tw`w-14 h-14 rounded-full bg-white border-2 border-white justify-center items-center overflow-hidden`,
                            {
                                transform: [{ scale: scaleAnim }],
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4
                            }
                        ]}
                    >
                        {avatarSource ? (
                            <Image
                                key={userData.avatar}
                                source={avatarSource}
                                style={tw`w-full h-full rounded-full`}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={tw`flex-1 w-full h-full bg-[#E0F2F3] justify-center items-center`}>
                                <Ionicons name="person" size={24} color="#00686F" />
                            </View>
                        )}
                    </Animated.View>
                </Pressable>

                <View style={tw`flex-1 ml-4 justify-center`}>
                    <CustomText
                        fontFamily="medium"
                        style={tw`text-[13px] text-white/80 mb-1 tracking-wide`}
                    >
                        {greeting || 'Good morning,'}
                    </CustomText>
                    <CustomText
                        fontFamily="bold"
                        style={tw`text-[22px] text-white tracking-tight`}
                        numberOfLines={1}
                    >
                        {userData?.firstName || userData?.username || 'User'}
                    </CustomText>
                </View>

                <View style={tw`justify-center items-center`}>
                    <Pressable
                        style={({ pressed }) => [
                            tw`w-11 h-11 rounded-full bg-white/10 justify-center items-center relative`,
                            {
                                opacity: pressed ? 0.7 : 1,
                                transform: [{ scale: pressed ? 0.95 : 1 }]
                            }
                        ]}
                        onPress={onOpenNotifications}
                    >
                        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                        {hasUnread && (
                            <View style={tw`absolute top-2.5 right-3 w-2 h-2 bg-[#FF5252] rounded-full border-[1.5px] border-[#00686F]`} />
                        )}
                    </Pressable>
                </View>
            </View>
        </View>
    );
}