import React, { useState } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

export default function ARVenueScreen({ route, navigation }) {
    // 1. Destructure all database fields from route params
    const {
        venueName,
        modelUrl,
        price,
        capacity,
        location
    } = route.params || {};

    const [loading, setLoading] = useState(true);

    // 2. Generate HTML only if modelUrl is present to avoid URI errors
    const htmlContent = modelUrl ? `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
            <style>
                body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #F8FAFC; overflow: hidden; }
                model-viewer { width: 100%; height: 100%; --poster-color: transparent; }
                .ar-button {
                    background-color: #00686F; border-radius: 18px; border: none; color: white;
                    padding: 16px 28px; font-size: 15px; font-weight: 700; position: absolute;
                    bottom: 30px; left: 50%; transform: translateX(-50%);
                    box-shadow: 0 8px 16px rgba(0, 104, 111, 0.25); display: flex; align-items: center; gap: 10px;
                }
            </style>
        </head>
        <body>
            <model-viewer 
                src="${modelUrl}" 
                ar ar-modes="webxr scene-viewer quick-look" 
                ar-scale="fixed" 
                camera-controls auto-rotate shadow-intensity="1"
                alt="A 3D model of ${venueName}">
                <button slot="ar-button" class="ar-button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    Enter Walkable AR
                </button>
            </model-viewer>
        </body>
        </html>
    ` : null;

    const handleShouldStartLoadWithRequest = (request) => {
        const { url } = request;
        if (url.startsWith('intent://')) {
            const rawUrl = url.split('#Intent')[0].replace('intent://', 'https://');
            Linking.openURL(rawUrl).catch(() => Alert.alert("AR Not Supported", "Device incompatible."));
            return false;
        }
        return true;
    };

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* Header: Dynamic Name & Location */}
            <View style={tw`flex-row items-center px-6 py-4 bg-white border-b border-slate-100`}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`w-11 h-11 rounded-full bg-slate-50 justify-center items-center`}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>

                <View style={tw`flex-1 items-center px-2`}>
                    <CustomText fontFamily="extrabold" style={tw`text-lg text-slate-800`}>{venueName}</CustomText>
                    <CustomText style={tw`text-[10px] text-slate-400 uppercase`}>{location}</CustomText>
                </View>
                <View style={tw`w-11`} />
            </View>

            {/* Venue Stats Bar (Capacity & Price) */}
            <View style={tw`flex-row justify-around bg-white mx-6 mt-4 p-3 rounded-2xl border border-slate-100`}>
                <View style={tw`items-center`}>
                    <CustomText style={tw`text-[10px] text-slate-400`}>CAPACITY</CustomText>
                    <CustomText fontFamily="bold" style={tw`text-sm text-slate-700`}>{capacity}</CustomText>
                </View>
                <View style={tw`w-px h-8 bg-slate-100`} />
                <View style={tw`items-center`}>
                    <CustomText style={tw`text-[10px] text-slate-400`}>PRICE</CustomText>
                    <CustomText fontFamily="bold" style={tw`text-sm text-[#00686F]`}>{price}</CustomText>
                </View>
            </View>

            {/* 3D Viewer Container */}
            <View style={tw`flex-1 bg-slate-100 mx-6 mt-5 mb-8 rounded-[32px] overflow-hidden border border-slate-200 relative`}>
                {(!modelUrl || loading) && (
                    <View style={tw`absolute inset-0 bg-[#F8FAFC] justify-center items-center z-20`}>
                        <ActivityIndicator size="large" color="#00686F" />
                        <CustomText style={tw`mt-4 text-slate-500`}>Loading 3D Venue...</CustomText>
                    </View>
                )}

                {modelUrl && (
                    <WebView
                        source={{ html: htmlContent }}
                        style={tw`flex-1 bg-transparent`}
                        onLoadEnd={() => setLoading(false)}
                        originWhitelist={['*']}
                        allowsInlineMediaPlayback
                        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}