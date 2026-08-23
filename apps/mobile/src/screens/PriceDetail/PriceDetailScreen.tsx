import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Button } from '../../components/Button';
import { PriceTrendChart } from './components/PriceTrendChart';
import { RecommendedDatesList } from './components/RecommendedDatesList';
import { PriceDisclaimerBanner } from './components/PriceDisclaimerBanner';
import { watchesApi } from '../../api/watches';
import { PriceHistoryEntry, Watch } from '../../api/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatDateRange, formatPrice, formatRoute, tripTypeLabel } from '../../utils/format';
import { buildBookingSearchUrl } from '../../utils/booking';
import type { AppStackScreenProps } from '../../navigation/types';

const HISTORY_DAYS = 60;

export function PriceDetailScreen({ route }: AppStackScreenProps<'PriceDetail'>) {
  const { watchId } = route.params;
  const [watch, setWatch] = useState<Watch | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [watchData, historyData] = await Promise.all([
        watchesApi.get(watchId),
        watchesApi.priceHistory(watchId, HISTORY_DAYS),
      ]);
      setWatch(watchData);
      setHistory(historyData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [watchId]);

  useEffect(() => {
    // Deferred so `load`'s setState calls never run synchronously as part
    // of the effect body itself (avoids cascading renders on mount).
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error || !watch) {
    return (
      <ScreenContainer>
        <ErrorState message={error ?? '여정 정보를 불러오지 못했어요.'} onRetry={load} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.title}>{formatRoute(watch.originIata, watch.destinationIata)}</Text>
        <Text style={styles.subtitle}>
          {tripTypeLabel(watch.tripType)} · {formatDateRange(watch.departDateFrom, watch.departDateTo)}
        </Text>

        <View style={styles.priceSummary}>
          <View>
            <Text style={typography.caption}>기준가</Text>
            <Text style={styles.priceMedium}>
              {watch.baselinePrice !== null ? formatPrice(watch.baselinePrice, watch.currency) : '조회 중'}
            </Text>
          </View>
          <View>
            <Text style={typography.caption}>현재가</Text>
            <Text style={styles.priceHeavy}>
              {watch.latestPrice !== null ? formatPrice(watch.latestPrice, watch.currency) : '조회 중'}
            </Text>
          </View>
          <View>
            <Text style={typography.caption}>목표가</Text>
            <Text style={styles.priceMedium}>{formatPrice(watch.targetPrice, watch.currency)}</Text>
          </View>
        </View>

        <Button
          label="예매처에서 확인하기"
          onPress={() => Linking.openURL(buildBookingSearchUrl(watch))}
          style={styles.bookingButton}
        />
        <PriceDisclaimerBanner />

        <Text style={styles.sectionTitle}>가격 추이 (최근 {HISTORY_DAYS}일)</Text>
        <PriceTrendChart history={history} />

        <Text style={styles.sectionTitle}>목표가 이하 추천 일정</Text>
        <RecommendedDatesList history={history} targetPrice={watch.targetPrice} currency={watch.currency} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    ...typography.bodySecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  priceMedium: {
    ...typography.priceMedium,
  },
  priceHeavy: {
    ...typography.priceHeavy,
    color: colors.accentBlue,
  },
  bookingButton: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
