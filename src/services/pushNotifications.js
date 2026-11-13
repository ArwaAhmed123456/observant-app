import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiPatch } from './api';

// Controls how notifications are handled when the app is in the FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

export async function registerPushNotifications() {
  try {
    if (Platform.OS === 'android') {
      // Android requires an explicit channel with sound + high importance
      await Notifications.setNotificationChannelAsync('observant_alerts', {
        name: 'Security operations alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Request permission — on iOS this triggers the system dialog
    const canReceiveNotifications = permission => {
      if (Platform.OS !== 'ios') return permission.granted;
      const status = permission.ios?.status;
      return permission.granted || [
        Notifications.IosAuthorizationStatus.AUTHORIZED,
        Notifications.IosAuthorizationStatus.PROVISIONAL,
        Notifications.IosAuthorizationStatus.EPHEMERAL,
      ].includes(status);
    };

    let permission = await Notifications.getPermissionsAsync();
    if (!canReceiveNotifications(permission)) {
      permission = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          provideAppNotificationSettings: true,
        },
      });
    }
    if (!canReceiveNotifications(permission)) {
      const status = Platform.OS === 'ios' ? permission.ios?.status : permission.status;
      console.warn(`[Observant] Push notifications are not authorized (status: ${status || 'unknown'}). Enable them in device Settings.`);
      return false;
    }

    const projectId = Constants.easConfig?.projectId
      || Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    // Save the token to the server so alerts can reach this device
    await apiPatch('/api/auth/me/fcm-token', { fcmToken: token.data });
    return true;
  } catch (error) {
    console.warn('[Observant] Push registration failed:', error.message);
    return false;
  }
}
