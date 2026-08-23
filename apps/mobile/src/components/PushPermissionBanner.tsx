import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { usePushRegistration } from '../hooks/usePushRegistration';
import { colors, radius, spacing, typography } from '../theme/tokens';

/** PRD: 푸시 권한 안내 문구 — explains why before the OS permission dialog
 * appears, and offers a way to fix it afterward if the user denied it
 * (Android/iOS won't re-show the system dialog once denied). */
export function PushPermissionBanner() {
  const { status, requestAndRegister, openSettings } = usePushRegistration();

  if (status === 'granted' || status === 'unsupported') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>특가 알림을 놓치지 마세요</Text>
      <Text style={styles.body}>
        등록한 여정의 가격이 떨어지면 바로 알려드려요. 알림을 받으려면 푸시 권한을 허용해주세요.
      </Text>
      <Button
        label={status === 'denied' ? '설정에서 알림 허용하기' : '알림 허용하기'}
        variant="secondary"
        onPress={status === 'denied' ? openSettings : requestAndRegister}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.bodySecondary,
    marginBottom: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
  },
});
