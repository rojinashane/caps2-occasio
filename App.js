import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens & Components
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import DashboardScreen from './screens/DashboardScreen';
import AddEvent from './components/AddEvent';
import EventDetailsScreen from './screens/EventDetailsScreen';
import UpdateEvent from './components/UpdateEvent';
import Venuepicker from './components/Venuepicker';
import ProfileScreen from './screens/ProfileScreen';
import RSVPTrackerScreen from './screens/RSVPTrackerScreen';
import MyEventsScreen from './screens/MyEventsScreen';
import VendorScreen from './screens/VendorScreen';
import Vendorpicker from './components/Vendorpicker';
import VenueOwner from './screens/VenueOwnerScreen';
import VenueOwnerProfile from './screens/VenueOwnerProfileScreen';
import AddVenue from './components/AddVenue';
import GuideModal from './components/GuideModal';
import AddVendor from './components/AddVendor';

// NEW: Services & AR Screens
import NotificationService from './services/NotificationService';
import VenuesScreen from './screens/VenuesScreen';
import ARVenueScreen from './screens/ARVenueScreen';
import VenueDetailsScreen from './screens/VenueDetailsScreen';

// CONFIGURE NOTIFICATIONS
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    NotificationService.registerForPushNotificationsAsync();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await user.reload();
          // CHANGE 'Dashboard' TO 'DashboardScreen'
          setInitialRoute(user.emailVerified ? 'DashboardScreen' : 'Landing');
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
            <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
            <Stack.Screen name="AddEvent" component={AddEvent} />
            <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
            <Stack.Screen name="UpdateEvent" component={UpdateEvent} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="RSVPTrackerScreen" component={RSVPTrackerScreen} />
            <Stack.Screen name="MyEvents" component={MyEventsScreen} />
            <Stack.Screen name="VendorScreen" component={VendorScreen} />
            <Stack.Screen name="Venues" component={VenuesScreen} />
            <Stack.Screen name="VenueDetails" component={VenueDetailsScreen} />
            <Stack.Screen name="ARVenue" component={ARVenueScreen} />
            <Stack.Screen name="Venuepicker" component={Venuepicker} />
            <Stack.Screen name="Vendorpicker" component={Vendorpicker} />
            <Stack.Screen name="VenueOwnerScreen" component={VenueOwner} />
            <Stack.Screen name="AddVenue" component={AddVenue} />
            <Stack.Screen name="GuideModal" component={GuideModal} />
            <Stack.Screen name="AddVendor" component={AddVendor} />
            
            {/* CHANGED NAME TO MATCH YOUR NAVIGATION CALL */}
            <Stack.Screen name="VenueOwnerProfile" component={VenueOwnerProfile} />
            
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}