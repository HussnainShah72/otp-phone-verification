'use strict';

/**
 * Demo provider.
 *
 * Lets the whole send -> receive -> verify flow be exercised without a paid
 * SMS account: the code is printed to the server console and returned in the
 * HTTP response so the app can surface it on screen. It mirrors the real
 * provider's expiry and attempt limits so the client code path is identical.
 *
 * Never enabled when Twilio credentials are present (see providers/index.js).
 */

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes, same as Twilio Verify's default
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;

/** phone -> { code, expiresAt, attempts } */
const store = new Map();

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

function purgeExpired() {
  const now = Date.now();
  for (const [phone, entry] of store.entries()) {
    if (entry.expiresAt <= now) store.delete(phone);
  }
}

async function sendOtp(phone) {
  purgeExpired();
  const code = generateCode();
  store.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });

  console.log('');
  console.log('  ┌──────────────────────────────────────────┐');
  console.log('  │  DEMO SMS (no real message was sent)     │');
  console.log('  ├──────────────────────────────────────────┤');
  console.log(`  │  To:   ${phone.padEnd(34)}│`);
  console.log(`  │  Code: ${code.padEnd(34)}│`);
  console.log('  └──────────────────────────────────────────┘');
  console.log('');

  return {
    status: 'pending',
    channel: 'sms',
    expiresInSeconds: CODE_TTL_MS / 1000,
    // Only the demo provider ever exposes this. Twilio never does.
    demoCode: code,
  };
}

async function verifyOtp(phone, code) {
  purgeExpired();
  const entry = store.get(phone);

  if (!entry) {
    return {
      approved: false,
      status: 'expired',
      message: 'That code has expired or no code was requested. Please request a new one.',
    };
  }

  entry.attempts += 1;

  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(phone);
    return {
      approved: false,
      status: 'max_attempts_reached',
      message: 'Too many incorrect attempts. Please request a new code.',
    };
  }

  if (entry.code !== code) {
    const remaining = MAX_ATTEMPTS - entry.attempts;
    return {
      approved: false,
      status: 'pending',
      message:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect code. Please request a new one.',
    };
  }

  // Single-use: a correct code cannot be replayed.
  store.delete(phone);
  return { approved: true, status: 'approved', message: 'Phone number verified successfully.' };
}

module.exports = { name: 'demo', sendOtp, verifyOtp, CODE_LENGTH };
