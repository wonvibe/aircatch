import { apiClient } from './client';
import { NotificationsPage } from './types';

export const notificationsApi = {
  list: (cursor?: string, limit = 20) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return apiClient.get<NotificationsPage>(`/notifications?${params.toString()}`);
  },
};
