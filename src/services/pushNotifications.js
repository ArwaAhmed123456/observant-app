import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiPatch } from './api';

// Foreground notification handler — show banner + play sound even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushNotifications() {
  try {
    if (Platform.OS === 'android') {
      // Must set the channel BEFORE requesting the token
      // Sound file must match the name in assets/notification.wav
      await Notifications.setNotificationChannelAsync('observant_alerts', {
        name: 'Security operations alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'notification.wav',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      permission = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,  // allows sound even in Do Not Disturb
          provideAppNotificationSettings: true,
        },
      });
    }
    if (!permission.granted) return false;

    const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await apiPatch('/api/auth/me/fcm-token', { fcmToken: token.data });
    return true;
  } catch (error) {
    console.warn('[Observant] Push registration was unavailable:', error.message);
    return false;
  }
}
