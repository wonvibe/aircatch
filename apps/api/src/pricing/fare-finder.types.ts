export interface FoundFare {
  departDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
  carrierCode: string | null;
  rawOffer: unknown;
  source: 'travelpayouts_calendar' | 'travelpayouts_multi_city_sum';
}

export interface SimpleFareQuery {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo: string;
  // Only used when both are present (round_trip watches don't require
  // return dates — see CreateWatchDto). Priced as outbound + cheapest
  // return leg found separately; Travelpayouts has no combined round-trip
  // quote endpoint, so this is a sum-of-legs approximation, same idea as
  // multi-city below.
  returnDateFrom?: string;
  returnDateTo?: string;
  currency: string;
}

export interface MultiCityLeg {
  sequenceNo: number;
  originIata: string;
  destinationIata: string;
  dateFrom: string;
}

export interface MultiCityFareQuery {
  legs: MultiCityLeg[];
  currency: string;
}
