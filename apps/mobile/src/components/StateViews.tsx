import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';
import { Button } from './Button';

export function LoadingState({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accentBlue} />
      <Text style={[typography.bodySecondary, styles.spacingTop]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={[typography.body, styles.errorText]}>{message}</Text>
      {onRetry && <Button label="다시 시도" variant="secondary" onPress={onRetry} style={styles.spacingTop} />}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.center}>
      <Text style={typography.subtitle}>{title}</Text>
      {description && <Text style={[typography.bodySecondary, styles.spacingTop, styles.description]}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  spacingTop: {
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
});
