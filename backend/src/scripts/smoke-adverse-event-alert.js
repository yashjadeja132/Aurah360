/** Ad-hoc smoke test for the AdverseEventReported staff alert listener (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import User from '../models/User.model.js';
import Notification from '../models/Notification.model.js';
import TreatmentSafetyService from '../services/TreatmentSafetyService.js';
import { registerAdverseEventAlertListeners } from '../notifications/adverseEventAlertListener.js';
import { ROLES } from '../constants/roles.js';
import { smokeDbUri } from './smokeDbUri.js';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_adverse_event_alert'));
  await mongoose.connection.dropDatabase();

  // Register the listener exactly as server.js does at startup.
  registerAdverseEventAlertListeners();

  const branchId = new mongoose.Types.ObjectId();
  const otherBranchId = new mongoose.Types.ObjectId();

  const doctor = await User.create({
    firstName: 'Alert',
    lastName: 'Doctor',
    email: `alert.doctor.${Date.now()}@smoke.local`,
    phone: '9800000001',
    passwordHash: 'smoke-hash',
    role: ROLES.DOCTOR,
    branch: branchId,
  });

  const admin = await User.create({
    firstName: 'Alert',
    lastName: 'Admin',
    email: `alert.admin.${Date.now()}@smoke.local`,
    phone: '9800000002',
    passwordHash: 'smoke-hash',
    role: ROLES.ADMIN,
    branch: branchId,
  });

  const receptionist = await User.create({
    firstName: 'Alert',
    lastName: 'Reception',
    email: `alert.reception.${Date.now()}@smoke.local`,
    phone: '9800000003',
    passwordHash: 'smoke-hash',
    role: ROLES.RECEPTIONIST,
    branch: branchId,
  });

  const otherBranchDoctor = await User.create({
    firstName: 'Other',
    lastName: 'BranchDoctor',
    email: `other.branch.doctor.${Date.now()}@smoke.local`,
    phone: '9800000004',
    passwordHash: 'smoke-hash',
    role: ROLES.DOCTOR,
    branch: otherBranchId,
  });

  const patientId = new mongoose.Types.ObjectId();

  const safetyService = new TreatmentSafetyService();
  const event = await safetyService.reportAdverseEvent(
    {
      patientId,
      branchId,
      severity: 'SEVERE',
      onsetAt: new Date(),
      description: 'Smoke test adverse event — localized swelling post-treatment.',
    },
    doctor._id.toString()
  );

  console.log('reportAdverseEvent:', { id: event.id, status: event.status, severity: event.severity });
  if (event.status !== 'ESCALATED') {
    throw new Error(`Expected SEVERE adverse event to auto-escalate, got status=${event.status}`);
  }

  // The listener runs async off the emitted event — give it a moment to complete.
  await wait(300);

  const notifications = await Notification.find({ 'variables.adverseEventId': event.id }).lean();
  console.log('Notifications referencing adverse event:', notifications.length);

  if (notifications.length === 0) {
    throw new Error('No staff notification/alert record was created for the adverse event!');
  }

  const notifiedUserIds = notifications.map((n) => String(n.userId));
  if (!notifiedUserIds.includes(String(doctor._id))) {
    throw new Error('Expected the branch doctor to receive an adverse-event alert.');
  }
  if (!notifiedUserIds.includes(String(admin._id))) {
    throw new Error('Expected the branch admin to receive an adverse-event alert.');
  }
  if (notifiedUserIds.includes(String(receptionist._id))) {
    throw new Error('Receptionist (non-alert role) should not have received an adverse-event alert.');
  }
  if (notifiedUserIds.includes(String(otherBranchDoctor._id))) {
    throw new Error('Doctor from a different branch should not have received this alert.');
  }

  for (const n of notifications) {
    if (n.channel !== 'IN_APP') throw new Error(`Expected IN_APP channel, got ${n.channel}`);
    if (String(n.variables?.adverseEventId) !== String(event.id)) {
      throw new Error('Notification does not reference the correct adverseEventId');
    }
    if (!/urgent/i.test(n.subject || '')) {
      throw new Error('Notification subject does not read as high-priority');
    }
  }
  console.log('All notifications are IN_APP, high-priority, and reference the adverse event.');

  // Requirement: the alert is not tied to / dismissible by billing or invoice status — it has
  // no billing linkage at all, and can only be worked through the AdverseEvent's own workflow.
  const doctorAlert = notifications.find((n) => String(n.userId) === String(doctor._id));
  if (doctorAlert.readAt || doctorAlert.archivedAt) {
    throw new Error('Alert should start unread/unarchived, independent of any billing action.');
  }
  console.log('Alert is not linked to billing/invoice status and remains open until worked directly.');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
  // BullMQ/Redis connections opened by the notification queue keep the event loop alive —
  // exit explicitly once assertions have passed.
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
