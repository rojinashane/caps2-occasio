import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

export default function CaptureVenueScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Animation for the scanning laser
    const scanLineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission]);

    const startScanningAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, {
                    toValue: 300, // height of the scan box
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(scanLineAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                })
            ])
        ).start();
    };

    const handleRecordToggle = () => {
        if (!isScanning) {
            // Start "Recording"
            setIsScanning(true);
            startScanningAnimation();
        } else {
            // Stop "Recording" and start "Processing"
            setIsScanning(false);
            scanLineAnim.stopAnimation();
            setIsProcessing(true);

            // SIMULATE API UPLOAD & 3D GENERATION (Takes 4 seconds)
            setTimeout(() => {
                setIsProcessing(false);
                // Send them to the AR screen with the generated model!
                navigation.replace('ARVenue', {
                    venueId: 'scanned-1',
                    venueName: 'My Scanned Room'
                });
            }, 4000);
        }
    };

    if (!permission) return <View style={tw`flex-1 bg-black`} />;
    if (!permission.granted) {
        return (
            <View style={tw`flex-1 bg-black justify-center items-center px-6`}>
                <Ionicons name="camera-outline" size={60} color="#FFF" style={tw`mb-4`} />
                <CustomText fontFamily="bold" style={tw`text-white text-lg text-center mb-4`}>
                    Camera access is required to scan venues.
                </CustomText>
                <TouchableOpacity onPress={requestPermission} style={tw`bg-[#00686F] px-6 py-3 rounded-full`}>
                    <CustomText fontFamily="bold" style={tw`text-white`}>Grant Permission</CustomText>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={tw`flex-1 bg-black`}>
            {/* Camera View */}
            <CameraView style={StyleSheet.absoluteFillObject} facing="back" />

            {/* UI Overlay */}
            <SafeAreaView style={tw`flex-1 justify-between`} edges={['top', 'bottom']}>

                {/* Header */}
                <View style={tw`flex-row items-center px-6 py-4`}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={tw`w-11 h-11 rounded-full bg-black/50 justify-center items-center`}
                        disabled={isProcessing}
                    >
                        <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={tw`flex-1 items-center`}>
                        <View style={tw`bg-black/50 px-4 py-1.5 rounded-full`}>
                            <CustomText fontFamily="bold" style={tw`text-white text-[13px] uppercase tracking-widest`}>
                                {isScanning ? 'Recording' : '3D Scanner'}
                            </CustomText>
                        </View>
                    </View>
                    <View style={tw`w-11`} />
                </View>

                {/* Viewfinder Grid */}
                <View style={tw`flex-1 justify-center items-center px-8`}>
                    <View style={tw`w-full h-[300px] relative`}>
                        {/* Corner brackets for the modern scanner look */}
                        <View style={tw`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white/80 rounded-tl-xl`} />
                        <View style={tw`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white/80 rounded-tr-xl`} />
                        <View style={tw`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white/80 rounded-bl-xl`} />
                        <View style={tw`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white/80 rounded-br-xl`} />

                        {/* Animated Laser Line */}
                        {isScanning && (
                            <Animated.View
                                style={[
                                    tw`absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-lg`,
                                    { transform: [{ translateY: scanLineAnim }], shadowColor: '#34d399', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 }
                                ]}
                            />
                        )}
                    </View>

                    {/* Instruction Text */}
                    <View style={tw`mt-8 bg-black/60 px-6 py-3 rounded-2xl`}>
                        <CustomText fontFamily="medium" style={tw`text-white text-center text-[14px]`}>
                            {isScanning
                                ? "Pan slowly to record all angles of the room."
                                : "Point camera at the center of the room to begin."}
                        </CustomText>
                    </View>
                </View>

                {/* Bottom Controls */}
                <View style={tw`pb-10 items-center`}>
                    <TouchableOpacity
                        onPress={handleRecordToggle}
                        style={tw`w-20 h-20 rounded-full border-4 ${isScanning ? 'border-red-500/50' : 'border-white/50'} justify-center items-center`}
                        disabled={isProcessing}
                    >
                        <View style={tw`${isScanning ? 'w-8 h-8 rounded-md bg-red-500' : 'w-16 h-16 rounded-full bg-white'}`} />
                    </TouchableOpacity>
                </View>

            </SafeAreaView>

            {/* Fake "Processing" Overlay */}
            {isProcessing && (
                <View style={tw`absolute inset-0 bg-black/90 justify-center items-center z-50`}>
                    <View style={tw`w-24 h-24 bg-white/10 rounded-[32px] justify-center items-center mb-6`}>
                        <ActivityIndicator size="large" color="#FFF" />
                    </View>
                    <CustomText fontFamily="extrabold" style={tw`text-white text-xl mb-2`}>
                        Stitching 3D Model
                    </CustomText>
                    <CustomText fontFamily="medium" style={tw`text-white/60 text-sm`}>
                        Please wait while AI processes your scan...
                    </CustomText>
                </View>
            )}
        </View>
    );
}