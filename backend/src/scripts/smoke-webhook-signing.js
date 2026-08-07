/**
 * Smoke test for Task #39 — proves SMS and Voice webhook endpoints reject
 * unauthenticated callbacks and accept ones carrying the correct shared-secret
 * token, mirroring the WhatsApp HMAC-signature check.
 *
 * Requires SMS_WEBHOOK_SECRET / VOICE_WEBHOOK_SECRET to be set (this script sets
 * them itself before importing config, so it's self-contained) and a reachable
 * MongoDB (MONGODB_URI from .env) to create a throwaway Notification doc that
 * recordDeliveryEvent can attach delivery events to.
 *
 * Run: node src/scripts/smoke-webhook-signing.js
 */
process.env.SMS_WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET || 'sms-test-secret-123';
process.env.VOICE_WEBHOOK_SECRET = process.env.VOICE_WEBHOOK_SECRET || 'voice-test-secret-456';

import mongoose from 'mongoose';
import request from 'supertest';
import dotenv from 'dotenv';
dotenv.config();
// Re-apply after dotenv in case .env doesn't define these (keeps our test secrets authoritative).
process.env.SMS_WEBHOOK_SECRET = 'sms-test-secret-123';
process.env.VOICE_WEBHOOK_SECRET = 'voice-test-secret-456';

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

  const smsNotification = await NotificationModel.create({
    notificationId: `SMOKE-SMS-${Date.now()}`,
    eventName: 'SMOKE_TEST',
    channel: 'SMS',
    status: 'SENT',
    providerMessageId: `smoke-sms-${Date.now()}`,
    recipient: '+911234567890',
    message: 'smoke test',
  });

  const voiceNotification = await NotificationModel.create({
    notificationId: `SMOKE-VOICE-${Date.now()}`,
    eventName: 'SMOKE_TEST',
    channel: 'VOICE',
    status: 'SENT',
    providerMessageId: `smoke-voice-${Date.now()}`,
    recipient: '+911234567890',
    message: 'smoke test',
  });

  // --- SMS: no/wrong token -> rejected ---
  const smsNoToken = await request(app)
    .post('/api/v1/webhooks/sms')
    .send({ messageId: smsNotification.providerMessageId, status: 'delivered' });
  check('SMS webhook without token is rejected (401/403)', [401, 403].includes(smsNoToken.status));

  const smsWrongToken = await request(app)
    .post('/api/v1/webhooks/sms?token=wrong')
    .send({ messageId: smsNotification.providerMessageId, status: 'delivered' });
  check('SMS webhook with wrong token is rejected (401)', smsWrongToken.status === 401);

  // --- SMS: correct token -> accepted + recorded ---
  const smsOk = await request(app)
    .post(`/api/v1/webhooks/sms?token=${process.env.SMS_WEBHOOK_SECRET}`)
    .send({ messageId: smsNotification.providerMessageId, status: 'delivered' });
  check('SMS webhook with correct token is accepted (200)', smsOk.status === 200);

  const smsDoc = await NotificationModel.findById(smsNotification._id);
  check(
    'SMS delivery event was recorded',
    (smsDoc.deliveryEvents || []).some((e) => e.type === 'DELIVERED')
  );

  // --- Voice: no/wrong token -> rejected ---
  const voiceNoToken = await request(app)
    .post('/api/v1/webhooks/voice')
    .send({ CallSid: voiceNotification.providerMessageId, Status: 'completed' });
  check('Voice webhook without token is rejected (401/403)', [401, 403].includes(voiceNoToken.status));

  const voiceWrongToken = await request(app)
    .post('/api/v1/webhooks/voice?token=wrong')
    .send({ CallSid: voiceNotification.providerMessageId, Status: 'completed' });
  check('Voice webhook with wrong token is rejected (401)', voiceWrongToken.status === 401);

  // --- Voice: correct token -> accepted + recorded ---
  const voiceOk = await request(app)
    .post(`/api/v1/webhooks/voice?token=${process.env.VOICE_WEBHOOK_SECRET}`)
    .send({ CallSid: voiceNotification.providerMessageId, Status: 'completed' });
  check('Voice webhook with correct token is accepted (200)', voiceOk.status === 200);

  const voiceDoc = await NotificationModel.findById(voiceNotification._id);
  check(
    'Voice delivery event was recorded',
    (voiceDoc.deliveryEvents || []).some((e) => e.type === 'CALL_ANSWERED')
  );

  await NotificationModel.deleteMany({
    _id: { $in: [smsNotification._id, voiceNotification._id] },
  });
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
