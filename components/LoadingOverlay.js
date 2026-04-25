import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Modal, Animated, StyleSheet } from 'react-native';
import CustomText from './CustomText';

/**
 * LoadingOverlay - A reusable full-screen loading indicator
 * 
 * @param {boolean} visible - Controls visibility of the overlay
 * @param {string} message - Optional loading message to display
 * @param {string} color - Primary color for the spinner (default: #00686F)
 */
export default function LoadingOverlay({ visible, message = 'Loading...', color = '#00686F' }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.8);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                <Animated.View style={[
                    styles.container,
                    { transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={[styles.spinnerWrap, { backgroundColor: color + '15' }]}>
                        <ActivityIndicator size="large" color={color} />
                    </View>
                    <CustomText fontFamily="semibold" style={styles.message}>
                        {message}
                    </CustomText>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 12,
        minWidth: 200,
    },
    spinnerWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    message: {
        fontSize: 15,
        color: '#334155',
        textAlign: 'center',
    },
});
