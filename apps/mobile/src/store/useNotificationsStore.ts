import { create } from 'zustand';
import { notificationsApi } from '../api/notifications';
import { NotificationLogEntry } from '../api/types';

interface NotificationsState {
  items: NotificationLogEntry[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  fetchFirstPage: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  nextCursor: null,
  loading: false,
  error: null,

  fetchFirstPage: async () => {
    set({ loading: true, error: null });
    try {
      const page = await notificationsApi.list();
      set({ items: page.items, nextCursor: page.nextCursor, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchNextPage: async () => {
    const { nextCursor, loading, items } = get();
    if (!nextCursor || loading) return;
    set({ loading: true });
    try {
      const page = await notificationsApi.list(nextCursor);
      set({ items: [...items, ...page.items], nextCursor: page.nextCursor, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
