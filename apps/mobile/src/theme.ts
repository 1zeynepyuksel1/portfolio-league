export const colors = {
  surface: '#051424',
  surfaceRaised: '#0d1c2d',
  surfacePressed: '#162840',
  surfaceSunken: '#162840',
  border: 'rgba(255, 255, 255, 0.05)',
  ink: '#FFFFFF',
  inkBright: '#FFFFFF',
  inkMuted: '#94a3b8',
  inkFaint: '#475569',
  inkDisabled: '#475569',
  gain: '#10b981',
  loss: '#ef4444',
  warn: '#f59e0b',
  gold: '#f59e0b',
  silver: '#cbd5e1',
  bronze: '#8b5cf6',
  accent: '#3b82f6',
  error: '#ef4444',
  inverse: '#FFFFFF',
  onInverse: '#000000',
  onInverseMuted: '#475569',
  
  gainSoft: 'rgba(16, 185, 129, 0.15)',
  lossSoft: 'rgba(239, 68, 68, 0.15)',
  warnSoft: 'rgba(245, 158, 11, 0.15)',
  goldSoft: 'rgba(245, 158, 11, 0.15)',
  silverSoft: 'rgba(203, 213, 225, 0.15)',
  bronzeSoft: 'rgba(139, 92, 246, 0.15)',

  axisLine: 'rgba(255,255,255,0.05)',
  axisText: '#475569',
  axisGrid: 'rgba(255,255,255,0.02)',
  readoutFill: '#0d1c2d',

  inkDim: '#94a3b8',
  inkGhost: '#475569',
  inkPlaceholder: '#475569',
  fieldFill: '#0d1c2d',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  hairline: 'rgba(255,255,255,0.05)',
  hairlineStrong: 'rgba(255,255,255,0.1)',
  hairlineFocus: '#3b82f6',
  gridLine: 'rgba(255,255,255,0.02)',
  volumeBar: 'rgba(255,255,255,0.05)',
  chartLabel: '#475569',
  accentSoft: 'rgba(59, 130, 246, 0.15)',
  borderStrong: 'rgba(255, 255, 255, 0.1)',
} as const;

export const fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  mono: 'SpaceGrotesk_400Regular',
  monoMedium: 'SpaceGrotesk_500Medium',
  monoSemibold: 'SpaceGrotesk_600SemiBold',
  monoBold: 'SpaceGrotesk_700Bold',
} as const;

export const spacing = {
  gutter: 26,
  bottom: 24,
  screen: 22,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  field: 12,
  pill: 29,
  pillSmall: 28,
} as const;

export const sizes = {
  control: 58,
  oauth: 56,
} as const;

export const sectionLabel = {
  fontFamily: fonts.bold,
  fontSize: 9,
  letterSpacing: 1.5,
  color: colors.inkFaint,
} as const;

export const rowMetrics = {
  paddingVertical: 13,
  logoSize: 32,
  changeWidth: 62,
  valueWidth: 104,
  sparkWidth: 46,
  sparkHeight: 22,
} as const;
