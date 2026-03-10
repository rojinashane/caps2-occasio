import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

class NotificationService {
    /**
     * Request permissions and configure channels (required for Android)
     */
    static async registerForPushNotificationsAsync() {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#00686F', // Your app's accent color
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get notification permissions!');
                return null;
            }

            // Uncomment the lines below if you integrate a backend for remote push notifications later:
            // token = (await Notifications.getExpoPushTokenAsync()).data;
            // console.log("Expo Push Token:", token);
        } else {
            console.log('Must use a physical device for Push Notifications');
        }

        return token;
    }

    /**
     * Schedule a future notification (e.g., an event reminder)
     * @param {string} title 
     * @param {string} body 
     * @param {Date} date - When the notification should fire
     */
    static async scheduleEventReminder(title, body, date) {
        try {
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: title,
                    body: body,
                    sound: true,
                },
                trigger: date,
            });
            return id;
        } catch (error) {
            console.error("Error scheduling notification: ", error);
        }
    }

    /**
     * Trigger an immediate notification (e.g., when a Firestore invite comes in)
     * @param {string} title 
     * @param {string} body 
     */
    static async sendImmediateNotification(title, body) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
            },
            trigger: null, // null means trigger immediately
        });
    }
}

export default NotificationService;