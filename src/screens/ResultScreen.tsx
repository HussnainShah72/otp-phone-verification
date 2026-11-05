import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Banner from '../components/Banner';
import PrimaryButton from '../components/PrimaryButton';
import { colors, radius, shadow, spacing } from '../theme';

type Props = {
  outcome: 'success' | 'failure';
  phone: string;
  message: string;
  providerLabel: string;
  onRetry: () => void;
  onStartOver: () => void;
  retryLoading?: boolean;
  retryError?: string | null;
};

/** Step 3 of the flow: the explicit success or failure message. */
export default function ResultScreen({
  outcome,
  phone,
  message,
  providerLabel,
  onRetry,
  onStartOver,
  retryLoading = false,
  retryError = null,
}: Props) {
  const success = outcome === 'success';

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadow.card]}>
        <View
          style={[styles.icon, { backgroundColor: success ? colors.successSoft : colors.dangerSoft }]}
        >
          <Text style={[styles.iconGlyph, { color: success ? colors.success : colors.danger }]}>
            {success ? '✓' : '✕'}
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.title, { color: success ? colors.success : colors.danger }]}
        >
          {success ? 'Verification successful' : 'Verification failed'}
        </Text>

        <Text style={styles.message} accessibilityLiveRegion="polite">
          {message}
        </Text>

        <View style={styles.detailBox}>
          <Detail label="Phone number" value={phone} />
          <View style={styles.detailDivider} />
          <Detail label="Status" value={success ? 'Verified' : 'Not verified'} />
          <View style={styles.detailDivider} />
          <Detail label="Provider" value={providerLabel} />
        </View>

        {retryError ? (
          <View style={styles.retryErrorSlot}>
            <Banner tone="error" message={retryError} />
          </View>
        ) : null}

        <View style={styles.actions}>
          {success ? (
            <PrimaryButton label="Verify another number" onPress={onStartOver} />
          ) : (
            <>
              <PrimaryButton
                label="Send a new code"
                onPress={onRetry}
                loading={retryLoading}
              />
              <View style={styles.actionGap} />
              <PrimaryButton
                label="Use a different number"
                onPress={onStartOver}
                variant="secondary"
                disabled={retryLoading}
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  icon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconGlyph: { fontSize: 38, fontWeight: '800', lineHeight: 44 },
  title: { fontSize: 23, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  message: {
    marginTop: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  detailBox: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#FBFCFE',
    paddingHorizontal: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    gap: spacing.lg,
  },
  detailDivider: { height: 1, backgroundColor: colors.border },
  detailLabel: { fontSize: 13.5, color: colors.textMuted, fontWeight: '600' },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  retryErrorSlot: { alignSelf: 'stretch', marginTop: spacing.lg },
  actions: { alignSelf: 'stretch', marginTop: spacing.xl },
  actionGap: { height: spacing.md },
});
