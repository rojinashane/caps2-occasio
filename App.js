import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// 1. Import Notifications and SafeAreaProvider
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import DashboardScreen from './screens/DashboardScreen';
import AddEvent from './components/AddEvent';
import EventDetailsScreen from './screens/EventDetailsScreen';
import UpdateEvent from './components/UpdateEvent';
import ProfileScreen from './screens/ProfileScreen';
import RSVPTrackerScreen from './screens/RSVPTrackerScreen';

// NEW: Import the Venues and AR Screens
import VenuesScreen from './screens/VenuesScreen';
import ARVenueScreen from './screens/ARVenueScreen';
import VenueDetailsScreen from './screens/VenueDetailsScreen';
// 2. CONFIGURE NOTIFICATIONS (Fixes the Warning)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Replaces deprecated shouldShowAlert
    shouldShowList: true,   // Replaces deprecated shouldShowAlert
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await user.reload();
          if (user.emailVerified) {
            setInitialRoute('Dashboard');
          } else {
            setInitialRoute('Landing');
          }
        } catch (e) {
          console.log('Error reloading user:', e);
          setInitialRoute('Landing');
        }
      } else {
        setInitialRoute('Landing');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EFF0EE' }}>
        <ActivityIndicator size="large" color="#00686F" />
      </View>
    );
  }

  return (
    // 3. Wrap everything in SafeAreaProvider (Fixes the Header being cut off)
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="AddEvent" component={AddEvent} />
            <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
            <Stack.Screen name="UpdateEvent" component={UpdateEvent} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="RSVPTrackerScreen" component={RSVPTrackerScreen} options={{ title: 'RSVP Tracker' }} />

            {/* NEW: Register the Venues and AR Screens */}
            <Stack.Screen name="Venues" component={VenuesScreen} />
            <Stack.Screen name="ARVenue" component={ARVenueScreen} />
            <Stack.Screen name="VenueDetails" component={VenueDetailsScreen} />

          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}