import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { PriceHistoryEntry } from '../../../api/types';
import { colors, spacing, typography } from '../../../theme/tokens';

interface Props {
  history: PriceHistoryEntry[];
}

const screenWidth = Dimensions.get('window').width;
const MAX_POINTS = 12;

export function PriceTrendChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={typography.bodySecondary}>가격 데이터가 더 쌓이면 추이를 볼 수 있어요.</Text>
      </View>
    );
  }

  // Downsample so the x-axis stays readable regardless of how many checks
  // have accumulated (checks happen roughly hourly).
  const step = Math.max(1, Math.floor(history.length / MAX_POINTS));
  const sampled = history.filter((_, index) => index % step === 0);

  const data = {
    labels: sampled.map((entry) => formatShortDate(entry.checkedAt)),
    datasets: [{ data: sampled.map((entry) => entry.price) }],
  };

  return (
    <LineChart
      data={data}
      width={screenWidth - spacing.md * 2}
      height={200}
      withInnerLines={false}
      withOuterLines={false}
      withShadow={false}
      formatYLabel={(y) => `${Math.round(Number(y) / 1000)}k`}
      chartConfig={{
        backgroundGradientFrom: colors.white,
        backgroundGradientTo: colors.white,
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(47, 111, 237, ${opacity})`,
        labelColor: () => colors.textTertiary,
        propsForDots: { r: '3', strokeWidth: '2', stroke: colors.accentBlue },
      }}
      bezier
      style={styles.chart}
    />
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  chart: {
    borderRadius: 12,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
