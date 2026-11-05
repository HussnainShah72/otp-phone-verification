import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Banner from '../components/Banner';
import OtpInput from '../components/OtpInput';
import PrimaryButton from '../components/PrimaryButton';
import { OtpError, otpProvider, type SendResult } from '../otp';
import { OTP_LENGTH } from '../config';
import { colors, radius, shadow, spacing } from '../theme';

type Props = {
  phone: string;
  sendResult: SendResult;
  onVerified: (phone: string, message: string) => void;
  onFailed: (phone: string, message: string) => void;
  onChangeNumber: () => void;
};

/** Step 2 of the flow: enter the code that arrived by SMS and verify it. */
export default function OtpScreen({
  phone,
  sendResult,
  onVerified,
  onFailed,
  onChangeNumber,
}: Props) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | undefined>(sendResult.demoCode);
  // Firebase hands back a ConfirmationResult that `verify` needs; a resend replaces it.
  const [session, setSession] = useState(sendResult.session);
  const [secondsLeft, setSecondsLeft] = useState(sendResult.resendAfterSeconds ?? 30);
  // Guards against the auto-submit and the button both firing a request.
  const inFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleVerify = useCallback(
    async (submitted?: string) => {
      const candidate = (submitted ?? code).replace(/\D/g, '');
      if (candidate.length !== OTP_LENGTH || inFlight.current) return;

      inFlight.current = true;
      setError(null);
      setVerifying(true);
      try {
        const result = await otpProvider.verify(session, phone, candidate);

        if (result.verified) {
          onVerified(phone, result.message);
          return;
        }

        // The code is gone for good: send the user to the failure screen.
        if (result.status === 'expired' || result.status === 'max_attempts_reached') {
          onFailed(phone, result.message);
          return;
        }

        // Still retryable (wrong digits): keep them here with a message.
        setError(result.message);
        setCode('');
      } catch (err) {
        setError(
          err instanceof OtpError ? err.message : 'Could not verify the code. Please try again.'
        );
      } finally {
        inFlight.current = false;
        setVerifying(false);
      }
    },
    [code, onFailed, onVerified, phone, session]
  );

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      const result = await otpProvider.send(phone);
      setSession(result.session);
      setDemoCode(result.demoCode);
      setCode('');
      setSecondsLeft(result.resendAfterSeconds ?? 30);
    } catch (err) {
      if (err instanceof OtpError) {
        setError(err.message);
        if (err.retryAfterSeconds) setSecondsLeft(err.retryAfterSeconds);
      } else {
        setError('Could not resend the code. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Text style={styles.logoIcon}>✉</Text>
        </View>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit code by SMS to
        </Text>
        <View style={styles.phoneRow}>
          <Text style={styles.phone}>{phone}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change phone number"
            onPress={onChangeNumber}
            hitSlop={8}
          >
            <Text style={styles.changeLink}>Change</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, shadow.card]}>
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          length={OTP_LENGTH}
          editable={!verifying}
          hasError={Boolean(error)}
          onComplete={(completed) => handleVerify(completed)}
        />

        {demoCode ? (
          <View style={styles.bannerSlot}>
            <Banner
              tone="info"
              title={`Demo mode — your code is ${demoCode}`}
              message="No real SMS was sent because no Twilio credentials are configured. Add them to server/.env to receive an actual text message."
            />
          </View>
        ) : null}

        {error ? (
          <View style={styles.bannerSlot}>
            <Banner tone="error" message={error} />
          </View>
        ) : null}

        <View style={styles.buttonSlot}>
          <PrimaryButton
            label="Verify code"
            onPress={() => handleVerify()}
            loading={verifying}
            disabled={code.length !== OTP_LENGTH}
          />
        </View>

        <View style={styles.resendRow}>
          {secondsLeft > 0 ? (
            <Text style={styles.resendIdle}>
              Did not get it? You can resend in{' '}
              <Text style={styles.resendCount}>{secondsLeft}s</Text>
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={handleResend}
              disabled={resending}
              hitSlop={8}
            >
              <Text style={styles.resendLink}>
                {resending ? 'Sending a new code...' : 'Resend code'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
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
  subtitle: { marginTop: spacing.sm, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  phone: { fontSize: 16.5, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  changeLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerSlot: { marginTop: spacing.lg },
  buttonSlot: { marginTop: spacing.xl },
  resendRow: { alignItems: 'center', marginTop: spacing.lg },
  resendIdle: { fontSize: 13.5, color: colors.textMuted },
  resendCount: { fontWeight: '800', color: colors.text },
  resendLink: { fontSize: 14.5, fontWeight: '800', color: colors.primary },
});
