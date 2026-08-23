import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/Card';
import { NotificationLogEntry } from '../../../api/types';
import { colors, spacing, typography } from '../../../theme/tokens';
import { formatPrice } from '../../../utils/format';

export function NotificationItem({ item }: { item: NotificationLogEntry }) {
  const sentAt = new Date(item.sentAt);
  const timeLabel = `${sentAt.getMonth() + 1}/${sentAt.getDate()} ${String(sentAt.getHours()).padStart(2, '0')}:${String(
    sentAt.getMinutes(),
  ).padStart(2, '0')}`;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.time}>{timeLabel}</Text>
        {item.status === 'failed' && <Text style={styles.failedBadge}>발송 실패</Text>}
      </View>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.dropAmount}>-{formatPrice(item.dropAmount)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  time: {
    ...typography.caption,
  },
  failedBadge: {
    ...typography.caption,
    color: colors.danger,
  },
  message: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  dropAmount: {
    ...typography.priceMedium,
    color: colors.accentMint,
  },
});
