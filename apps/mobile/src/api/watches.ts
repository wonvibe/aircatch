import { apiClient } from './client';
import {
  CalendarDateEntry,
  CreateWatchInput,
  PriceHistoryEntry,
  UpdateWatchInput,
  Watch,
} from './types';

export const watchesApi = {
  list: () => apiClient.get<Watch[]>('/watches'),
  get: (id: string) => apiClient.get<Watch>(`/watches/${id}`),
  create: (input: CreateWatchInput) => apiClient.post<Watch>('/watches', input),
  update: (id: string, input: UpdateWatchInput) => apiClient.patch<Watch>(`/watches/${id}`, input),
  remove: (id: string) => apiClient.delete<void>(`/watches/${id}`),
  priceHistory: (id: string, days = 60) =>
    apiClient.get<PriceHistoryEntry[]>(`/watches/${id}/price-history?days=${days}`),
  // Full "which future dates are cheap" snapshot backing the recommended
  // date-range list — separate from priceHistory, which is one point per
  // check (used for the trend chart) rather than a calendar of dates.
  calendar: (id: string) => apiClient.get<CalendarDateEntry[]>(`/watches/${id}/calendar`),
};
