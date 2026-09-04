import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/StateViews';
import { AirportSearchInput } from '../NewWatch/components/AirportSearchInput';
import { DateField } from '../NewWatch/components/DateField';
import { MultiCitySegmentList, SegmentDraft } from '../NewWatch/components/MultiCitySegmentList';
import { useWatchesStore } from '../../store/useWatchesStore';
import { airportsApi } from '../../api/airports';
import { Airport } from '../../api/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { addMonths, toDateString } from '../../utils/date';
import { tripTypeLabel } from '../../utils/format';
import type { AppStackScreenProps } from '../../navigation/types';

const TODAY = new Date();
const MAX_DATE = addMonths(TODAY, 2); // matches NewWatchScreen's 2-month search-window cap

// Watches only persist IATA codes, not the city/name text AirportSearchInput
// displays — so origin/destination/segments start empty and are hydrated
// from GET /airports/:iataCode once on mount, same idea as NewWatchScreen
// but working backwards from an existing watch instead of a blank form.
export function EditWatchScreen({ route, navigation }: AppStackScreenProps<'EditWatch'>) {
  const { watch } = route.params;
  const update = useWatchesStore((s) => s.update);
  const isMultiCity = watch.tripType === 'multi_city';

  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [departDateFrom, setDepartDateFrom] = useState(new Date(watch.departDateFrom));
  const [departDateTo, setDepartDateTo] = useState(new Date(watch.departDateTo));
  // Pre-existing round_trip watches can have null return dates — see
  // booking.ts/PriceDetailScreen: without them the backend silently prices
  // (and links) the watch as one-way. Default to the depart window so
  // editing one of those watches gives the user a sane starting point to
  // actually set return dates, fixing the watch in the process.
  const [returnDateFrom, setReturnDateFrom] = useState(
    new Date(watch.returnDateFrom ?? watch.departDateFrom),
  );
  const [returnDateTo, setReturnDateTo] = useState(new Date(watch.returnDateTo ?? watch.departDateTo));
  const [segments, setSegments] = useState<SegmentDraft[]>([]);
  const [targetPrice, setTargetPrice] = useState(String(watch.targetPrice));
  const [adults, setAdults] = useState(String(watch.adults));
  const [hydrating, setHydrating] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        if (!isMultiCity) {
          const [originAirport, destinationAirport] = await Promise.all([
            watch.originIata ? airportsApi.getByCode(watch.originIata) : Promise.resolve(null),
            watch.destinationIata ? airportsApi.getByCode(watch.destinationIata) : Promise.resolve(null),
          ]);
          if (cancelled) return;
          setOrigin(originAirport);
          setDestination(destinationAirport);
        } else {
          const watchSegments = watch.segments ?? [];
          const airports = await Promise.all(
            watchSegments.flatMap((segment) => [
              airportsApi.getByCode(segment.originIata),
              airportsApi.getByCode(segment.destinationIata),
            ]),
          );
          if (cancelled) return;
          setSegments(
            watchSegments.map((segment, index) => ({
              origin: airports[index * 2],
              destination: airports[index * 2 + 1],
              date: new Date(segment.dateFrom),
            })),
          );
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
    // watch is passed once via navigation params and not expected to change
    // underneath this screen — re-running on every render would refetch and
    // reset in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = (): string | null => {
    if (!isMultiCity) {
      if (!origin || !destination) return '출발지와 도착지를 선택해주세요.';
      if (origin.iataCode === destination.iataCode) return '출발지와 도착지가 같을 수 없어요.';
      if (departDateFrom > departDateTo) return '탐색 시작일이 종료일보다 늦을 수 없어요.';
      if (watch.tripType === 'round_trip') {
        if (returnDateFrom > returnDateTo) return '귀국 시작일이 종료일보다 늦을 수 없어요.';
        if (returnDateFrom < departDateFrom) return '귀국 시작일이 출발 시작일보다 빠를 수 없어요.';
      }
    } else {
      for (const [i, segment] of segments.entries()) {
        if (!segment.origin || !segment.destination) return `구간 ${i + 1}의 출발/도착지를 선택해주세요.`;
      }
    }
    const price = Number(targetPrice);
    if (!targetPrice || Number.isNaN(price) || price <= 0) return '목표가를 올바르게 입력해주세요.';
    const adultsCount = Number(adults);
    if (!adults || Number.isNaN(adultsCount) || adultsCount < 1) return '인원 수를 올바르게 입력해주세요.';
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await update(watch.id, {
        targetPrice: Number(targetPrice),
        adults: Number(adults),
        ...(!isMultiCity
          ? {
              originIata: origin!.iataCode,
              destinationIata: destination!.iataCode,
              departDateFrom: toDateString(departDateFrom),
              departDateTo: toDateString(departDateTo),
              ...(watch.tripType === 'round_trip'
                ? {
                    returnDateFrom: toDateString(returnDateFrom),
                    returnDateTo: toDateString(returnDateTo),
                  }
                : undefined),
            }
          : {
              segments: segments.map((segment, index) => ({
                sequenceNo: index,
                originIata: segment.origin!.iataCode,
                destinationIata: segment.destination!.iataCode,
                dateFrom: toDateString(segment.date),
                dateTo: toDateString(segment.date),
              })),
            }),
      });
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (hydrating) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <Text style={styles.tripTypeLabel}>{tripTypeLabel(watch.tripType)} 여정 수정</Text>

          {!isMultiCity ? (
            <>
              <AirportSearchInput label="출발지" value={origin} onChange={setOrigin} />
              <AirportSearchInput label="도착지" value={destination} onChange={setDestination} />

              <Text style={styles.sectionLabel}>탐색 기간 (최대 2개월)</Text>
              <View style={styles.dateRow}>
                <DateField
                  label="시작일"
                  value={departDateFrom}
                  minimumDate={TODAY}
                  maximumDate={MAX_DATE}
                  onChange={setDepartDateFrom}
                  style={styles.dateFieldLeft}
                />
                <DateField
                  label="종료일"
                  value={departDateTo}
                  minimumDate={departDateFrom}
                  maximumDate={MAX_DATE}
                  onChange={setDepartDateTo}
                />
              </View>

              {watch.tripType === 'round_trip' && (
                <>
                  <Text style={styles.sectionLabel}>귀국 기간 (최대 2개월)</Text>
                  <View style={styles.dateRow}>
                    <DateField
                      label="시작일"
                      value={returnDateFrom}
                      minimumDate={departDateFrom}
                      maximumDate={MAX_DATE}
                      onChange={setReturnDateFrom}
                      style={styles.dateFieldLeft}
                    />
                    <DateField
                      label="종료일"
                      value={returnDateTo}
                      minimumDate={returnDateFrom}
                      maximumDate={MAX_DATE}
                      onChange={setReturnDateTo}
                    />
                  </View>
                </>
              )}
            </>
          ) : (
            <MultiCitySegmentList segments={segments} onChange={setSegments} minDate={TODAY} maxDate={MAX_DATE} />
          )}

          <TextField
            label="목표 예산 (원)"
            placeholder="예: 400000"
            keyboardType="number-pad"
            value={targetPrice}
            onChangeText={setTargetPrice}
          />
          {(watch.tripType === 'round_trip' || isMultiCity) && (
            <Text style={styles.targetPriceHint}>
              {watch.tripType === 'round_trip'
                ? '왕복 가격은 가는 편·오는 편 편도가를 합산한 값이라 실제 왕복 예매가보다 높게 나올 수 있어요. 목표가를 여유 있게 설정하는 걸 추천해요.'
                : '다구간 가격은 구간별 편도가의 합산이라 실제 예매가보다 높게 나올 수 있어요. 목표가를 여유 있게 설정하는 걸 추천해요.'}
            </Text>
          )}
          <TextField label="인원" keyboardType="number-pad" value={adults} onChangeText={setAdults} />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button label="저장하기" onPress={submit} loading={submitting} style={styles.submitButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  tripTypeLabel: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodySecondary,
    marginBottom: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateFieldLeft: {
    marginRight: 0,
  },
  targetPriceHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySecondary,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
});
