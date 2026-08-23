import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { colors, spacing, typography } from '../../theme/tokens';

// Draft policy — placeholders (회사명/연락처) must be filled in with the
// real operating entity before this ships to an app store. Written to
// cover what PRD 8절 flags as a store-review requirement: background price
// monitoring must be disclosed, since it runs without the user opening the
// app (see README's "스토어 백그라운드 데이터 수집 심사" note).
const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. 수집하는 개인정보 항목',
    body:
      '이메일 주소(계정 식별), 등록한 여정 정보(출발지·도착지·날짜·목표가), 기기 푸시 토큰(알림 발송용), 기기 정보(OS 종류)를 수집합니다. 결제 정보는 수집하지 않습니다 — 예매는 항상 외부 예매처에서 이루어집니다.',
  },
  {
    title: '2. 수집 목적',
    body:
      '등록하신 여정의 항공권 가격을 주기적으로 조회하여 목표가 이하로 하락했을 때 푸시 알림을 보내드리기 위해 사용합니다. 이 가격 조회는 앱을 직접 실행하지 않은 상태에서도 서버가 자동으로 수행합니다(백그라운드 모니터링).',
  },
  {
    title: '3. 제3자 제공 및 위탁',
    body:
      '가격 조회를 위해 Amadeus(항공 데이터 API)에 출발지·도착지·날짜만 전달하며, 이용자를 식별할 수 있는 정보는 전달하지 않습니다. 인증·데이터 저장은 Supabase, 푸시 알림 발송은 Expo(Google FCM/Apple APNs 경유)를 통해 처리됩니다.',
  },
  {
    title: '4. 보관 기간',
    body: '회원 탈퇴 시 계정 및 관련 데이터(여정, 가격 이력, 알림 내역)를 지체 없이 삭제합니다.',
  },
  {
    title: '5. 이용자의 권리',
    body: '언제든지 앱 내 설정에서 로그아웃할 수 있으며, 계정 삭제 및 데이터 삭제를 요청할 수 있습니다.',
  },
  {
    title: '6. 가격 정보의 한계',
    body:
      '알림에 표시되는 가격은 조회 시점의 참고 가격이며 실제 예매 시 결제 금액과 다를 수 있습니다. 예매 전 예매처에서 최종 가격을 확인해주세요.',
  },
  {
    title: '7. 문의처',
    body: 'privacy@aircatch.example (실제 서비스 운영 시 연락처로 교체 필요)',
  },
];

export function PrivacyPolicyScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={typography.title}>개인정보처리방침</Text>
        <Text style={styles.updatedAt}>최종 수정일: 2026.08.23 (초안)</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  updatedAt: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  sectionBody: {
    ...typography.bodySecondary,
    lineHeight: 20,
  },
});
