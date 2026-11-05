import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Banner from '../components/Banner';
import PrimaryButton from '../components/PrimaryButton';
import { OtpApiError, sendOtp, type SendOtpResult } from '../api/otp';
import { API_BASE_URL, COUNTRIES, type Country } from '../config';
import { colors, radius, shadow, spacing } from '../theme';

type Props = {
  onCodeSent: (phone: string, result: SendOtpResult) => void;
  serverProvider: string | null;
  serverDemoMode: boolean;
  serverReachable: boolean | null;
};

/** Step 1 of the flow: collect the phone number and request an SMS code. */
export default function PhoneScreen({
  onCodeSent,
  serverProvider,
  serverDemoMode,
  serverReachable,
}: Props) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // Users often type the trunk "0" (0300...); the country code replaces it.
  const digits = useMemo(
    () => localNumber.replace(/\D/g, '').replace(/^0+/, ''),
    [localNumber]
  );
  const fullPhone = `${country.code}${digits}`;
  const canSubmit = digits.length >= 7 && digits.length <= 13 && !loading;

  const handleSend = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const result = await sendOtp(fullPhone);
      onCodeSent(result.phone ?? fullPhone, result);
    } catch (err) {
      setError(
        err instanceof OtpApiError ? err.message : 'Could not send the code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>✆</Text>
        </View>
        <Text style={styles.title}>Verify your phone</Text>
        <Text style={styles.subtitle}>
          We will text you a 6-digit code to confirm this number belongs to you.
        </Text>
      </View>

      <View style={[styles.card, shadow.card]}>
        <Text style={styles.label}>Phone number</Text>

        <View style={styles.inputRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Country code ${country.code}, ${country.name}. Tap to change.`}
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.countryButton, pressed && styles.countryPressed]}
          >
            <Text style={styles.flag}>{country.flag}</Text>
            <Text style={styles.countryCode}>{country.code}</Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>

          <TextInput
            value={localNumber}
            onChangeText={(text) => {
              setLocalNumber(text.replace(/[^\d\s-]/g, ''));
              setError(null);
            }}
            placeholder="300 1234567"
            placeholderTextColor={colors.textFaint}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={16}
            editable={!loading}
            accessibilityLabel="Phone number without country code"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            style={[styles.phoneInput, inputFocused && styles.phoneInputFocused]}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>

        <Text style={styles.helper}>
          {digits.length > 0
            ? `Code will be sent to ${fullPhone}`
            : `Enter your number without the leading zero, e.g. ${country.code} 300 1234567`}
        </Text>

        {error ? (
          <View style={styles.bannerSlot}>
            <Banner tone="error" title="Could not send code" message={error} />
          </View>
        ) : null}

        <View style={styles.buttonSlot}>
          <PrimaryButton
            label="Send verification code"
            onPress={handleSend}
            loading={loading}
            disabled={!canSubmit}
          />
        </View>
      </View>

      <ServerStatus
        reachable={serverReachable}
        provider={serverProvider}
        demoMode={serverDemoMode}
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close country picker"
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select country code</Text>
            <FlatList
              data={COUNTRIES as readonly Country[] as Country[]}
              keyExtractor={(item) => `${item.code}-${item.name}`}
              style={styles.modalList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const selected = item.code === country.code && item.name === country.name;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setCountry(item);
                      setPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.countryRow,
                      pressed && styles.countryRowPressed,
                    ]}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowCode}>{item.code}</Text>
                    <Text style={styles.rowCheck}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Small footer line so it is obvious whether the backend is up, and which provider is live. */
function ServerStatus({
  reachable,
  provider,
  demoMode,
}: {
  reachable: boolean | null;
  provider: string | null;
  demoMode: boolean;
}) {
  if (reachable === null) {
    return (
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: colors.textFaint }]} />
        <Text style={styles.statusText}>Connecting to verification server...</Text>
      </View>
    );
  }

  if (!reachable) {
    return (
      <View style={styles.statusCard}>
        <Banner
          tone="warning"
          title="Verification server offline"
          message={`No response from ${API_BASE_URL}. Start it with "npm run server", then reload the app.`}
        />
      </View>
    );
  }

  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: colors.success }]} />
      <Text style={styles.statusText}>
        Connected · {demoMode ? 'Demo provider' : `${provider} Verify`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoIcon: { fontSize: 30, color: colors.primary },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 330,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.md,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 54,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FBFCFE',
  },
  countryPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  flag: { fontSize: 18 },
  countryCode: { fontSize: 16, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 11, color: colors.textMuted },
  phoneInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FBFCFE',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    // The browser's default focus ring is replaced by phoneInputFocused below,
    // so keyboard users still get a clear indicator.
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  phoneInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  helper: { marginTop: spacing.md, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  bannerSlot: { marginTop: spacing.lg },
  buttonSlot: { marginTop: spacing.xl },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statusCard: { marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  statusText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  modalList: { flexGrow: 0 },
  countryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: spacing.md },
  countryRowPressed: { backgroundColor: colors.primarySoft },
  rowFlag: { fontSize: 20 },
  rowName: { flex: 1, fontSize: 15.5, fontWeight: '600', color: colors.text },
  rowCode: { fontSize: 15, color: colors.textMuted, fontWeight: '600' },
  rowCheck: { fontSize: 15, color: colors.primary, fontWeight: '800', width: 16 },
  separator: { height: 1, backgroundColor: colors.border },
});
