import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Port the backend in ./server listens on. */
const SERVER_PORT = 4000;

/**
 * Work out which host the phone should talk to.
 *
 * Expo Go on a physical device cannot reach "localhost" — that would be the
 * phone itself. Expo already knows the development machine's LAN address
 * (it is serving the bundle from there), so reuse that host and swap the port.
 */
function devMachineHost(): string | null {
  const expoGoHost = (Constants as any)?.expoGoConfig?.debuggerHost as string | undefined;
  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const raw = hostUri ?? expoGoHost ?? null;
  if (!raw) return null;
  const host = raw.split('/')[0]?.split(':')[0];
  return host && host.length > 0 ? host : null;
}

function resolveApiBaseUrl(): string {
  // An explicit value always wins: set EXPO_PUBLIC_API_URL in .env to point the
  // app at a deployed server (e.g. an ngrok or Render URL).
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, '');
  }

  const host = devMachineHost();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${SERVER_PORT}`;
  }

  // Android emulators reach the host machine through this alias, never localhost.
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${SERVER_PORT}`;
  }

  return `http://localhost:${SERVER_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Digits in the OTP. Kept in sync with the server's provider. */
export const OTP_LENGTH = 6;

/** Country codes offered in the picker, so users do not have to type "+". */
export const COUNTRIES = [
  { code: '+92', name: 'Pakistan', flag: '🇵🇰', digits: 10 },
  { code: '+91', name: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+1', name: 'United States', flag: '🇺🇸', digits: 10 },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧', digits: 10 },
  { code: '+971', name: 'UAE', flag: '🇦🇪', digits: 9 },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+61', name: 'Australia', flag: '🇦🇺', digits: 9 },
  { code: '+49', name: 'Germany', flag: '🇩🇪', digits: 11 },
  { code: '+86', name: 'China', flag: '🇨🇳', digits: 11 },
  { code: '+90', name: 'Türkiye', flag: '🇹🇷', digits: 10 },
] as const;

export type Country = (typeof COUNTRIES)[number];
