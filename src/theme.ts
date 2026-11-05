/** Single source of truth for colours, spacing and type so screens stay consistent. */
export const colors = {
  background: '#F5F7FB',
  card: '#FFFFFF',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primarySoft: '#EEF2FF',
  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  success: '#059669',
  successSoft: '#ECFDF5',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  button: {
    shadowColor: '#4F46E5',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
} as const;
