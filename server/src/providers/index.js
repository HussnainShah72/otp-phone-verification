'use strict';

const demoProvider = require('./demo');
const twilioProvider = require('./twilio');

/**
 * Pick the OTP provider from the environment.
 *
 * Twilio is used whenever its three credentials are present. Otherwise the app
 * falls back to the demo provider so the project runs out of the box.
 * OTP_PROVIDER=demo forces the fallback even when credentials exist.
 */
function resolveProvider(env = process.env) {
  const accountSid = (env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (env.TWILIO_AUTH_TOKEN || '').trim();
  const verifyServiceSid = (env.TWILIO_VERIFY_SERVICE_SID || '').trim();
  const forced = (env.OTP_PROVIDER || '').trim().toLowerCase();

  const hasTwilioCredentials = Boolean(accountSid && authToken && verifyServiceSid);

  if (forced === 'demo') {
    return { provider: demoProvider, isDemo: true, reason: 'OTP_PROVIDER=demo' };
  }

  if (forced === 'twilio' && !hasTwilioCredentials) {
    throw new Error(
      'OTP_PROVIDER=twilio but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and ' +
        'TWILIO_VERIFY_SERVICE_SID are not all set. Copy server/.env.example to server/.env.'
    );
  }

  if (hasTwilioCredentials) {
    if (!accountSid.startsWith('AC')) {
      throw new Error('TWILIO_ACCOUNT_SID looks wrong: it should start with "AC".');
    }
    if (!verifyServiceSid.startsWith('VA')) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID looks wrong: it should start with "VA".');
    }
    return {
      provider: twilioProvider.create({ accountSid, authToken, verifyServiceSid }),
      isDemo: false,
      reason: 'Twilio credentials found',
    };
  }

  return { provider: demoProvider, isDemo: true, reason: 'no Twilio credentials found' };
}

module.exports = { resolveProvider };
