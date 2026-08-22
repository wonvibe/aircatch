export interface FoundFare {
  departDate: string;
  returnDate: string | null;
  price: number;
  currency: string;
  carrierCode: string | null;
  rawOffer: unknown;
  source: 'amadeus_flight_dates' | 'amadeus_flight_offers';
}

export interface SimpleFareQuery {
  origin: string;
  destination: string;
  dateFrom: string;
  dateTo: string;
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
  adults: number;
}
