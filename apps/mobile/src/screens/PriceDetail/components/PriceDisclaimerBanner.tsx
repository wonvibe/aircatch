import { StyleSheet, Text, View } from 'react-native';
import { TripType } from '../../../api/types';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

interface Props {
  tripType?: TripType;
}

/** PRD 8절 제약사항: "실제 결제 가격과 알림 가격 간의 차이 발생 가능성(안내 문구 필수)". */
export function PriceDisclaimerBanner({ tripType }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        표시된 가격은 예매 시점의 실제 결제 금액과 다를 수 있어요. 예매 전 예매처에서 최종 가격을 꼭 확인하세요.
      </Text>
      {(tripType === 'round_trip' || tripType === 'multi_city') && (
        <Text style={[styles.text, styles.extra]}>
          {tripType === 'round_trip'
            ? '왕복 가격은 가는 편·오는 편 각각의 최저가를 더한 값이에요. 실제 왕복 항공권은 이보다 저렴한 경우가 많아요.'
            : '다구간 가격은 각 구간 최저가의 합이며, 등록하신 날짜의 ±3일 범위에서 찾은 가격일 수 있어요. 실제 예매가와 차이가 클 수 있습니다.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  text: {
    ...typography.caption,
  },
  extra: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
  },
});
