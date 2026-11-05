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
import { OtpApiError, checkHealth, sendOtp, type SendOtpResult } from './src/api/otp';
import { colors, radius, spacing } from './src/theme';

type Step = 'phone' | 'otp' | 'result';

type Outcome = { kind: 'success' | 'failure'; message: string };

const STEP_LABELS = ['Number', 'Code', 'Done'] as const;

export default function App() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sendResult, setSendResult] = useState<SendOtpResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [serverProvider, setServerProvider] = useState<string | null>(null);
  const [serverDemoMode, setServerDemoMode] = useState(false);

  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Ping the backend once on launch so the first screen can report its state
  // instead of failing only when the user taps Send.
  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then((health) => {
        if (cancelled) return;
        setServerReachable(health.ok);
        setServerProvider(health.provider);
        setServerDemoMode(health.demoMode);
      })
      .catch(() => {
        if (!cancelled) setServerReachable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCodeSent = useCallback((nextPhone: string, result: SendOtpResult) => {
    setPhone(nextPhone);
    setSendResult(result);
    setServerProvider(result.provider);
    setServerDemoMode(result.demoMode);
    setServerReachable(true);
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
      const result = await sendOtp(phone);
      setSendResult(result);
      setOutcome(null);
      setStep('otp');
    } catch (err) {
      setRetryError(
        err instanceof OtpApiError ? err.message : 'Could not send a new code. Please try again.'
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
                serverProvider={serverProvider}
                serverDemoMode={serverDemoMode}
                serverReachable={serverReachable}
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
                provider={serverProvider ?? 'demo'}
                onRetry={handleRetry}
                onStartOver={handleStartOver}
                retryLoading={retryLoading}
                retryError={retryError}
              />
            )}

            <Text style={styles.footer}>
              OTP phone verification · {serverDemoMode ? 'Demo provider' : 'Twilio Verify'}
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
                <Text
                  style={[
                    styles.stepperNumber,
                    (active || done) && styles.stepperNumberOn,
                  ]}
                >
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
