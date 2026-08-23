import { apiClient } from './client';
import { Airport } from './types';

export const airportsApi = {
  search: (query: string) => apiClient.get<Airport[]>(`/airports/search?q=${encodeURIComponent(query)}`),
};
