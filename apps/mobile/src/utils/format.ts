import { TripType } from '../api/types';

export function formatPrice(price: number, currency = 'KRW'): string {
  if (currency === 'KRW') {
    return `${price.toLocaleString('ko-KR')}원`;
  }
  return `${price.toLocaleString('en-US')} ${currency}`;
}

export function formatRoute(originIata: string | null, destinationIata: string | null): string {
  if (originIata && destinationIata) return `${originIata} → ${destinationIata}`;
  return '다구간 여정';
}

export function tripTypeLabel(tripType: TripType): string {
  switch (tripType) {
    case 'one_way':
      return '편도';
    case 'round_trip':
      return '왕복';
    case 'multi_city':
      return '다구간';
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateRange(from: string, to: string): string {
  return `${formatDate(from)} ~ ${formatDate(to)}`;
}
