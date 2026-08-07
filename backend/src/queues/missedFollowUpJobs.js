import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';
import Consultation from '../models/Consultation.model.js';
import Appointment from '../models/Appointment.model.js';
import RecallEntry from '../models/RecallEntry.model.js';
import { CONSULTATION_STATUS } from '../enums/consultation.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import CrmExtensionsService from '../services/CrmExtensionsService.js';

export const MISSED_FOLLOW_UP_JOBS = Object.freeze({
  SCAN: 'missed-follow-up-scan',
});

/** Recall purpose used to tag/dedup entries created by this scan — must match the
 *  dedup key checked before every RecallEntry.create() below. */
export const MISSED_FOLLOW_UP_PURPOSE = 'Missed follow-up';

/** Consultations in any of these statuses are considered "finished" — a follow-up plan
 *  recorded on them is a real clinical instruction, not a draft in progress. */
const FINISHED_CONSULTATION_STATUSES = [
  CONSULTATION_STATUS.COMPLETED,
  CONSULTATION_STATUS.SIGNED,
  CONSULTATION_STATUS.LOCKED,
];

/** Repeat cadence — once daily, mirroring crmJobs.js's ensureDailyFollowUpScan. */
const SCAN_REPEAT_PATTERN = '0 9 * * *'; // 09:00 daily

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function unitToMs(unit) {
  switch (unit) {
    case 'DAYS':
      return MS_PER_DAY;
    case 'WEEKS':
      return 7 * MS_PER_DAY;
    case 'MONTHS':
      return 30 * MS_PER_DAY; // approximation, consistent with day/week granularity used here
    default:
      return null;
  }
}

/** The follow-up is anchored on when the consultation actually finished. */
function consultationAnchorDate(consultation) {
  return consultation.endedAt || consultation.startedAt || consultation.updatedAt || consultation.createdAt;
}

/** Computed follow-up-due-date from Consultation.followUp{value, unit} — null if the
 *  consultation carries no structured follow-up plan. */
function computeFollowUpDueDate(consultation) {
  const followUp = consultation.followUp;
  if (!followUp || followUp.value == null || !followUp.unit) return null;
  const anchor = consultationAnchorDate(consultation);
  if (!anchor) return null;
  const stepMs = unitToMs(followUp.unit);
  if (!stepMs) return null;
  return new Date(new Date(anchor).getTime() + followUp.value * stepMs);
}

/** Priority escalates the longer the recall has been overdue. */
function priorityForOverdueDays(overdueDays) {
  if (overdueDays >= 30) return 'HIGH';
  if (overdueDays >= 14) return 'MEDIUM';
  return 'LOW';
}

/**
 * Core scan — finds finished consultations whose structured follow-up plan is past due,
 * where the patient has had no subsequent completed visit since, and creates a RecallEntry
 * (via CrmExtensionsService.createRecallEntry) for each. Dedup is via checking for an
 * existing RecallEntry keyed on consultationId + purpose before creating, so calling this
 * repeatedly (or twice in a row) never double-creates.
 */
export async function scanForMissedFollowUps({ now = new Date(), crmExtensionsService = null } = {}) {
  const service = crmExtensionsService || new CrmExtensionsService();
  const results = { scanned: 0, created: 0, skippedHasSubsequentVisit: 0, skippedDuplicate: 0, errors: [] };

  const candidates = await Consultation.find({
    deletedAt: null,
    status: { $in: FINISHED_CONSULTATION_STATUSES },
    'followUp.value': { $ne: null },
    'followUp.unit': { $ne: null },
  })
    .limit(1000)
    .exec();

  for (const consultation of candidates) {
    const dueDate = computeFollowUpDueDate(consultation);
    if (!dueDate || dueDate > now) continue;

    results.scanned += 1;
    const anchor = consultationAnchorDate(consultation);

    try {
      // No subsequent completed consultation for this patient since the follow-up was set.
      const laterConsultation = await Consultation.exists({
        _id: { $ne: consultation._id },
        patientId: consultation.patientId,
        deletedAt: null,
        status: { $in: FINISHED_CONSULTATION_STATUSES },
        $or: [{ endedAt: { $gt: anchor } }, { startedAt: { $gt: anchor } }],
      });
      if (laterConsultation) {
        results.skippedHasSubsequentVisit += 1;
        continue;
      }

      // No subsequent completed appointment for this patient since the follow-up was set.
      const laterAppointment = await Appointment.exists({
        patientId: consultation.patientId,
        deletedAt: null,
        status: APPOINTMENT_STATUS.COMPLETED,
        appointmentDate: { $gt: anchor },
      });
      if (laterAppointment) {
        results.skippedHasSubsequentVisit += 1;
        continue;
      }

      // Dedup — a recall entry for this exact consultation + purpose already exists.
      const existing = await RecallEntry.findOne({
        consultationId: consultation._id,
        purpose: MISSED_FOLLOW_UP_PURPOSE,
      });
      if (existing) {
        results.skippedDuplicate += 1;
        continue;
      }

      const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY);

      await service.createRecallEntry(
        {
          patientId: consultation.patientId,
          consultationId: consultation._id,
          branchId: consultation.branchId || null,
          preferredDoctorId: consultation.doctorId || null,
          dueDate,
          purpose: MISSED_FOLLOW_UP_PURPOSE,
          priority: priorityForOverdueDays(overdueDays),
        },
        null
      );
      results.created += 1;
    } catch (err) {
      results.errors.push({ consultationId: consultation._id.toString(), message: err.message });
      logger.warn('Missed follow-up recall creation failed', {
        consultationId: consultation._id.toString(),
        message: err.message,
      });
    }
  }

  return results;
}

/** Repeatable daily scan, registered once — mirrors crmJobs.js's ensureDailyFollowUpScan. */
export async function ensureMissedFollowUpScan() {
  try {
    const queue = getQueue(QUEUE_NAMES.CRM);
    const existing = await queue.getRepeatableJobs();
    const already = existing.some((j) => j.name === MISSED_FOLLOW_UP_JOBS.SCAN);
    if (already) return;
    await queue.add(
      MISSED_FOLLOW_UP_JOBS.SCAN,
      { type: 'scan' },
      {
        repeat: { pattern: SCAN_REPEAT_PATTERN },
        jobId: 'missed-follow-up-scan',
      }
    );
    logger.info('Missed follow-up scan scheduled', { pattern: SCAN_REPEAT_PATTERN });
  } catch (err) {
    logger.warn('Missed follow-up scan not scheduled', { message: err.message });
  }
}

let worker = null;

export function startMissedFollowUpWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.CRM,
    async (job) => {
      if (job.name === MISSED_FOLLOW_UP_JOBS.SCAN) {
        const result = await scanForMissedFollowUps();
        logger.info('Missed follow-up scan job', result);
        return result;
      }
      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.CRM);

  ensureMissedFollowUpScan().catch(() => {});

  logger.info('Missed follow-up BullMQ worker started');
  return worker;
}

export default {
  scanForMissedFollowUps,
  ensureMissedFollowUpScan,
  startMissedFollowUpWorker,
  MISSED_FOLLOW_UP_JOBS,
  MISSED_FOLLOW_UP_PURPOSE,
};
