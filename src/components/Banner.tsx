import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  tone: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
};

const TONES = {
  error: { bg: colors.dangerSoft, border: '#FECACA', fg: colors.danger, icon: '✕' },
  success: { bg: colors.successSoft, border: '#A7F3D0', fg: colors.success, icon: '✓' },
  info: { bg: colors.primarySoft, border: '#C7D2FE', fg: colors.primaryDark, icon: 'i' },
  warning: { bg: colors.warningSoft, border: '#FDE68A', fg: colors.warning, icon: '!' },
} as const;

/** Inline status strip used for the success / failure messages and hints. */
export default function Banner({ tone, title, message }: Props) {
  const t = TONES[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <View style={[styles.badge, { backgroundColor: t.fg }]}>
        <Text style={styles.badgeText}>{t.icon}</Text>
      </View>
      <View style={styles.textWrap}>
        {title ? <Text style={[styles.title, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: t.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  badgeText: { color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  textWrap: { flex: 1 },
  title: { fontSize: 14.5, fontWeight: '700', marginBottom: 2 },
  message: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
