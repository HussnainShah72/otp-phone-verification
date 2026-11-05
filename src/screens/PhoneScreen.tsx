import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Banner from '../components/Banner';
import PrimaryButton from '../components/PrimaryButton';
import {
  OtpError,
  RECAPTCHA_CONTAINER_ID,
  RecaptchaModal,
  firebaseWebConfig,
  isFirebaseConfigured,
  otpProvider,
  registerNativeRecaptcha,
  type ProviderInfo,
  type RecaptchaModalHandle,
  type SendResult,
} from '../otp';
import { COUNTRIES, type Country } from '../config';
import { colors, radius, shadow, spacing } from '../theme';

type Props = {
  onCodeSent: (phone: string, result: SendResult) => void;
  providerInfo: ProviderInfo | null;
  fallbackReason: string | null;
};

/** Step 1 of the flow: collect the phone number and request an SMS code. */
export default function PhoneScreen({ onCodeSent, providerInfo, fallbackReason }: Props) {
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [localNumber, setLocalNumber] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // Native reCAPTCHA host. On web the SDK renders into the div below instead.
  const recaptchaRef = useRef<RecaptchaModalHandle>(null);
  const useNativeRecaptcha = Platform.OS !== 'web' && isFirebaseConfigured();

  useEffect(() => {
    if (!useNativeRecaptcha) return;
    registerNativeRecaptcha(recaptchaRef.current);
    return () => registerNativeRecaptcha(null);
  }, [useNativeRecaptcha]);

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
      const result = await otpProvider.send(fullPhone);
      onCodeSent(result.phone ?? fullPhone, result);
    } catch (err) {
      setError(
        err instanceof OtpError ? err.message : 'Could not send the code. Please try again.'
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

      <ProviderStatus info={providerInfo} fallbackReason={fallbackReason} />

      {/* Web: Firebase attaches its invisible reCAPTCHA widget to this node. */}
      {Platform.OS === 'web' ? (
        <View nativeID={RECAPTCHA_CONTAINER_ID} style={styles.recaptcha} />
      ) : null}

      {/* Native: the challenge runs inside a WebView in this modal. */}
      {useNativeRecaptcha ? (
        <RecaptchaModal ref={recaptchaRef} config={firebaseWebConfig} />
      ) : null}

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

/** Footer line showing which OTP provider is live, and why if it is not Firebase. */
function ProviderStatus({
  info,
  fallbackReason,
}: {
  info: ProviderInfo | null;
  fallbackReason: string | null;
}) {
  if (info === null) {
    return (
      <View style={styles.statusBlock}>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: colors.textFaint }]} />
          <Text style={styles.statusText}>Connecting to verification provider...</Text>
        </View>
      </View>
    );
  }

  if (!info.available) {
    return (
      <View style={styles.statusCard}>
        <Banner
          tone="warning"
          title={`${info.label} unavailable`}
          message={info.detail ?? 'The verification provider could not be reached.'}
        />
      </View>
    );
  }

  return (
    <View style={styles.statusBlock}>
      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: colors.success }]} />
        <Text style={styles.statusText}>Connected · {info.label}</Text>
      </View>
      {fallbackReason ? <Text style={styles.statusNote}>{fallbackReason}</Text> : null}
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
  },
  statusCard: { marginTop: spacing.xl },
  statusBlock: { marginTop: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  statusText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  statusNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textFaint,
    textAlign: 'center',
  },
  // Invisible reCAPTCHA host: Firebase renders its widget into this node.
  recaptcha: { height: 0, overflow: 'hidden' },
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
