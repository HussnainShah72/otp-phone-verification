import { API_BASE_URL } from '../config';
import { OtpError, type OtpProvider, type ProviderInfo, type SendResult, type VerifyResult } from './types';

const REQUEST_TIMEOUT_MS = 15000;

type SendResponse = {
  phone: string;
  provider: string;
  demoMode: boolean;
  resendAfterSeconds: number;
  demoCode?: string;
};

type VerifyResponse = {
  verified: boolean;
  status: string;
  message: string;
};

type HealthResponse = {
  ok: boolean;
  provider: string;
  demoMode: boolean;
};

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
    throw new OtpError(
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
    throw new OtpError(
      payload?.error?.message || payload?.message || `Request failed (${response.status}).`,
      payload?.error?.code || 'request_failed',
      payload?.retryAfterSeconds
    );
  }

  return payload as T;
}

/**
 * Talks to the Express server in ./server, which fronts Twilio Verify (or the
 * demo provider when no Twilio credentials are configured). The server holds
 * the credentials so they never reach the app bundle.
 */
export const backendProvider: OtpProvider = {
  name: 'backend',

  async describe(): Promise<ProviderInfo> {
    try {
      const health = await request<HealthResponse>('/api/health');
      return {
        name: health.provider,
        label: health.demoMode ? 'Demo provider' : 'Twilio Verify',
        demoMode: health.demoMode,
        available: health.ok,
      };
    } catch (err) {
      return {
        name: 'backend',
        label: 'Verification server',
        demoMode: false,
        available: false,
        detail:
          err instanceof OtpError
            ? err.message
            : `No response from ${API_BASE_URL}. Start it with "npm run server".`,
      };
    }
  },

  async send(phone: string): Promise<SendResult> {
    const result = await request<SendResponse>('/api/otp/send', { phone });
    return {
      phone: result.phone ?? phone,
      session: null, // the server tracks the verification itself
      resendAfterSeconds: result.resendAfterSeconds ?? 30,
      demoCode: result.demoCode,
    };
  },

  async verify(_session, phone, code): Promise<VerifyResult> {
    const result = await request<VerifyResponse>('/api/otp/verify', { phone, code });
    return {
      verified: result.verified,
      status: (result.status as VerifyResult['status']) ?? 'failed',
      message: result.message,
    };
  },
};
