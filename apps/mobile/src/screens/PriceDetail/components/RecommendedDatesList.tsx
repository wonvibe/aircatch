import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/Card';
import { PriceHistoryEntry } from '../../../api/types';
import { colors, spacing, typography } from '../../../theme/tokens';
import { formatPrice } from '../../../utils/format';

interface Props {
  history: PriceHistoryEntry[];
  targetPrice: number;
  currency: string;
}

/** Derived client-side from price_history (already fetched for the chart)
 * rather than a dedicated backend endpoint — target-price-or-below dates,
 * deduped to the cheapest fare seen per date. */
export function RecommendedDatesList({ history, targetPrice, currency }: Props) {
  const cheapestByDate = new Map<string, PriceHistoryEntry>();
  for (const entry of history) {
    if (entry.price > targetPrice) continue;
    const existing = cheapestByDate.get(entry.departDate);
    if (!existing || entry.price < existing.price) {
      cheapestByDate.set(entry.departDate, entry);
    }
  }

  const recommended = Array.from(cheapestByDate.values())
    .sort((a, b) => a.price - b.price)
    .slice(0, 5);

  if (recommended.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={typography.bodySecondary}>아직 목표가 이하로 떨어진 날짜가 없어요.</Text>
      </View>
    );
  }

  return (
    <View>
      {recommended.map((entry) => (
        <Card key={entry.id} style={styles.row}>
          <Text style={typography.body}>{formatDeparture(entry.departDate)}</Text>
          <Text style={styles.price}>{formatPrice(entry.price, currency)}</Text>
        </Card>
      ))}
    </View>
  );
}

function formatDeparture(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
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
