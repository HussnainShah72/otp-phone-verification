'use strict';

const os = require('os');
const path = require('path');

// Resolve .env relative to this file, not the working directory, so
// `npm run server` from the project root still finds server/.env.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');

const { resolveProvider } = require('./providers');
const { normalizePhone, isValidPhone, maskPhone } = require('./lib/phone');
const rateLimit = require('./lib/rateLimit');

const PORT = Number(process.env.PORT || 4000);

let provider;
let isDemo;
let providerReason;
try {
  ({ provider, isDemo, reason: providerReason } = resolveProvider());
} catch (err) {
  console.error(`\nConfiguration error: ${err.message}\n`);
  process.exit(1);
}

const app = express();
app.use(cors()); // the Expo app is served from a different origin/host
app.use(express.json());

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()}  ${req.method} ${req.path}`);
  }
  next();
});

/** Lets the app show which provider is live, and confirms reachability. */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: provider.name,
    demoMode: isDemo,
    codeLength: provider.CODE_LENGTH,
  });
});

/** Step 1: user entered a phone number and asked for a code. */
app.post('/api/otp/send', async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);

  if (!phone) {
    return res.status(400).json(fail('phone_required', 'Please enter your phone number.'));
  }
  if (!isValidPhone(phone)) {
    return res
      .status(400)
      .json(
        fail(
          'invalid_phone',
          'Enter the number in international format, including the country code (e.g. +923001234567).'
        )
      );
  }

  const gate = rateLimit.checkSendAllowed(phone);
  if (!gate.allowed) {
    return res
      .status(429)
      .json({ ...fail(gate.code, gate.message), retryAfterSeconds: gate.retryAfterSeconds });
  }

  try {
    const result = await provider.sendOtp(phone);
    rateLimit.recordSend(phone);
    console.log(`  -> code sent to ${maskPhone(phone)} via ${provider.name}`);

    return res.json({
      success: true,
      phone,
      provider: provider.name,
      demoMode: isDemo,
      channel: result.channel,
      status: result.status,
      codeLength: provider.CODE_LENGTH,
      expiresInSeconds: result.expiresInSeconds,
      resendAfterSeconds: rateLimit.RESEND_COOLDOWN_MS / 1000,
      // Present only in demo mode so the flow can be completed without an SMS.
      ...(result.demoCode ? { demoCode: result.demoCode } : {}),
    });
  } catch (err) {
    console.error(`  -> send failed: ${err.providerMessage || err.message}`);
    return res
      .status(err.httpStatus && err.httpStatus < 500 ? 400 : 502)
      .json(fail('send_failed', err.message, err.twilioCode));
  }
});

/** Step 2: user typed the code they received. */
app.post('/api/otp/verify', async (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const code = String((req.body && req.body.code) || '').replace(/\D/g, '');

  if (!isValidPhone(phone)) {
    return res.status(400).json(fail('invalid_phone', 'That phone number is not valid.'));
  }
  if (code.length !== provider.CODE_LENGTH) {
    return res
      .status(400)
      .json(fail('invalid_code', `Please enter all ${provider.CODE_LENGTH} digits of the code.`));
  }

  try {
    const result = await provider.verifyOtp(phone, code);
    console.log(`  -> verify ${maskPhone(phone)}: ${result.status}`);

    // A wrong code is a valid, expected answer, so this stays HTTP 200 with
    // success:false rather than an error status.
    return res.json({
      success: result.approved,
      verified: result.approved,
      status: result.status,
      message: result.message,
      phone,
      provider: provider.name,
      demoMode: isDemo,
    });
  } catch (err) {
    console.error(`  -> verify failed: ${err.providerMessage || err.message}`);
    return res
      .status(err.httpStatus && err.httpStatus < 500 ? 400 : 502)
      .json(fail('verify_failed', err.message, err.twilioCode));
  }
});

app.use((_req, res) => res.status(404).json(fail('not_found', 'No such endpoint.')));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json(fail('server_error', 'Something went wrong on the server.'));
});

function fail(code, message, providerCode) {
  return {
    success: false,
    error: { code, message, ...(providerCode ? { providerCode } : {}) },
    message,
  };
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

app.listen(PORT, '0.0.0.0', () => {
  const addresses = lanAddresses();
  console.log('');
  console.log('  OTP verification server running');
  console.log(`  Provider : ${provider.name}${isDemo ? '  (DEMO MODE)' : ''}  — ${providerReason}`);
  console.log(`  Local    : http://localhost:${PORT}`);
  for (const address of addresses) {
    console.log(`  Network  : http://${address}:${PORT}   <- use this from a physical phone`);
  }
  if (isDemo) {
    console.log('');
    console.log('  Demo mode: no real SMS is sent. The 6-digit code is printed here');
    console.log('  and shown in the app. Add Twilio credentials to server/.env to');
    console.log('  send real SMS messages.');
  }
  console.log('');
});
