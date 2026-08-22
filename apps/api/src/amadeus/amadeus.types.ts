// Minimal shapes for the Amadeus Self-Service responses we actually read —
// not full API coverage, just the fields this app uses.

export interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

/** GET /v1/shopping/flight-dates response item. */
export interface AmadeusFlightDateOffer {
  type: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  price: { total: string };
}

/** GET /v1/reference-data/locations response item. */
export interface AmadeusLocation {
  type: string;
  subType: 'AIRPORT' | 'CITY';
  iataCode: string;
  name: string;
  address?: {
    cityName?: string;
    countryName?: string;
  };
}

/** POST /v2/shopping/flight-offers response item (subset of fields used). */
export interface AmadeusFlightOffer {
  price: { total: string; currency: string };
  itineraries: {
    segments: {
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      carrierCode: string;
    }[];
  }[];
}

export interface AmadeusOriginDestination {
  id: string;
  originLocationCode: string;
  destinationLocationCode: string;
  departureDateTimeRange: { date: string };
}
