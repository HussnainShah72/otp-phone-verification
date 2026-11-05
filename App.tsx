import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import OtpScreen from './src/screens/OtpScreen';
import PhoneScreen from './src/screens/PhoneScreen';
import ResultScreen from './src/screens/ResultScreen';
import {
  OtpError,
  firebaseFallbackReason,
  otpProvider,
  type ProviderInfo,
  type SendResult,
} from './src/otp';
import { colors, radius, spacing } from './src/theme';

type Step = 'phone' | 'otp' | 'result';

type Outcome = { kind: 'success' | 'failure'; message: string };

const STEP_LABELS = ['Number', 'Code', 'Done'] as const;

export default function App() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);

  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Probe the provider once on launch so the first screen can report its state
  // instead of failing only when the user taps Send.
  useEffect(() => {
    let cancelled = false;
    otpProvider
      .describe()
      .then((info) => {
        if (!cancelled) setProviderInfo(info);
      })
      .catch(() => {
        if (!cancelled) {
          setProviderInfo({
            name: otpProvider.name,
            label: 'Verification provider',
            demoMode: false,
            available: false,
            detail: 'Could not reach the verification provider.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCodeSent = useCallback((nextPhone: string, result: SendResult) => {
    setPhone(nextPhone);
    setSendResult(result);
    setStep('otp');
  }, []);

  const handleVerified = useCallback((verifiedPhone: string, message: string) => {
    setPhone(verifiedPhone);
    setOutcome({ kind: 'success', message });
    setStep('result');
  }, []);

  const handleFailed = useCallback((failedPhone: string, message: string) => {
    setPhone(failedPhone);
    setOutcome({ kind: 'failure', message });
    setStep('result');
  }, []);

  const handleStartOver = useCallback(() => {
    setStep('phone');
    setSendResult(null);
    setOutcome(null);
    setRetryError(null);
    setPhone('');
  }, []);

  /** After a failure, request a fresh code for the same number. */
  const handleRetry = useCallback(async () => {
    setRetryError(null);
    setRetryLoading(true);
    try {
      const result = await otpProvider.send(phone);
      setSendResult(result);
      setOutcome(null);
      setStep('otp');
    } catch (err) {
      setRetryError(
        err instanceof OtpError ? err.message : 'Could not send a new code. Please try again.'
      );
    } finally {
      setRetryLoading(false);
    }
  }, [phone]);

  const stepIndex = step === 'phone' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <Stepper activeIndex={stepIndex} />

            {step === 'phone' && (
              <PhoneScreen
                onCodeSent={handleCodeSent}
                providerInfo={providerInfo}
                fallbackReason={firebaseFallbackReason()}
              />
            )}

            {step === 'otp' && sendResult && (
              <OtpScreen
                phone={phone}
                sendResult={sendResult}
                onVerified={handleVerified}
                onFailed={handleFailed}
                onChangeNumber={handleStartOver}
              />
            )}

            {step === 'result' && outcome && (
              <ResultScreen
                outcome={outcome.kind}
                phone={phone}
                message={outcome.message}
                providerLabel={providerInfo?.label ?? 'Verification provider'}
                onRetry={handleRetry}
                onStartOver={handleStartOver}
                retryLoading={retryLoading}
                retryError={retryError}
              />
            )}

            <Text style={styles.footer}>
              OTP phone verification · {providerInfo?.label ?? 'connecting…'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Three-dot progress indicator across the top of every step. */
function Stepper({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.stepper} accessibilityRole="progressbar">
      {STEP_LABELS.map((label, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <React.Fragment key={label}>
            {index > 0 ? (
              <View style={[styles.stepperLine, done && styles.stepperLineDone]} />
            ) : null}
            <View style={styles.stepperItem}>
              <View
                style={[
                  styles.stepperDot,
                  active && styles.stepperDotActive,
                  done && styles.stepperDotDone,
                ]}
              >
                <Text style={[styles.stepperNumber, (active || done) && styles.stepperNumberOn]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <Text style={[styles.stepperLabel, active && styles.stepperLabelActive]}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  stepperItem: { alignItems: 'center', width: 64 },
  stepperDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepperDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepperNumber: { fontSize: 13, fontWeight: '800', color: colors.textFaint },
  stepperNumberOn: { color: colors.white },
  stepperLabel: { marginTop: 6, fontSize: 11.5, fontWeight: '700', color: colors.textFaint },
  stepperLabelActive: { color: colors.text },
  stepperLine: {
    height: 2,
    width: 28,
    backgroundColor: colors.border,
    marginBottom: 20,
    borderRadius: radius.pill,
  },
  stepperLineDone: { backgroundColor: colors.success },
  footer: {
    marginTop: spacing.xxl,
    textAlign: 'center',
    fontSize: 11.5,
    color: colors.textFaint,
    fontWeight: '600',
  },
});
