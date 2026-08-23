import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { meApi } from '../api/me';
import { useAuthStore } from '../store/useAuthStore';

export type PushPermissionStatus = 'granted' | 'undetermined' | 'denied' | 'unsupported';

/**
 * Tracks push permission status and exposes a function to request it and
 * register the resulting Expo token with the backend.
 *
 * Deliberately never calls requestPermissionsAsync on its own — PRD asks
 * for an explanation before the OS permission dialog (see
 * components/PushPermissionBanner), and the OS dialog itself can't show
 * that text. `unsupported` means no EAS projectId is configured yet (see
 * README) — getExpoPushTokenAsync requires one.
 */
export function usePushRegistration() {
  const session = useAuthStore((s) => s.session);
  const [status, setStatus] = useState<PushPermissionStatus>('undetermined');

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

  const refreshStatus = useCallback(async () => {
    if (!projectId) {
      setStatus('unsupported');
      return;
    }
    const { status: current } = await Notifications.getPermissionsAsync();
    setStatus(toPushPermissionStatus(current));
  }, [projectId]);

  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(refreshStatus, 0);
    return () => clearTimeout(timeout);
  }, [session, refreshStatus]);

  const requestAndRegister = useCallback(async () => {
    if (!projectId) {
      console.warn('[push] No EAS projectId configured yet — cannot request push permission.');
      return;
    }

    const { status: current } = await Notifications.getPermissionsAsync();
    const finalStatus =
      current === 'granted' ? current : (await Notifications.requestPermissionsAsync()).status;
    setStatus(toPushPermissionStatus(finalStatus));
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    try {
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
      await meApi.registerDeviceToken(expoPushToken, { platform: Platform.OS });
    } catch (err) {
      console.warn('[push] Failed to register device token:', (err as Error).message);
    }
  }, [projectId]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { status, requestAndRegister, openSettings };
}

function toPushPermissionStatus(status: Notifications.PermissionStatus): PushPermissionStatus {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}
