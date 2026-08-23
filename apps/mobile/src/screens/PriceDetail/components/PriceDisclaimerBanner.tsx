import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../../theme/tokens';

/** PRD 8절 제약사항: "실제 결제 가격과 알림 가격 간의 차이 발생 가능성(안내 문구 필수)". */
export function PriceDisclaimerBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        표시된 가격은 예매 시점의 실제 결제 금액과 다를 수 있어요. 예매 전 예매처에서 최종 가격을 꼭 확인하세요.
      </Text>
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
});
