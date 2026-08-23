import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { spacing, typography } from '../../theme/tokens';
import type { MainTabScreenProps } from '../../navigation/types';

export function SettingsScreen({ navigation }: MainTabScreenProps<'Settings'>) {
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.title}>설정</Text>
      </View>

      <Card style={styles.card}>
        <Text style={typography.bodySecondary}>로그인 계정</Text>
        <Text style={typography.body}>{email ?? '-'}</Text>
      </Card>

      <Card onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.card}>
        <Text style={typography.body}>개인정보처리방침</Text>
      </Card>

      <Button label="로그아웃" variant="ghost" onPress={signOut} style={styles.signOutButton} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.md,
  },
  card: {
    marginBottom: spacing.sm,
  },
  signOutButton: {
    marginTop: spacing.lg,
  },
});
