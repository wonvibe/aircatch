import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ErrorState, LoadingState } from '../../components/StateViews';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PriceTrendChart } from './components/PriceTrendChart';
import { RecommendedDatesList } from './components/RecommendedDatesList';
import { PriceDisclaimerBanner } from './components/PriceDisclaimerBanner';
import { watchesApi } from '../../api/watches';
import { CalendarDateEntry, PriceHistoryEntry, Watch } from '../../api/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatDate, formatDateRange, formatPrice, formatRoute, tripTypeLabel } from '../../utils/format';
import {
  buildBookingSearchUrl,
  buildMultiCityBookingUrl,
  buildMultiCityGoogleFlightsUrl,
  buildMultiLegSearchInfo,
  buildSkyscannerSearchUrl,
} from '../../utils/booking';
import type { AppStackScreenProps } from '../../navigation/types';

const HISTORY_DAYS = 60;

export function PriceDetailScreen({ route, navigation }: AppStackScreenProps<'PriceDetail'>) {
  const { watchId } = route.params;
  const [watch, setWatch] = useState<Watch | null>(null);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [calendar, setCalendar] = useState<CalendarDateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [watchData, historyData, calendarData] = await Promise.all([
        watchesApi.get(watchId),
        watchesApi.priceHistory(watchId, HISTORY_DAYS),
        watchesApi.calendar(watchId),
      ]);
      setWatch(watchData);
      setHistory(historyData);
      setCalendar(calendarData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [watchId]);

  // Re-fetch on every focus (not just mount) — editing this watch pushes
  // EditWatchScreen on top rather than unmounting this screen, so a plain
  // mount-only effect would keep showing pre-edit data after Save pops back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = () => {
    Alert.alert('여정 삭제', '이 여정과 알림 내역이 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await watchesApi.remove(watchId);
            navigation.goBack();
          } catch (err) {
            setDeleting(false);
            Alert.alert('삭제 실패', (err as Error).message);
          }
        },
      },
    ]);
  };

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

        {watch.tripType === 'multi_city' ? (
          <>
            {/* Per-leg breakdown is reference-only — the exact date/price
                each leg's 현재가 came from. Both booking links below search
                the whole multi-city itinerary at once, on two different
                sites, so the user can compare. */}
            {buildMultiLegSearchInfo(watch, history[history.length - 1] ?? null).map((leg, index) => (
              <Card key={`${leg.originIata}-${leg.destinationIata}-${leg.departDate}`} style={styles.legCard}>
                <Text style={typography.body}>
                  구간 {index + 1}: {leg.originIata} → {leg.destinationIata}
                </Text>
                <Text style={styles.legDetail}>
                  {formatDate(leg.departDate)} 출발
                  {leg.price !== null ? ` · ${formatPrice(leg.price, watch.currency)}` : ''}
                </Text>
              </Card>
            ))}
            <Button
              label="Google Flights에서 다구간 통합 검색"
              onPress={() => Linking.openURL(buildMultiCityGoogleFlightsUrl(watch, history[history.length - 1] ?? null))}
              style={styles.bookingButton}
            />
            <Button
              label="Skyscanner에서 다구간 통합 검색"
              variant="secondary"
              onPress={() => Linking.openURL(buildMultiCityBookingUrl(watch, history[history.length - 1] ?? null))}
              style={styles.bookingButton}
            />
          </>
        ) : (
          <>
            <Button
              label="Google Flights에서 확인하기"
              onPress={() => Linking.openURL(buildBookingSearchUrl(watch, history[history.length - 1] ?? null))}
              style={styles.bookingButton}
            />
            <Button
              label="Skyscanner에서 확인하기"
              variant="secondary"
              onPress={() => Linking.openURL(buildSkyscannerSearchUrl(watch, history[history.length - 1] ?? null))}
              style={styles.bookingButton}
            />
          </>
        )}
        <PriceDisclaimerBanner tripType={watch.tripType} />

        <Text style={styles.sectionTitle}>가격 추이 (최근 {HISTORY_DAYS}일)</Text>
        <PriceTrendChart history={history} />

        {watch.tripType !== 'multi_city' ? (
          <>
            <Text style={styles.sectionTitle}>목표가 이하 추천 일정</Text>
            <RecommendedDatesList calendar={calendar} targetPrice={watch.targetPrice} currency={watch.currency} />
          </>
        ) : (
          <View style={styles.unavailableNote}>
            <Text style={typography.bodySecondary}>
              다구간 여정은 구간마다 날짜가 하나로 고정돼 있어, 추천할 다른 날짜가 없어요.
            </Text>
          </View>
        )}

        <Button
          label="여정 수정"
          variant="secondary"
          onPress={() => navigation.navigate('EditWatch', { watch })}
          style={styles.editButton}
        />
        <Button
          label="여정 삭제"
          variant="danger"
          loading={deleting}
          onPress={confirmDelete}
          style={styles.deleteButton}
        />
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
  legCard: {
    marginBottom: spacing.sm,
  },
  legDetail: {
    ...typography.bodySecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  unavailableNote: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  editButton: {
    marginTop: spacing.xl,
  },
  deleteButton: {
    marginTop: spacing.sm,
  },
});
