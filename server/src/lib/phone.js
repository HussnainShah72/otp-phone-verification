'use strict';

/**
 * E.164 is the format every SMS provider expects: a leading "+", a country
 * code that cannot start with 0, and 15 digits at most in total.
 */
const E164 = /^\+[1-9]\d{6,14}$/;

/** Strip spaces, dashes and brackets that users naturally type. */
function normalizePhone(input) {
  if (typeof input !== 'string') return '';
  const compact = input.trim().replace(/[\s()\-.]/g, '');
  // Accept "00923001234567" as an alias for "+923001234567".
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  return compact;
}

function isValidPhone(phone) {
  return E164.test(phone);
}

/** "+923001234567" -> "+923*****4567": keep the country code and last 4. */
function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length <= 8) return phone || '';
  const head = phone.slice(0, 4);
  const tail = phone.slice(-4);
  return head + '*'.repeat(phone.length - 8) + tail;
}

module.exports = { E164, normalizePhone, isValidPhone, maskPhone };
