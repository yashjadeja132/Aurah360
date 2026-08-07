/**
 * Smoke test for Task #49 — proves the WhatsApp webhook endpoint fails CLOSED
 * (403) when WHATSAPP_APP_SECRET is not configured, instead of silently
 * skipping HMAC verification, mirroring the SMS/Voice shared-secret checks
 * fixed in a prior task. Also proves the existing HMAC verification still
 * works correctly (valid signature accepted, invalid/missing signature
 * rejected) once a secret IS configured.
 *
 * Requires a reachable MongoDB (MONGODB_URI from .env) to create a
 * throwaway Notification doc that recordDeliveryEvent can attach delivery
 * events to.
 *
 * Run: node src/scripts/smoke-whatsapp-webhook-failclosed.js
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import dotenv from 'dotenv';
dotenv.config();

// Ensure the secret is NOT set for the first phase of the test, regardless of
// what .env may define, so we can prove the fail-closed behavior.
delete process.env.WHATSAPP_APP_SECRET;

const config = (await import('../config/index.js')).default;
const App = (await import('../app.js')).default;
const NotificationModel = (await import('../models/Notification.model.js')).default;

let failures = 0;

function check(label, cond) {
  if (cond) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

async function main() {
  await mongoose.connect(config.database?.uri || process.env.MONGODB_URI);

  const app = new App().getExpressApp();

  const notification = await NotificationModel.create({
    notificationId: `SMOKE-WA-${Date.now()}`,
    eventName: 'SMOKE_TEST',
    channel: 'WHATSAPP',
    status: 'SENT',
    providerMessageId: `smoke-wa-${Date.now()}`,
    recipient: '+911234567890',
    message: 'smoke test',
  });

  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                {
                  id: notification.providerMessageId,
                  status: 'delivered',
                  timestamp: `${Math.floor(Date.now() / 1000)}`,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  // --- (a) No app secret configured -> rejected (403), not silently accepted ---
  check(
    'config has no WhatsApp app secret configured for phase (a)',
    !config.notificationProviders?.whatsapp?.appSecret
  );

  const noSecretRes = await request(app)
    .post('/api/v1/webhooks/whatsapp')
    .set('x-hub-signature-256', 'sha256=irrelevant')
    .send(payload);
  check(
    'WhatsApp webhook with no app secret configured is rejected (403)',
    noSecretRes.status === 403
  );

  const docAfterNoSecret = await NotificationModel.findById(notification._id);
  check(
    'No delivery event recorded when secret is unconfigured',
    (docAfterNoSecret.deliveryEvents || []).length === 0
  );

  // --- Now configure a secret in-process for phases (b) and (c) ---
  const testSecret = 'whatsapp-test-secret-789';
  config.notificationProviders.whatsapp.appSecret = testSecret;

  const rawBody = JSON.stringify(payload);
  const validSignature =
    'sha256=' + crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');

  // --- (c) Secret configured, invalid signature -> rejected (401) ---
  const invalidSigRes = await request(app)
    .post('/api/v1/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', 'sha256=deadbeef')
    .send(rawBody);
  check(
    'WhatsApp webhook with secret configured + invalid signature is rejected (401)',
    invalidSigRes.status === 401
  );

  // --- (c) Secret configured, missing signature -> rejected (401) ---
  const missingSigRes = await request(app)
    .post('/api/v1/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .send(rawBody);
  check(
    'WhatsApp webhook with secret configured + missing signature is rejected (401)',
    missingSigRes.status === 401
  );

  // --- (b) Secret configured, valid signature -> accepted (200) + recorded ---
  const validSigRes = await request(app)
    .post('/api/v1/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', validSignature)
    .send(rawBody);
  check(
    'WhatsApp webhook with secret configured + valid signature is accepted (200)',
    validSigRes.status === 200
  );

  const docAfterValid = await NotificationModel.findById(notification._id);
  check(
    'WhatsApp delivery event was recorded after valid signature',
    (docAfterValid.deliveryEvents || []).some((e) => e.type === 'DELIVERED')
  );

  await NotificationModel.deleteMany({ _id: notification._id });
  await mongoose.disconnect();

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll checks PASSED');
}

main().catch((err) => {
  console.error('Smoke script error:', err);
  process.exit(1);
});
