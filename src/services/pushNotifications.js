import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiPatch } from './api';

// Controls how notifications are handled when the app is in the FOREGROUND
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

export async function registerPushNotifications() {
  try {
    if (Platform.OS === 'android') {
      // Android requires an explicit channel with sound + max importance
      await Notifications.setNotificationChannelAsync('observant_alerts_v2', {
        name: 'Urgent Security Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        lightColor: '#EF4444',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
      await Notifications.setNotificationChannelAsync('observant_alerts', {
        name: 'Security operations alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        lightColor: '#FFBF00',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // Request permission — on iOS and Android 13+ this triggers the system dialog
    const canReceiveNotifications = permission => {
      if (Platform.OS !== 'ios') return permission.granted || permission.status === 'granted';
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
