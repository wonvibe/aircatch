import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { TripTypeSelector } from './components/TripTypeSelector';
import { AirportSearchInput } from './components/AirportSearchInput';
import { DateField } from './components/DateField';
import { MultiCitySegmentList, SegmentDraft } from './components/MultiCitySegmentList';
import { useWatchesStore } from '../../store/useWatchesStore';
import { Airport, TripType } from '../../api/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { addMonths, toDateString } from '../../utils/date';
import type { AppStackScreenProps } from '../../navigation/types';

const TODAY = new Date();
const MAX_DATE = addMonths(TODAY, 2); // PRD: 향후 2개월 탐색 범위

export function NewWatchScreen({ navigation }: AppStackScreenProps<'NewWatch'>) {
  const createWatch = useWatchesStore((s) => s.create);

  const [tripType, setTripType] = useState<TripType>('one_way');
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [departDateFrom, setDepartDateFrom] = useState(TODAY);
  const [departDateTo, setDepartDateTo] = useState(MAX_DATE);
  const [segments, setSegments] = useState<SegmentDraft[]>([
    { origin: null, destination: null, date: TODAY },
    { origin: null, destination: null, date: TODAY },
  ]);
  const [targetPrice, setTargetPrice] = useState('');
  const [adults, setAdults] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (tripType !== 'multi_city') {
      if (!origin || !destination) return '출발지와 도착지를 선택해주세요.';
      if (origin.iataCode === destination.iataCode) return '출발지와 도착지가 같을 수 없어요.';
    } else {
      for (const [i, segment] of segments.entries()) {
        if (!segment.origin || !segment.destination) return `구간 ${i + 1}의 출발/도착지를 선택해주세요.`;
      }
    }
    // Multi-city has no separate "탐색 기간" UI — its search window is
    // derived from the segment dates at submit time instead.
    if (tripType !== 'multi_city' && departDateFrom > departDateTo) {
      return '탐색 시작일이 종료일보다 늦을 수 없어요.';
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
      // The backend still requires depart_date_from/to on every watch (used
      // for one_way/round_trip pricing), but multi-city pricing only ever
      // reads the segments' own dates — so for multi-city, derive a window
      // that just spans the segments instead of asking the user to set a
      // second, unused date range.
      const segmentDates = segments.map((s) => s.date.getTime());
      const isMultiCity = tripType === 'multi_city';
      const rangeFrom = isMultiCity ? new Date(Math.min(...segmentDates)) : departDateFrom;
      const rangeTo = isMultiCity ? new Date(Math.max(...segmentDates)) : departDateTo;

      await createWatch({
        tripType,
        originIata: !isMultiCity ? origin!.iataCode : undefined,
        destinationIata: !isMultiCity ? destination!.iataCode : undefined,
        departDateFrom: toDateString(rangeFrom),
        departDateTo: toDateString(rangeTo),
        adults: Number(adults),
        targetPrice: Number(targetPrice),
        segments: isMultiCity
          ? segments.map((segment, index) => ({
              sequenceNo: index,
              originIata: segment.origin!.iataCode,
              destinationIata: segment.destination!.iataCode,
              dateFrom: toDateString(segment.date),
              dateTo: toDateString(segment.date),
            }))
          : undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <Text style={[typography.title, styles.title]}>새 알림 등록</Text>

          <TripTypeSelector value={tripType} onChange={setTripType} />

          {tripType !== 'multi_city' ? (
            <>
              <AirportSearchInput label="출발지" value={origin} onChange={setOrigin} />
              <AirportSearchInput label="도착지" value={destination} onChange={setDestination} />
            </>
          ) : (
            <MultiCitySegmentList segments={segments} onChange={setSegments} minDate={TODAY} maxDate={MAX_DATE} />
          )}

          {tripType !== 'multi_city' && (
            <>
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
            </>
          )}

          <TextField
            label="목표 예산 (원)"
            placeholder="예: 400000"
            keyboardType="number-pad"
            value={targetPrice}
            onChangeText={setTargetPrice}
          />
          {(tripType === 'round_trip' || tripType === 'multi_city') && (
            <Text style={styles.targetPriceHint}>
              {tripType === 'round_trip'
                ? '왕복 가격은 가는 편·오는 편 편도가를 합산한 값이라 실제 왕복 예매가보다 높게 나올 수 있어요. 목표가를 여유 있게 설정하는 걸 추천해요.'
                : '다구간 가격은 구간별 편도가의 합산이라 실제 예매가보다 높게 나올 수 있어요. 목표가를 여유 있게 설정하는 걸 추천해요.'}
            </Text>
          )}
          <TextField
            label="인원"
            keyboardType="number-pad"
            value={adults}
            onChangeText={setAdults}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button label="등록하기" onPress={submit} loading={submitting} style={styles.submitButton} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  title: { marginBottom: spacing.lg },
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
