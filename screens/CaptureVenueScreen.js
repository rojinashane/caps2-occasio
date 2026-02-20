import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    StyleSheet,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

import { CaptureVenueService } from '../services/CaptureVenueService'; 

export default function CaptureVenueScreen({ navigation }) {
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    
    const cameraRef = useRef(null);
    const scanLineAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        (async () => {
            const cam = await requestCameraPermission();
            const mic = await requestMicPermission();
            if (!cam.granted || !mic.granted) {
                Alert.alert("Permissions Required", "We need camera and mic access to create 3D scans.");
            }
        })();
    }, []);

    const startScanningAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scanLineAnim, {
                    toValue: 300, 
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

    const handleRecordToggle = async () => {
        if (!isCameraReady || !cameraRef.current) return;

        if (!isScanning) {
            try {
                setIsScanning(true);
                startScanningAnimation();

                const video = await cameraRef.current.recordAsync({
                    maxDuration: 60,
                    quality: '1080p',
                });
                
                if (video?.uri) {
                    processCapture(video.uri);
                }
            } catch (error) {
                console.error("Recording Error:", error);
                setIsScanning(false);
                scanLineAnim.stopAnimation();
            }
        } else {
            setIsScanning(false);
            scanLineAnim.stopAnimation();
            cameraRef.current.stopRecording();
        }
    };

    const processCapture = async (videoUri) => {
        setIsProcessing(true);
        try {
            setStatusMessage('Creating Capture...');
            const { slug, upload_url } = await CaptureVenueService.createCapture(`Venue_${Date.now()}`);

            setStatusMessage('Uploading Video...');
            await CaptureVenueService.uploadVideo(upload_url, videoUri);

            setStatusMessage('Stitching 3D Model...');
            await CaptureVenueService.triggerProcessing(slug);

            navigation.replace('ARVenue', {
                venueId: slug,
                venueName: 'My Scanned Room'
            });

        } catch (error) {
            console.error("Final Workflow Error:", error);
            Alert.alert(
                "Connection Error", 
                "Could not reach Luma servers. Please check your API key and ensure you are on a physical device with internet."
            );
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    if (!cameraPermission?.granted || !micPermission?.granted) {
        return <View style={tw`flex-1 bg-black`} />;
    }

    return (
        <View style={tw`flex-1 bg-black`}>
            <CameraView 
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject} 
                facing="back" 
                mode="video"
                onCameraReady={() => setIsCameraReady(true)}
            />

            <SafeAreaView style={tw`flex-1 justify-between`} edges={['top', 'bottom']}>
                <View style={tw`flex-row items-center px-6 py-4`}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={tw`w-11 h-11 rounded-full bg-black/50 justify-center items-center`}>
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

                <View style={tw`flex-1 justify-center items-center px-8`}>
                    <View style={tw`w-full h-[300px] relative`}>
                        <View style={tw`absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white/80 rounded-tl-xl`} />
                        <View style={tw`absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white/80 rounded-tr-xl`} />
                        <View style={tw`absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white/80 rounded-bl-xl`} />
                        <View style={tw`absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white/80 rounded-br-xl`} />

                        {isScanning && (
                            <Animated.View
                                style={[
                                    tw`absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-lg`,
                                    { transform: [{ translateY: scanLineAnim }], shadowColor: '#34d399', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10 }
                                ]}
                            />
                        )}
                    </View>
                </View>

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

            {isProcessing && (
                <View style={tw`absolute inset-0 bg-black/90 justify-center items-center z-50`}>
                    <ActivityIndicator size="large" color="#FFF" style={tw`mb-4`} />
                    <CustomText fontFamily="bold" style={tw`text-white text-lg`}>{statusMessage}</CustomText>
                </View>
            )}
        </View>
    );
}