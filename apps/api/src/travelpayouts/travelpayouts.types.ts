// Shapes for the Travelpayouts Data API (https://travelpayouts.github.io/slate/)
// — only the fields this app reads.

/** One cached fare from GET /v2/prices/latest. `return_date` is `''` for a
 * genuinely one-way entry (requested with one_way=true); populated for a
 * round-trip entry (one_way=false). See price-cache.service.ts for why this
 * replaced /v1/prices/calendar. */
export interface TravelpayoutsLatestPriceEntry {
  origin: string;
  destination: string;
  depart_date: string;
  return_date: string;
  value: number;
  number_of_changes: number;
  found_at: string;
  actual: boolean;
}

export interface TravelpayoutsLatestPricesResponse {
  success: boolean;
  data: TravelpayoutsLatestPriceEntry[];
  error: string;
}
