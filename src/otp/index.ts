import { backendProvider } from './backendProvider';
import {
  firebaseProvider,
  isFirebaseConfigured,
  isFirebaseSupportedHere,
} from './firebaseProvider';
import type { OtpProvider } from './types';

export * from './types';
export { RECAPTCHA_CONTAINER_ID } from './firebaseProvider';
export { isFirebaseConfigured, isFirebaseSupportedHere };

/**
 * Firebase wins whenever it is configured and can actually run here, since it
 * is the provider the project is built around. Otherwise the app falls back to
 * the Express backend (Twilio Verify, or the demo provider).
 *
 * The fallback is what keeps the app usable in Expo Go, where Firebase phone
 * auth cannot run: its reCAPTCHA step needs a browser DOM.
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
  if (!isFirebaseConfigured()) {
    return 'Firebase is not configured, so the app is using the verification server. Add the EXPO_PUBLIC_FIREBASE_* values to .env to switch.';
  }
  return 'Firebase phone auth needs a browser for its reCAPTCHA check, so Expo Go falls back to the verification server. Open the app with "w" for the Firebase flow.';
}

export const otpProvider = selectProvider();
