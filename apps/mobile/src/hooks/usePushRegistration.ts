import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { meApi } from '../api/me';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Requests notification permission and registers the device's Expo push
 * token with the backend once a session exists. No-ops (with a console
 * warning) until this project has a real EAS projectId — getExpoPushTokenAsync
 * requires one, and none is configured yet (see README, Phase 5/EAS setup).
 */
export function usePushRegistration() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const register = async () => {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (!projectId) {
        console.warn('[push] No EAS projectId configured yet — skipping push token registration.');
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted' || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      try {
        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!cancelled) {
          await meApi.registerDeviceToken(expoPushToken, { platform: Platform.OS });
        }
      } catch (err) {
        console.warn('[push] Failed to register device token:', (err as Error).message);
      }
    };

    register();

    return () => {
      cancelled = true;
    };
  }, [session]);
}
