'use strict';

/**
 * Twilio Verify provider.
 *
 * Twilio owns the code: it generates it, sends the SMS, enforces expiry and
 * attempt limits, and checks it. We never see or store the code, which is
 * exactly why this runs on the server and not inside the app.
 *
 * Docs: https://www.twilio.com/docs/verify/api
 */

const twilio = require('twilio');

const CODE_LENGTH = 6;

/** Twilio error code -> message that is safe and useful to show a user. */
const ERROR_MESSAGES = {
  20404: 'That code has expired or no code was requested. Please request a new one.',
  60200: 'That phone number is not valid. Include the country code, e.g. +923001234567.',
  60202: 'Too many incorrect attempts. Please request a new code.',
  60203: 'Too many codes requested for this number. Please try again later.',
  60205: 'SMS cannot be delivered to this number (it may be a landline).',
  60212: 'Too many requests for this number. Please wait a moment and try again.',
  60238: 'Verification is not enabled for this region on the Twilio account.',
  21211: 'That phone number is not valid. Include the country code, e.g. +923001234567.',
  21608: 'On a Twilio trial account, the number must first be verified in the Twilio console.',
  21614: 'That number cannot receive SMS messages.',
};

function create({ accountSid, authToken, verifyServiceSid }) {
  const client = twilio(accountSid, authToken);
  const service = () => client.verify.v2.services(verifyServiceSid);

  async function sendOtp(phone) {
    try {
      const verification = await service().verifications.create({ to: phone, channel: 'sms' });
      return {
        status: verification.status, // "pending"
        channel: verification.channel, // "sms"
        expiresInSeconds: 600, // Twilio Verify codes live for 10 minutes
        sid: verification.sid,
      };
    } catch (err) {
      throw toProviderError(err);
    }
  }

  async function verifyOtp(phone, code) {
    try {
      const check = await service().verificationChecks.create({ to: phone, code });
      const approved = check.status === 'approved';
      return {
        approved,
        status: check.status, // "approved" | "pending" | "canceled"
        message: approved
          ? 'Phone number verified successfully.'
          : 'Incorrect code. Please check the SMS and try again.',
      };
    } catch (err) {
      const providerError = toProviderError(err);
      // A wrong/expired code is a normal outcome, not a server failure: Twilio
      // returns 404 once the verification is gone, and 60202 after too many
      // wrong guesses. Report those as a failed verification.
      if (providerError.httpStatus === 404 || providerError.twilioCode === 60202) {
        return {
          approved: false,
          status: providerError.twilioCode === 60202 ? 'max_attempts_reached' : 'expired',
          message: providerError.message,
        };
      }
      throw providerError;
    }
  }

  return { name: 'twilio', sendOtp, verifyOtp, CODE_LENGTH };
}

function toProviderError(err) {
  const twilioCode = err && err.code;
  const httpStatus = (err && err.status) || 502;
  const error = new Error(
    ERROR_MESSAGES[twilioCode] || 'The SMS provider rejected the request. Please try again.'
  );
  error.twilioCode = twilioCode;
  error.httpStatus = httpStatus;
  error.providerMessage = err && err.message;
  return error;
}

module.exports = { create, CODE_LENGTH };
