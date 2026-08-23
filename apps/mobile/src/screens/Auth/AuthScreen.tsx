import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { colors, spacing, typography } from '../../theme/tokens';

export function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signUpDone, setSignUpDone] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const submit = async () => {
    setFormError(null);
    if (!email.trim() || !password) {
      setFormError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setSignUpDone(true);
      }
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>에어캐치</Text>
          <Text style={typography.bodySecondary}>항공권 특가를 놓치지 않게 알려드려요</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="이메일"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            label="비밀번호"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {formError && <Text style={styles.errorText}>{formError}</Text>}
          {signUpDone && (
            <Text style={styles.infoText}>가입 확인 이메일을 보냈어요. 확인 후 로그인해주세요.</Text>
          )}

          <Button
            label={mode === 'signIn' ? '로그인' : '회원가입'}
            onPress={submit}
            loading={submitting}
            style={styles.submitButton}
          />

          <Button
            label={mode === 'signIn' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            variant="ghost"
            onPress={() => {
              setFormError(null);
              setSignUpDone(false);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  form: {
    gap: 0,
  },
  submitButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.bodySecondary,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  infoText: {
    ...typography.bodySecondary,
    color: colors.accentMint,
    marginBottom: spacing.md,
  },
});
