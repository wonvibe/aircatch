import { create } from 'zustand';
import { watchesApi } from '../api/watches';
import { CreateWatchInput, UpdateWatchInput, Watch } from '../api/types';

interface WatchesState {
  watches: Watch[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (input: CreateWatchInput) => Promise<Watch>;
  update: (id: string, input: UpdateWatchInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useWatchesStore = create<WatchesState>((set, get) => ({
  watches: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const watches = await watchesApi.list();
      set({ watches, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  create: async (input) => {
    const watch = await watchesApi.create(input);
    set({ watches: [watch, ...get().watches] });
    return watch;
  },

  update: async (id, input) => {
    const updated = await watchesApi.update(id, input);
    set({ watches: get().watches.map((w) => (w.id === id ? updated : w)) });
  },

  remove: async (id) => {
    await watchesApi.remove(id);
    set({ watches: get().watches.filter((w) => w.id !== id) });
  },
}));
