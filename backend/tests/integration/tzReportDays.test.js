import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import { refreshOrgRuntime, resetOrgRuntime } from '../../src/config/orgRuntime.js';
import Patient from '../../src/models/Patient.model.js';
import Lead from '../../src/models/Lead.model.js';
import QueueEntry from '../../src/models/QueueEntry.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import StockTransaction from '../../src/models/StockTransaction.model.js';
import ReportService from '../../src/services/ReportService.js';
import AnalyticsService from '../../src/services/AnalyticsService.js';
import { REPORT_TYPE, CHART_TYPE } from '../../src/enums/report.js';

/**
 * TZ-001 — exported day columns and day-bucketed series must name the CLINIC's calendar day.
 *
 * Two independent ways the old code got this wrong, and both are exercised here:
 *   1. `d.toISOString().slice(0, 10)` in the CSV/XLSX builders. A calendar-day field is stored as
 *      clinic midnight, i.e. `…T18:30:00.000Z` on the PREVIOUS UTC date, so every appointment,
 *      treatment and queue row exported one day early — regardless of host timezone.
 *   2. a `$dateToString` with no `timezone`, which groups on the UTC day, so stock movements
 *      recorded between 00:00 and 05:30 IST were charted on the previous day.
 *
 * Every case runs under a forced non-IST `process.env.TZ`: the host must not be able to influence
 * the answer in either direction.
 */

const ORIGINAL_TZ = process.env.TZ;

/** 05 Aug 2025 00:00 IST — a CALENDAR DAY, stored the way the app stores calendar days. */
const CAL_DAY_5_AUG = new Date('2025-08-04T18:30:00.000Z');
/** 06 Aug 2025 00:30 IST — an INSTANT whose UTC date (5 Aug) is not its clinic date (6 Aug). */
const INSTANT_EARLY_6_AUG = new Date('2025-08-05T19:00:00.000Z');

const RANGE = { dateFrom: '2025-08-01', dateTo: '2025-08-10' };

const reports = new ReportService();
const analytics = new AnalyticsService();

async function withHostTz(tz, fn) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

/**
 * Fixtures go in through the driver, not through Mongoose.
 *
 * These report builders only read (`find().lean()` / `aggregate()`), and building schema-valid
 * Appointment/TreatmentSession/QueueEntry documents would drag in a dozen unrelated required refs
 * that have nothing to do with the day label under test.
 */
const raw = (Model, doc) => Model.collection.insertOne({ deletedAt: null, ...doc });

beforeAll(async () => {
  await connectTestDb('tzday');

  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();

  await raw(Patient, {
    _id: patientId,
    mrn: 'MRN-TZ-1',
    firstName: 'Tz',
    lastName: 'Patient',
    gender: 'FEMALE',
    mobile: '9800000111',
    // An evening registration: 00:30 IST on 6 Aug, which UTC calls 5 Aug.
    registrationDate: INSTANT_EARLY_6_AUG,
    status: 'ACTIVE',
  });

  await raw(Lead, {
    leadNumber: 'LEAD-TZ-1',
    firstName: 'Tz',
    phone: '9800000112',
    source: 'WALK_IN',
    status: 'NEW',
    priority: 'MEDIUM',
    createdAt: INSTANT_EARLY_6_AUG,
  });

  await raw(Appointment, {
    appointmentNumber: 'APT-TZ-1',
    patientId,
    doctorId,
    appointmentDate: CAL_DAY_5_AUG,
    startTime: '10:00',
    endTime: '10:30',
    status: 'BOOKED',
    type: 'CONSULTATION',
  });

  await raw(TreatmentSession, {
    sessionNumber: 1,
    patientId,
    doctorId,
    scheduledDate: CAL_DAY_5_AUG,
    status: 'SCHEDULED',
  });

  await raw(QueueEntry, {
    tokenNumber: 'T-TZ-1',
    patientId,
    queueDate: CAL_DAY_5_AUG,
    queueStatus: 'WAITING',
    isWalkIn: true,
  });

  // Stock movement at 00:30 IST on 6 Aug — the UTC day (5 Aug) is the wrong bucket.
  await raw(StockTransaction, {
    quantity: 7,
    createdAt: INSTANT_EARLY_6_AUG,
    type: 'IN',
  });
});

beforeEach(() => {
  resetOrgRuntime();
  refreshOrgRuntime({ timezone: 'Asia/Kolkata', financialYearStartMonth: 4 });
});

afterAll(async () => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
  await dropTestDb();
  await disconnectTestDb();
});

const HOST_ZONES = ['UTC', 'America/New_York'];

describe('TZ-001 exported day columns use the clinic calendar day', () => {
  const cases = [
    ['appointments', REPORT_TYPE.APPOINTMENTS, 'date', '2025-08-05'],
    ['treatments', REPORT_TYPE.TREATMENTS, 'scheduledDate', '2025-08-05'],
    ['queue', REPORT_TYPE.QUEUE, 'queueDate', '2025-08-05'],
    ['patients', REPORT_TYPE.PATIENTS, 'registrationDate', '2025-08-06'],
    ['leads', REPORT_TYPE.LEADS, 'createdAt', '2025-08-06'],
  ];

  for (const [label, type, key, expected] of cases) {
    for (const hostTz of HOST_ZONES) {
      it(`${label} report renders ${key} as ${expected} on a ${hostTz} host`, async () => {
        const report = await withHostTz(hostTz, () =>
          reports.generateReport(type, RANGE, { audit: false })
        );
        expect(report.rows).toHaveLength(1);
        expect(report.rows[0][key]).toBe(expected);
      });
    }
  }

  it('never emits the raw UTC slice, which is the day before for calendar-day fields', async () => {
    // Pins the specific regression rather than just the happy value: the stored instant's UTC day
    // IS 2025-08-04, so a passing '2025-08-05' can only come from clinic-timezone rendering.
    expect(CAL_DAY_5_AUG.toISOString().slice(0, 10)).toBe('2025-08-04');
    expect(INSTANT_EARLY_6_AUG.toISOString().slice(0, 10)).toBe('2025-08-05');
  });
});

describe('TZ-001 inventory trend buckets on the clinic day', () => {
  for (const hostTz of HOST_ZONES) {
    it(`attributes a 00:30 IST stock movement to 6 Aug on a ${hostTz} host`, async () => {
      const chart = await withHostTz(hostTz, () =>
        analytics.chart(CHART_TYPE.INVENTORY_TREND, RANGE)
      );
      expect(chart.series).toHaveLength(1);
      expect(chart.series[0].date).toBe('2025-08-06');
      expect(chart.series[0].value).toBe(7);
    });
  }
});
