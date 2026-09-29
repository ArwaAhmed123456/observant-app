import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiPatch } from './api';

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
    await Notifications.setNotificationChannelAsync('observant_alerts', {
      name: 'Security operations alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
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
