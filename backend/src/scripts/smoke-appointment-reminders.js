/** Ad-hoc smoke test for the 24h / same-day appointment reminder scan (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import Appointment from '../models/Appointment.model.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import { scanAndSendAppointmentReminders } from '../queues/appointmentReminderJobs.js';

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function hhmm(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_appt_reminders'));
  await mongoose.connection.dropDatabase();

  const patient = await Patient.create({
    mrn: `MRN-REM-${Date.now()}`,
    firstName: 'Reminder',
    lastName: 'Smoke',
    gender: 'MALE',
    mobile: '9812345000',
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  // "now" reference — captured once so the whole scenario is relative to a single instant,
  // not wall-clock drift across the script's run.
  const now = new Date();

  // ~23 hours from now → falls inside the 24h-reminder window (24h + 30min buffer) but is
  // not "today" in general, so it should NOT also match the same-day query unless it happens
  // to land on today's calendar date.
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  const appt = await Appointment.create({
    appointmentNumber: `APT-REM-${Date.now()}`,
    patientId: patient._id,
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    appointmentDate: new Date(ymd(in23h)), // stored at midnight, matching AppointmentService's startOfDay()
    startTime: hhmm(in23h),
    endTime: hhmm(new Date(in23h.getTime() + 15 * 60 * 1000)),
    status: APPOINTMENT_STATUS.CONFIRMED,
  });

  console.log('Created appointment', appt.appointmentNumber, 'at', appt.appointmentDate, appt.startTime);

  // First run: should find + send the 24h reminder exactly once.
  const first = await scanAndSendAppointmentReminders({ now });
  console.log('First scan result:', first);

  const afterFirst = await Appointment.findById(appt._id);
  if (!afterFirst.reminder24hSentAt) {
    throw new Error('Expected reminder24hSentAt to be set after first scan');
  }
  if (first.sent24h !== 1) {
    throw new Error(`Expected exactly 1 24h reminder sent on first scan, got ${first.sent24h}`);
  }

  // Second run (dedup check): same appointment, same "now" — must NOT send again.
  const second = await scanAndSendAppointmentReminders({ now });
  console.log('Second scan result (dedup check):', second);
  if (second.sent24h !== 0) {
    throw new Error(`Dedup failed — expected 0 reminders on second scan, got ${second.sent24h}`);
  }

  // Sanity: an appointment already reminded should not be picked up again even much later.
  const muchLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const third = await scanAndSendAppointmentReminders({ now: muchLater });
  if (third.sent24h !== 0) {
    throw new Error(`Dedup failed on later scan — expected 0, got ${third.sent24h}`);
  }
  console.log('Third scan (later "now", still deduped):', third);

  // —— Same-day reminder path ——
  const todayLater = new Date(now);
  todayLater.setHours(now.getHours() + 1, now.getMinutes(), 0, 0);
  // Keep it within today's calendar date; if adding an hour rolled into tomorrow, just push
  // a few minutes ahead instead so the scenario still exercises "today".
  const sameDayTarget = isSameCalendarDay(todayLater, now)
    ? todayLater
    : new Date(now.getTime() + 5 * 60 * 1000);

  const apptSameDay = await Appointment.create({
    appointmentNumber: `APT-SDAY-${Date.now()}`,
    patientId: patient._id,
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    appointmentDate: new Date(ymd(now)),
    startTime: hhmm(sameDayTarget),
    endTime: hhmm(new Date(sameDayTarget.getTime() + 15 * 60 * 1000)),
    status: APPOINTMENT_STATUS.SCHEDULED,
  });

  console.log('Created same-day appointment', apptSameDay.appointmentNumber, 'at', apptSameDay.startTime);

  const sdFirst = await scanAndSendAppointmentReminders({ now });
  console.log('Same-day first scan:', sdFirst);
  const sdAfterFirst = await Appointment.findById(apptSameDay._id);
  if (!sdAfterFirst.reminderSameDaySentAt) {
    throw new Error('Expected reminderSameDaySentAt to be set after first scan');
  }
  if (sdFirst.sentSameDay !== 1) {
    throw new Error(`Expected exactly 1 same-day reminder sent, got ${sdFirst.sentSameDay}`);
  }

  const sdSecond = await scanAndSendAppointmentReminders({ now });
  console.log('Same-day second scan (dedup check):', sdSecond);
  if (sdSecond.sentSameDay !== 0) {
    throw new Error(`Same-day dedup failed — expected 0, got ${sdSecond.sentSameDay}`);
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
  // NotificationService's queueEvent opens BullMQ/ioredis connections for job dispatch;
  // this script only exercises the scan+dedup logic, so force-exit rather than wiring up
  // a full graceful shutdown of every queue connection.
  process.exit(0);
}

function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
