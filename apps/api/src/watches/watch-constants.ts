export const TRIP_TYPES = ['one_way', 'round_trip', 'multi_city'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const WATCH_STATUSES = ['active', 'paused', 'archived'] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];
