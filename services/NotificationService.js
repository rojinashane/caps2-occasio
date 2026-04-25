import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
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
                lightColor: '#00686F', // Occasio app accent color
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

            // Remote push token (Uncomment when you're ready for cloud messaging)
            // token = (await Notifications.getExpoPushTokenAsync()).data;
        } else {
            console.log('Must use a physical device for Push Notifications');
        }

        return token;
    }

    /**
     * Schedule a future notification (e.g., an event reminder)
     * @param {string} title 
     * @param {string} body 
     * @param {Date} date - Must be a JavaScript Date object in the future
     */
    static async scheduleEventReminder(title, body, date) {
        try {
            // Safety check: ensure date is in the future
            if (date <= new Date()) {
                console.warn("Attempted to schedule notification in the past. Triggering immediately instead.");
                return await this.sendImmediateNotification(title, body);
            }

            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title: title,
                    body: body,
                    sound: true,
                },
                trigger: {
                    date: date,
                    channelId: 'default', // Matches the channel created in register function
                },
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
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: true,
                },
                trigger: null, // null triggers immediately
            });
        } catch (error) {
            console.error("Error sending immediate notification: ", error);
        }
    }

    /**
     * Cancel a specific scheduled notification (useful if an event is deleted)
     * @param {string} id 
     */
    static async cancelNotification(id) {
        await Notifications.cancelScheduledNotificationAsync(id);
    }
}

export default NotificationService;