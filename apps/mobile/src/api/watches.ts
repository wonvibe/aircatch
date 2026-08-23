import { apiClient } from './client';
import { CreateWatchInput, PriceHistoryEntry, UpdateWatchInput, Watch } from './types';

export const watchesApi = {
  list: () => apiClient.get<Watch[]>('/watches'),
  get: (id: string) => apiClient.get<Watch>(`/watches/${id}`),
  create: (input: CreateWatchInput) => apiClient.post<Watch>('/watches', input),
  update: (id: string, input: UpdateWatchInput) => apiClient.patch<Watch>(`/watches/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/watches/${id}`),
  priceHistory: (id: string, days = 60) =>
    apiClient.get<PriceHistoryEntry[]>(`/watches/${id}/price-history?days=${days}`),
};
