import { API_BASE_URL } from '../config';

const REQUEST_TIMEOUT_MS = 15000;

export type SendOtpResult = {
  success: true;
  phone: string;
  provider: string;
  demoMode: boolean;
  channel: string;
  status: string;
  codeLength: number;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Returned by the demo provider only, so the flow works without real SMS. */
  demoCode?: string;
};

export type VerifyOtpResult = {
  success: boolean;
  verified: boolean;
  status: 'approved' | 'pending' | 'expired' | 'max_attempts_reached' | string;
  message: string;
  phone: string;
  provider: string;
  demoMode: boolean;
};

export type HealthResult = {
  ok: boolean;
  provider: string;
  demoMode: boolean;
  codeLength: number;
};

/** Thrown for anything the user should see a message about. */
export class OtpApiError extends Error {
  code: string;
  retryAfterSeconds?: number;

  constructor(message: string, code = 'request_failed', retryAfterSeconds?: number) {
    super(message);
    this.name = 'OtpApiError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new OtpApiError(
      aborted
        ? 'The server took too long to respond. Please try again.'
        : `Cannot reach the verification server at ${API_BASE_URL}. Make sure it is running (npm run server) and that the phone is on the same Wi-Fi network.`,
      aborted ? 'timeout' : 'network_error'
    );
  } finally {
    clearTimeout(timer);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new OtpApiError(
      payload?.error?.message || payload?.message || `Request failed (${response.status}).`,
      payload?.error?.code || 'request_failed',
      payload?.retryAfterSeconds
    );
  }

  return payload as T;
}

/** Step 1 — ask the provider to text a code to this number. */
export function sendOtp(phone: string) {
  return request<SendOtpResult>('/api/otp/send', { phone });
}

/** Step 2 — check the code the user typed. */
export function verifyOtp(phone: string, code: string) {
  return request<VerifyOtpResult>('/api/otp/verify', { phone, code });
}

/** Used on the first screen to show whether the backend is reachable. */
export function checkHealth() {
  return request<HealthResult>('/api/health');
}
