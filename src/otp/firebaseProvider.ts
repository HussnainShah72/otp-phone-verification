import { Platform } from 'react-native';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

import { OtpError, type OtpProvider, type ProviderInfo, type SendResult, type VerifyResult } from './types';

/** The container the invisible reCAPTCHA widget attaches to (rendered by PhoneScreen). */
export const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** Only apiKey, authDomain, projectId and appId are needed for phone auth. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

/**
 * Phone auth needs a reCAPTCHA challenge, and the JS SDK's verifier is a DOM
 * widget. That exists on web; in Expo Go there is no DOM, so the SDK cannot
 * run this flow and the app falls back to the backend provider.
 */
export function isFirebaseSupportedHere(): boolean {
  return Platform.OS === 'web';
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;

function getFirebaseAuth(): Auth {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
    // Send the SMS in the device's language where Firebase supports it.
    auth.useDeviceLanguage();
  }
  return auth;
}

/**
 * One verifier instance is reused across sends. Firebase consumes the token on
 * each call, so it is reset rather than rebuilt — rebuilding leaves orphaned
 * widgets in the container and the second send silently fails.
 */
async function getVerifier(): Promise<RecaptchaVerifier> {
  const authInstance = getFirebaseAuth();

  if (typeof document !== 'undefined' && !document.getElementById(RECAPTCHA_CONTAINER_ID)) {
    throw new OtpError(
      'The reCAPTCHA container is missing from the page. Reload the app and try again.',
      'recaptcha_container_missing'
    );
  }

  if (!verifier) {
    verifier = new RecaptchaVerifier(authInstance, RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
    });
    await verifier.render();
  }
  return verifier;
}

/** Firebase auth error codes -> messages that are safe and useful to show a user. */
const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number':
    'That phone number is not valid. Include the country code, e.g. +923001234567.',
  'auth/missing-phone-number': 'Please enter your phone number.',
  'auth/quota-exceeded': 'The daily SMS quota for this project has been used up. Try again later.',
  'auth/too-many-requests':
    'Too many requests from this device. Please wait a few minutes and try again.',
  'auth/captcha-check-failed':
    'The reCAPTCHA check failed. Make sure this domain is listed under Authentication > Settings > Authorized domains.',
  'auth/invalid-app-credential':
    'The reCAPTCHA token was rejected. Reload the page and try again.',
  'auth/operation-not-allowed':
    'Phone sign-in is not enabled for this Firebase project. Enable it under Authentication > Sign-in method > Phone.',
  'auth/billing-not-enabled':
    'Firebase requires the Blaze (pay-as-you-go) plan to send real SMS. Either upgrade the project, or add this number under Authentication > Sign-in method > Phone numbers for testing.',
  'auth/unauthorized-domain':
    'This domain is not authorised for Firebase sign-in. Add it under Authentication > Settings > Authorized domains.',
  'auth/invalid-verification-code': 'Incorrect code. Please check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Please request a new one.',
  'auth/missing-verification-code': 'Please enter all 6 digits of the code.',
  'auth/network-request-failed': 'Network error reaching Firebase. Check your connection.',
};

function toOtpError(err: unknown): OtpError {
  const code = (err as { code?: string })?.code ?? '';
  const fallback = (err as { message?: string })?.message ?? 'Firebase rejected the request.';
  return new OtpError(ERROR_MESSAGES[code] ?? fallback, code || 'firebase_error');
}

export const firebaseProvider: OtpProvider = {
  name: 'firebase',

  async describe(): Promise<ProviderInfo> {
    const base = { name: 'firebase', label: 'Firebase Phone Auth', demoMode: false };

    if (!isFirebaseConfigured()) {
      return {
        ...base,
        available: false,
        detail:
          'Firebase is not configured. Copy .env.example to .env and fill in the EXPO_PUBLIC_FIREBASE_* values from your Firebase web app config.',
      };
    }
    if (!isFirebaseSupportedHere()) {
      return {
        ...base,
        available: false,
        detail:
          'Firebase phone auth needs a browser for its reCAPTCHA check, so it cannot run in Expo Go. Open the app with "w" (web) to use Firebase.',
      };
    }
    return { ...base, available: true, detail: `Project ${firebaseConfig.projectId}` };
  },

  async send(phone: string): Promise<SendResult> {
    try {
      const authInstance = getFirebaseAuth();
      const appVerifier = await getVerifier();
      const confirmation = await signInWithPhoneNumber(authInstance, phone, appVerifier);
      return { phone, session: confirmation, resendAfterSeconds: 30 };
    } catch (err) {
      // A consumed or failed challenge must be cleared or every later send fails.
      try {
        verifier?.clear();
      } catch {
        /* the widget may already be gone */
      }
      verifier = null;
      throw toOtpError(err);
    }
  },

  async verify(session, _phone, code): Promise<VerifyResult> {
    const confirmation = session as ConfirmationResult | null;
    if (!confirmation) {
      return {
        verified: false,
        status: 'expired',
        message: 'That verification has expired. Please request a new code.',
      };
    }

    try {
      await confirmation.confirm(code);
      return {
        verified: true,
        status: 'approved',
        message: 'Phone number verified successfully.',
      };
    } catch (err) {
      const code_ = (err as { code?: string })?.code ?? '';

      // A wrong code is an expected outcome, not a failure of the request.
      if (code_ === 'auth/invalid-verification-code') {
        return {
          verified: false,
          status: 'pending',
          message: ERROR_MESSAGES[code_],
        };
      }
      if (code_ === 'auth/code-expired') {
        return { verified: false, status: 'expired', message: ERROR_MESSAGES[code_] };
      }
      if (code_ === 'auth/too-many-requests') {
        return {
          verified: false,
          status: 'max_attempts_reached',
          message: ERROR_MESSAGES[code_],
        };
      }
      throw toOtpError(err);
    }
  },
};
