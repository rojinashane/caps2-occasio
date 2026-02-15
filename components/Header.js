import React, { useMemo } from 'react';
import {
    View,
    StyleSheet,
    Image,
    Pressable,
    Animated
} from 'react-native';
import CustomText from './CustomText';
import { Ionicons } from '@expo/vector-icons';

const AVATAR_MAP = {
    Avatar1: require('../assets/profile/Avatar1.jpg'),
    Avatar2: require('../assets/profile/Avatar2.jpg'),
    Avatar3: require('../assets/profile/Avatar3.jpg'),
    Avatar4: require('../assets/profile/Avatar4.jpg'),
};

export default function DashboardHeader({
    userData,
    greeting,
    onOpenNotifications, // Renamed for clarity
    onPressAvatar        // This will now trigger your "slider"
}) {

    const avatarSource = useMemo(() => {
        if (!userData?.avatar) return null;
        if (AVATAR_MAP[userData.avatar]) {
            return AVATAR_MAP[userData.avatar];
        }
        return { uri: userData.avatar };
    }, [userData?.avatar]);

    const scaleAnim = useMemo(() => new Animated.Value(1), []);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={styles.headerBody}>
            <View style={styles.contentRow}>

                {/* Left: Avatar (Triggers Profile Slider) */}
                <Pressable
                    onPress={onPressAvatar}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    style={styles.avatarContainer}
                >
                    <Animated.View
                        style={[
                            styles.avatarWrapper,
                            { transform: [{ scale: scaleAnim }] }
                        ]}
                    >
                        {avatarSource ? (
                            <Image
                                source={avatarSource}
                                style={styles.avatarImg}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Ionicons name="person" size={30} color="#00686F" />
                            </View>
                        )}
                    </Animated.View>
                </Pressable>

                {/* Center: User Info */}
                <View style={styles.userInfo}>
                    <CustomText style={styles.greetingText}>
                        {greeting || 'Good Day'}
                    </CustomText>
                    <CustomText style={styles.nameText} numberOfLines={1}>
                        {userData?.firstName || userData?.username || 'User'}
                    </CustomText>
                </View>

                {/* Right: Notification Bell */}
                <View style={styles.rightActions}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.iconCircle,
                            {
                                opacity: pressed ? 0.7 : 1,
                                transform: [{ scale: pressed ? 0.96 : 1 }]
                            }
                        ]}
                        onPress={onOpenNotifications}
                    >
                        <Ionicons name="notifications-outline" size={26} color="#FFFFFF" />
                        {/* Optional: Notification Dot */}
                        <View style={styles.notificationDot} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    headerBody: {
        backgroundColor: '#00686F',
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 35,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        elevation: 15,
        shadowColor: '#004D52',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    avatarContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarWrapper: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 34,
    },
    avatarFallback: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#E0F2F3',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'center',
    },
    greetingText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.75)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600',
        marginBottom: 2,
    },
    nameText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    rightActions: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        position: 'relative', // For notification dot positioning
    },
    notificationDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 10,
        height: 10,
        backgroundColor: '#FF4B4B',
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#00686F',
    },
});