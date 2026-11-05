'use strict';

/**
 * Small in-memory guard so one phone number cannot be used to spam SMS.
 * In-memory is deliberate for a single-instance demo server; a deployed
 * service would keep these counters in Redis.
 */

const RESEND_COOLDOWN_MS = 30 * 1000;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SENDS_PER_WINDOW = 5;

/** phone -> { lastSentAt, timestamps: number[] } */
const sends = new Map();

function purge(now) {
  for (const [phone, entry] of sends.entries()) {
    const fresh = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) sends.delete(phone);
    else entry.timestamps = fresh;
  }
}

/**
 * @returns {{ allowed: true } | { allowed: false, code: string, message: string, retryAfterSeconds: number }}
 */
function checkSendAllowed(phone) {
  const now = Date.now();
  purge(now);
  const entry = sends.get(phone);
  if (!entry) return { allowed: true };

  const sinceLast = now - entry.lastSentAt;
  if (sinceLast < RESEND_COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000);
    return {
      allowed: false,
      code: 'resend_cooldown',
      message: `Please wait ${retryAfterSeconds}s before requesting another code.`,
      retryAfterSeconds,
    };
  }

  if (entry.timestamps.length >= MAX_SENDS_PER_WINDOW) {
    const oldest = Math.min(...entry.timestamps);
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    return {
      allowed: false,
      code: 'too_many_requests',
      message: 'Too many codes requested for this number. Please try again later.',
      retryAfterSeconds,
    };
  }

  return { allowed: true };
}

function recordSend(phone) {
  const now = Date.now();
  const entry = sends.get(phone) || { lastSentAt: 0, timestamps: [] };
  entry.lastSentAt = now;
  entry.timestamps.push(now);
  sends.set(phone, entry);
}

module.exports = {
  checkSendAllowed,
  recordSend,
  RESEND_COOLDOWN_MS,
  MAX_SENDS_PER_WINDOW,
};
