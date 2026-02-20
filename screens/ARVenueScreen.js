import React, { useState } from 'react';
import {
    View,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Linking,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import CustomText from '../components/CustomText';
import tw from 'twrnc';

export default function ARVenueScreen({ route, navigation }) {
    // Extract venue details passed from VenuesScreen
    const { venueId, venueName } = route.params || { venueId: '1', venueName: 'Venue' };
    const [loading, setLoading] = useState(true);

    const modelUrl = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

    // Injected HTML: Updated the CSS to make the web button match the native sleek UI
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>AR Venue Viewer</title>
            <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
            <style>
                body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    background-color: #F8FAFC; /* Matches slate-50 */
                    overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                model-viewer {
                    width: 100%;
                    height: 100%;
                    --poster-color: transparent;
                }
                .ar-button {
                    background-color: #00686F;
                    border-radius: 18px;
                    border: none;
                    color: white;
                    padding: 16px 28px;
                    font-size: 15px;
                    font-weight: 700;
                    position: absolute;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    box-shadow: 0 8px 16px rgba(0, 104, 111, 0.25);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    letter-spacing: 0.3px;
                }
                .ar-button:active {
                    background-color: #004D52;
                    transform: translateX(-50%) scale(0.96);
                }
            </style>
        </head>
        <body>
            <model-viewer 
                src="${modelUrl}" 
                ar 
                ar-modes="webxr scene-viewer quick-look" 
                ar-scale="fixed"
                camera-controls 
                auto-rotate
                shadow-intensity="1"
                alt="A 3D model of ${venueName}">
                
                <button slot="ar-button" class="ar-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    Enter Walkable AR
                </button>
            </model-viewer>
        </body>
        </html>
    `;

    // THE FIX: Parse the intent into a safe HTTPS link that won't crash emulators
    const handleShouldStartLoadWithRequest = (request) => {
        const { url } = request;

        // Handle Android AR links
        if (url.startsWith('intent://')) {
            const rawUrl = url.split('#Intent')[0];
            const safeUrl = rawUrl.replace('intent://', 'https://');

            Linking.openURL(safeUrl).catch(err => {
                console.error("Failed to open parsed AR URL:", err);
                Alert.alert(
                    "AR Not Supported",
                    "Your device requires 'Google Play Services for AR' to place this venue in your room. You can still explore the venue using the 3D viewer on your screen!"
                );
            });
            return false;
        }

        // Handle iOS AR links
        if (url.startsWith('ar://') || url.startsWith('applear://')) {
            Linking.openURL(url).catch(err => console.error("Failed to open ARKit:", err));
            return false;
        }

        return true;
    };

    return (
        <SafeAreaView style={tw`flex-1 bg-[#F8FAFC]`} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

            {/* Header */}
            <View style={[tw`flex-row items-center px-6 py-4 bg-white border-b border-slate-100 z-10`, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={tw`w-11 h-11 rounded-full bg-slate-50 justify-center items-center border border-slate-100`}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>

                <View style={tw`flex-1 items-center px-2`}>
                    <CustomText fontFamily="extrabold" style={tw`text-lg text-slate-800 mb-1`} numberOfLines={1}>
                        {venueName}
                    </CustomText>
                    <View style={tw`flex-row items-center bg-[#F0F9FA] px-2.5 py-1 rounded-full border border-[#00686F]/20`}>
                        <View style={tw`w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5`} />
                        <CustomText fontFamily="bold" style={tw`text-[9px] text-[#00686F] tracking-widest`}>
                            AR READY
                        </CustomText>
                    </View>
                </View>

                <View style={tw`w-11`} />
            </View>

            {/* Instruction Banner */}
            <View style={tw`flex-row bg-[#F0F9FA] mx-6 mt-6 p-4 rounded-[20px] items-center border border-[#00686F]/10`}>
                <View style={tw`w-12 h-12 rounded-[14px] bg-white justify-center items-center shadow-sm mr-4 border border-slate-50`}>
                    <Ionicons name="cube" size={24} color="#00686F" />
                </View>
                <CustomText fontFamily="medium" style={tw`flex-1 text-[13px] text-slate-600 leading-5`}>
                    Pan around the 3D model. Tap <CustomText fontFamily="bold" style={tw`text-slate-800`}>Enter Walkable AR</CustomText> to place it in your room.
                </CustomText>
            </View>

            {/* 3D Viewer Container */}
            <View style={[tw`flex-1 bg-slate-100 mx-6 mt-5 mb-8 rounded-[32px] overflow-hidden border border-slate-200 relative`, { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 }]}>
                {loading && (
                    <View style={tw`absolute inset-0 bg-[#F8FAFC] justify-center items-center z-20`}>
                        <View style={tw`w-16 h-16 bg-white rounded-2xl shadow-sm justify-center items-center mb-4 border border-slate-100`}>
                            <ActivityIndicator size="large" color="#00686F" />
                        </View>
                        <CustomText fontFamily="semibold" style={tw`text-[14px] text-slate-500`}>
                            Loading 3D Environment...
                        </CustomText>
                    </View>
                )}

                <WebView
                    source={{ html: htmlContent }}
                    style={tw`flex-1 bg-transparent`}
                    onLoadEnd={() => setLoading(false)}
                    originWhitelist={['http://*', 'https://*', 'intent://*', 'ar://*', 'applear://*']}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    geolocationEnabled={true}
                    allowFileAccessFromFileURLs={true}
                    allowUniversalAccessFromFileURLs={true}
                    onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                />
            </View>
        </SafeAreaView>
    );
}