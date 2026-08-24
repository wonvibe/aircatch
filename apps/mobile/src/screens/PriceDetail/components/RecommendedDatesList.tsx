import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/Card';
import { CalendarDateEntry } from '../../../api/types';
import { colors, spacing, typography } from '../../../theme/tokens';
import { formatDate, formatPrice } from '../../../utils/format';

interface Props {
  calendar: CalendarDateEntry[];
  targetPrice: number;
  currency: string;
}

interface DateRange {
  startDate: string;
  endDate: string;
  minPrice: number;
}

const MAX_RANGES = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fed by GET /watches/:id/calendar — a full per-date price snapshot fetched
 * separately from price_history (which is one point per check, for the
 * trend chart, not a calendar of dates). Target-price-or-below dates are
 * grouped into consecutive-day ranges (e.g. "9/7 ~ 9/10") so a run of good
 * days reads as one recommendation instead of a wall of single-day rows.
 */
export function RecommendedDatesList({ calendar, targetPrice, currency }: Props) {
  const cheapestByDate = new Map<string, number>();
  for (const entry of calendar) {
    if (entry.price > targetPrice) continue;
    const existing = cheapestByDate.get(entry.date);
    if (existing === undefined || entry.price < existing) {
      cheapestByDate.set(entry.date, entry.price);
    }
  }

  const ranges: DateRange[] = [];
  for (const date of Array.from(cheapestByDate.keys()).sort()) {
    const price = cheapestByDate.get(date) as number;
    const last = ranges[ranges.length - 1];
    if (last && isNextDay(last.endDate, date)) {
      last.endDate = date;
      last.minPrice = Math.min(last.minPrice, price);
    } else {
      ranges.push({ startDate: date, endDate: date, minPrice: price });
    }
  }

  const recommended = ranges.sort((a, b) => a.minPrice - b.minPrice).slice(0, MAX_RANGES);

  if (recommended.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={typography.bodySecondary}>아직 목표가 이하로 떨어진 날짜가 없어요.</Text>
      </View>
    );
  }

  return (
    <View>
      {recommended.map((range) => (
        <Card key={range.startDate} style={styles.row}>
          <Text style={typography.body}>{formatRange(range)}</Text>
          <Text style={styles.price}>{formatPrice(range.minPrice, currency)}</Text>
        </Card>
      ))}
    </View>
  );
}

function isNextDay(dateStr: string, candidateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00Z`).getTime();
  const candidate = new Date(`${candidateStr}T00:00:00Z`).getTime();
  return candidate - date === ONE_DAY_MS;
}

function formatRange({ startDate, endDate }: DateRange): string {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.priceMedium,
    color: colors.accentMint,
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
