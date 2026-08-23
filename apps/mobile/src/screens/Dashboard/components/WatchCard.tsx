import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/Card';
import { Watch } from '../../../api/types';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import { formatDateRange, formatPrice, formatRoute, tripTypeLabel } from '../../../utils/format';

interface Props {
  watch: Watch;
  onPress: () => void;
}

export function WatchCard({ watch, onPress }: Props) {
  const hasBothPrices = watch.baselinePrice !== null && watch.latestPrice !== null;
  const isDown = hasBothPrices && watch.latestPrice! < watch.baselinePrice!;
  const dropAmount = hasBothPrices ? watch.baselinePrice! - watch.latestPrice! : 0;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.route}>{formatRoute(watch.originIata, watch.destinationIata)}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{tripTypeLabel(watch.tripType)}</Text>
        </View>
      </View>

      <Text style={styles.dateRange}>{formatDateRange(watch.departDateFrom, watch.departDateTo)} 출발</Text>

      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>기준가</Text>
          <Text style={styles.priceValue}>
            {watch.baselinePrice !== null ? formatPrice(watch.baselinePrice, watch.currency) : '조회 중'}
          </Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>현재가</Text>
          <Text style={[styles.priceValueHeavy, isDown && styles.priceDown]}>
            {watch.latestPrice !== null ? formatPrice(watch.latestPrice, watch.currency) : '조회 중'}
          </Text>
        </View>
        {isDown && (
          <View style={styles.dropPill}>
            <Text style={styles.dropPillText}>-{formatPrice(dropAmount, watch.currency)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  route: {
    ...typography.subtitle,
  },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dateRange: {
    ...typography.bodySecondary,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  priceCol: {
    gap: 2,
  },
  priceLabel: {
    ...typography.caption,
  },
  priceValue: {
    ...typography.priceMedium,
    color: colors.textSecondary,
  },
  priceValueHeavy: {
    ...typography.priceHeavy,
  },
  priceDown: {
    color: colors.accentMint,
  },
  dropPill: {
    marginLeft: 'auto',
    backgroundColor: colors.accentMintSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dropPillText: {
    ...typography.caption,
    color: colors.accentMint,
    fontWeight: '700',
  },
});
