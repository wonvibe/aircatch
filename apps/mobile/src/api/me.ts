import { apiClient } from './client';
import { Profile } from './types';

export const meApi = {
  getProfile: () => apiClient.get<Profile>('/me'),
  registerDeviceToken: (expoPushToken: string, deviceInfo?: Record<string, unknown>) =>
    apiClient.post('/me/device-tokens', { expoPushToken, deviceInfo }),
};
