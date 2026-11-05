/**
 * One interface, two very different OTP providers.
 *
 * Twilio Verify runs behind our Express server, because its credentials must
 * never ship in the app bundle. Firebase Phone Auth is the opposite: it is a
 * client-side SDK, its config is public by design, and the Admin SDK cannot
 * send OTPs at all — so it talks to Firebase straight from the app.
 *
 * The screens should not care which one is live, so both implement this.
 */

/** Opaque per-attempt state. Firebase returns a ConfirmationResult; the backend needs nothing. */
export type OtpSession = unknown;

export type SendResult = {
  /** Normalised E.164 number the code was actually sent to. */
  phone: string;
  /** Passed back to `verify` for this attempt. */
  session: OtpSession;
  /** Seconds before a resend is allowed. */
  resendAfterSeconds: number;
  /** Demo provider only — shown in-app so the flow works without real SMS. */
  demoCode?: string;
};

export type VerifyStatus =
  | 'approved'
  | 'pending'
  | 'expired'
  | 'max_attempts_reached'
  | 'failed';

export type VerifyResult = {
  verified: boolean;
  /** `pending` means the user can try again; `expired`/`max_attempts_reached` are terminal. */
  status: VerifyStatus;
  message: string;
};

export type ProviderInfo = {
  /** Machine name: 'firebase' | 'twilio' | 'demo'. */
  name: string;
  /** Shown in the UI, e.g. "Firebase Phone Auth". */
  label: string;
  /** True when no real SMS is sent (demo provider, or a Firebase test number). */
  demoMode: boolean;
  /** False when the provider cannot run — the UI explains why using `detail`. */
  available: boolean;
  detail?: string;
};

export interface OtpProvider {
  readonly name: string;
  /** Probe reachability/config. Called once on launch for the status line. */
  describe(): Promise<ProviderInfo>;
  send(phone: string): Promise<SendResult>;
  verify(session: OtpSession, phone: string, code: string): Promise<VerifyResult>;
}

/** Raised for anything the user should see a message about. */
export class OtpError extends Error {
  code: string;
  retryAfterSeconds?: number;

  constructor(message: string, code = 'request_failed', retryAfterSeconds?: number) {
    super(message);
    this.name = 'OtpError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
