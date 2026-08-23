// Shapes for the Travelpayouts Data API (https://travelpayouts.github.io/slate/)
// — only the fields this app reads.

/** One day's cheapest fare from GET /v1/prices/calendar. */
export interface TravelpayoutsCalendarOffer {
  origin: string;
  destination: string;
  price: number;
  transfers: number;
  airline: string;
  flight_number: number;
  departure_at: string;
  return_at?: string;
  expires_at: string;
}

export interface TravelpayoutsCalendarResponse {
  success: boolean;
  // Keyed by ISO date (YYYY-MM-DD). The upstream API serializes an empty
  // result as `[]` instead of `{}` (empty-object-vs-array PHP quirk), so
  // callers must handle both.
  data: Record<string, TravelpayoutsCalendarOffer> | [];
  error: string | null;
}
