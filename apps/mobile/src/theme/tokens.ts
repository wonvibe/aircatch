// Notion-style minimal palette: white surface + dark-gray text, with vivid
// blue / mint green reserved for price-drop / alert moments only (PRD 디자인
// 가이드 7절 참고).
export const colors = {
  background: '#FFFFFF',
  surface: '#F7F7F5',
  surfaceRaised: '#FFFFFF',
  border: '#E7E5E1',
  textPrimary: '#1F1F1E',
  textSecondary: '#6B6A66',
  textTertiary: '#9B9A96',
  accentBlue: '#2F6FED',
  accentBlueSoft: '#EAF1FE',
  accentMint: '#0FA968',
  accentMintSoft: '#E4F7EE',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

// 가격/하락폭 숫자는 가장 두꺼운 웨이트로 시각적 우위 확보 (PRD 7절).
export const typography = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.textPrimary },
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  bodySecondary: { fontSize: 14, fontWeight: '400' as const, color: colors.textSecondary },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.textTertiary },
  priceHeavy: { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary },
  priceMedium: { fontSize: 16, fontWeight: '700' as const, color: colors.textPrimary },
} as const;
