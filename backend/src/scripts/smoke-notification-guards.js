/**
 * Ad-hoc smoke test for the notification-subsystem safety guards (not part of Vitest):
 *  - Task #28: HttpDltSmsProvider refuses to send without a registered DLT templateId.
 *  - Task #29: NotificationTemplate save/update rejects PHI/clinical-keyword content,
 *    while a clean template still saves fine.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import { HttpDltSmsProvider } from '../notifications/providers.js';
import { templateSchema, updateTemplateSchema } from '../validators/notification.validator.js';
import NotificationTemplate from '../models/NotificationTemplate.model.js';

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_notif_guards'));
  await mongoose.connection.dropDatabase();

  // --- Task #28: HttpDltSmsProvider DLT template lock ---------------------------------
  const smsProvider = new HttpDltSmsProvider({
    apiUrl: 'https://example-sms-gateway.invalid/send',
    apiKey: 'test-key',
    dltPrincipalEntityId: 'PE123',
    dltSenderHeader: 'AURAH3',
  });

  try {
    await smsProvider.send({ to: '9812345678', body: 'Arbitrary free text message', meta: {} });
    throw new Error('HttpDltSmsProvider should have rejected a send without meta.templateId!');
  } catch (err) {
    if (/registered DLT template/.test(err.message)) {
      console.log('HttpDltSmsProvider correctly rejected untemplated send:', err.message);
    } else {
      throw err;
    }
  }

  try {
    await smsProvider.send({
      to: '9812345678',
      meta: { templateId: 'NOT_A_REAL_TEMPLATE', templateParams: {} },
    });
    throw new Error('HttpDltSmsProvider should have rejected an unknown templateId!');
  } catch (err) {
    if (/not a registered DLT template/.test(err.message)) {
      console.log('HttpDltSmsProvider correctly rejected unknown templateId:', err.message);
    } else {
      throw err;
    }
  }

  try {
    await smsProvider.send({
      to: '9812345678',
      meta: { templateId: 'OTP', templateParams: { otpCode: '123456' } }, // missing validityMinutes
    });
    throw new Error('HttpDltSmsProvider should have rejected missing required template params!');
  } catch (err) {
    if (/requires meta.templateParams/.test(err.message)) {
      console.log('HttpDltSmsProvider correctly rejected incomplete template params:', err.message);
    } else {
      throw err;
    }
  }

  // A valid, fully-specified OTP template send will fail at the network call (no real
  // gateway configured here) but must get PAST the template-lock checks first — proving the
  // registered-template build path itself is reachable and well-formed.
  try {
    await smsProvider.send({
      to: '9812345678',
      meta: { templateId: 'OTP', templateParams: { otpCode: '123456', validityMinutes: 5 } },
    });
    console.log('Unexpected: network call to invalid host succeeded');
  } catch (err) {
    if (/registered DLT template|requires meta|not a registered/.test(err.message)) {
      throw new Error(`Valid template send was rejected by the template guard unexpectedly: ${err.message}`);
    }
    console.log('Valid OTP template passed the DLT template-lock (failed only at network layer as expected):', err.message);
  }

  // --- Task #29: PHI keyword guard on NotificationTemplate ----------------------------
  const dirtyBody = {
    code: 'SMOKE_DIRTY_TEMPLATE',
    name: 'Dirty template',
    body: 'Hi {{patientName}}, your diagnosis report is ready.',
  };
  const dirtyParse = templateSchema.safeParse(dirtyBody);
  if (dirtyParse.success) {
    throw new Error('templateSchema should have rejected a body containing "diagnosis"!');
  }
  console.log(
    'templateSchema correctly rejected PHI keyword template:',
    dirtyParse.error.issues.map((i) => i.message).join('; ')
  );

  const dirtyMergeField = {
    code: 'SMOKE_DIRTY_MERGEFIELD',
    name: 'Dirty merge field template',
    body: 'Hi {{patientName}}, here is your update: {{clinicalNotes}}',
  };
  const dirtyMergeParse = templateSchema.safeParse(dirtyMergeField);
  if (dirtyMergeParse.success) {
    throw new Error('templateSchema should have rejected a body containing {{clinicalNotes}}!');
  }
  console.log(
    'templateSchema correctly rejected PHI merge-field template:',
    dirtyMergeParse.error.issues.map((i) => i.message).join('; ')
  );

  const dirtyUpdate = updateTemplateSchema.safeParse({ subject: 'Your biopsy results' });
  if (dirtyUpdate.success) {
    throw new Error('updateTemplateSchema should have rejected a subject containing "biopsy"!');
  }
  console.log('updateTemplateSchema correctly rejected PHI keyword in subject:', dirtyUpdate.error.issues.map((i) => i.message).join('; '));

  const cleanBody = {
    code: 'SMOKE_CLEAN_TEMPLATE',
    name: 'Clean template',
    body: 'Hi {{patientName}}, your appointment on {{appointmentDate}} is confirmed. See you soon!',
  };
  const cleanParse = templateSchema.safeParse(cleanBody);
  if (!cleanParse.success) {
    throw new Error(`Clean template should have passed validation: ${JSON.stringify(cleanParse.error.issues)}`);
  }
  console.log('templateSchema correctly accepted clean template');

  const savedTemplate = await NotificationTemplate.create(cleanParse.data);
  console.log('Clean NotificationTemplate saved to DB:', savedTemplate.code);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
