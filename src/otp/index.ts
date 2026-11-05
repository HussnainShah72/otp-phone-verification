import { backendProvider } from './backendProvider';
import {
  firebaseProvider,
  isFirebaseConfigured,
  isFirebaseSupportedHere,
} from './firebaseProvider';
import type { OtpProvider } from './types';

export * from './types';
export {
  RECAPTCHA_CONTAINER_ID,
  registerNativeRecaptcha,
  firebaseWebConfig,
} from './firebaseProvider';
export { RecaptchaModal, type RecaptchaModalHandle } from './RecaptchaModal';
export { isFirebaseConfigured, isFirebaseSupportedHere };

/**
 * Firebase wins whenever it is configured and can actually run here, since it
 * is the provider the project is built around. Otherwise the app falls back to
 * the Express backend (Twilio Verify, or the demo provider).
 *
 * The fallback keeps the app usable when no Firebase project is configured.
 */
export function selectProvider(): OtpProvider {
  if (isFirebaseConfigured() && isFirebaseSupportedHere()) {
    return firebaseProvider;
  }
  return backendProvider;
}

/** Why Firebase is not being used, or null when it is. */
export function firebaseFallbackReason(): string | null {
  if (isFirebaseConfigured() && isFirebaseSupportedHere()) return null;
  return 'Firebase is not configured, so the app is using the verification server. Add the EXPO_PUBLIC_FIREBASE_* values to .env to switch.';
}

export const otpProvider = selectProvider();
