import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Linking,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import CustomText from '../components/CustomText';

export default function ARVenueScreen({ route, navigation }) {
    // Extract venue details passed from VenuesScreen
    const { venueId, venueName } = route.params || { venueId: '1', venueName: 'Venue' };
    const [loading, setLoading] = useState(true);

    const modelUrl = 'https://modelviewer.dev/shared-assets/models/glTF-Sample-Assets/Models/Sponza/glTF/Sponza.gltf';

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
                    background-color: #F8FAFC;
                    overflow: hidden;
                    font-family: sans-serif;
                }
                model-viewer {
                    width: 100%;
                    height: 100%;
                    --poster-color: transparent;
                }
                .ar-button {
                    background-color: #00686F;
                    border-radius: 16px;
                    border: none;
                    color: white;
                    padding: 16px 24px;
                    font-size: 16px;
                    font-weight: bold;
                    position: absolute;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    box-shadow: 0 4px 10px rgba(0, 104, 111, 0.4);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
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
            // 1. Strip off the #Intent metadata that React Native can't read
            const rawUrl = url.split('#Intent')[0];
            // 2. Convert 'intent://' to 'https://'
            const safeUrl = rawUrl.replace('intent://', 'https://');

            // This will open AR if installed, or fallback to browser if testing on an emulator
            Linking.openURL(safeUrl).catch(err => {
                console.error("Failed to open parsed AR URL:", err);
                Alert.alert("AR Not Supported", "Could not launch the AR viewer.");
            });
            return false; // Stop WebView from trying to load the raw intent
        }

        // Handle iOS AR links
        if (url.startsWith('ar://') || url.startsWith('applear://')) {
            Linking.openURL(url).catch(err => console.error("Failed to open ARKit:", err));
            return false;
        }

        return true;
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <CustomText style={styles.headerTitle} numberOfLines={1}>{venueName}</CustomText>
                    <View style={styles.arBadge}>
                        <View style={styles.liveDot} />
                        <CustomText style={styles.arBadgeText}>AR READY</CustomText>
                    </View>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.instructionBanner}>
                <Ionicons name="information-circle" size={20} color="#00686F" />
                <CustomText style={styles.instructionText}>
                    Pan around the 3D model below. Tap <CustomText style={{ fontWeight: '800' }}>Enter Walkable AR</CustomText> to place it in your physical room and walk inside it.
                </CustomText>
            </View>

            <View style={styles.viewerContainer}>
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#00686F" />
                        <CustomText style={styles.loadingText}>Loading 3D Environment...</CustomText>
                    </View>
                )}

                <WebView
                    source={{ html: htmlContent }}
                    style={styles.webview}
                    onLoadEnd={() => setLoading(false)}
                    // Whitelist the custom schemes so WebView doesn't throw ERR_UNKNOWN_URL_SCHEME
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, zIndex: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTextContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    arBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FA', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#00686F' },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
    arBadgeText: { fontSize: 10, fontWeight: '800', color: '#00686F', letterSpacing: 1 },
    instructionBanner: { flexDirection: 'row', backgroundColor: '#E0F2F3', margin: 15, padding: 15, borderRadius: 16, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#00686F' },
    instructionText: { flex: 1, marginLeft: 12, fontSize: 13, color: '#004D52', lineHeight: 20 },
    viewerContainer: { flex: 1, backgroundColor: '#E2E8F0', marginHorizontal: 15, marginBottom: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#CBD5E1' },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
    loadingText: { marginTop: 15, fontSize: 14, fontWeight: '600', color: '#64748B' }
});