import mongoose from 'mongoose';
import { orgFinancialYearStartMonth } from '../config/orgRuntime.js';

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function daysAgo(n, from = new Date()) {
  const x = startOfDay(from);
  x.setDate(x.getDate() - n);
  return x;
}

/**
 * ORG-001 — the clinic's financial year, per `Organization.financialYearStartMonth`.
 *
 * India's FY runs April–March, so a calendar-year report is the wrong period for anything a
 * clinic files. `offsetYears` steps whole financial years backwards (0 = the FY containing
 * `on`, -1 = the previous one).
 *
 * Returns local-time bounds, matching startOfDay/endOfDay used everywhere else in this helper.
 */
export function financialYearRange(on = new Date(), offsetYears = 0) {
  const startMonth = orgFinancialYearStartMonth(); // 1..12
  const monthIndex = startMonth - 1; // Date months are 0-based
  // The FY labelled by its starting year: before the start month we are still in the FY that
  // began last calendar year.
  const startYear = (on.getMonth() < monthIndex ? on.getFullYear() - 1 : on.getFullYear())
    + offsetYears;
  const from = new Date(startYear, monthIndex, 1, 0, 0, 0, 0);
  // Day 0 of the start month one year on = the last day of the financial year.
  const to = new Date(startYear + 1, monthIndex, 0, 23, 59, 59, 999);
  return { from, to, startMonth, startYear, label: `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}` };
}

/**
 * Named reporting periods. An explicit dateFrom/dateTo always wins over `period`.
 * `FY` = the current financial year, `FY_PREV` = the one before it.
 */
export const REPORT_PERIOD = Object.freeze({ FY: 'FY', FY_PREV: 'FY_PREV' });

/** Normalize query filters used across dashboards/reports. */
export function parseReportFilters(query = {}) {
  const filters = {
    branchId: null,
    doctorId: null,
    departmentId: null,
    serviceId: null,
    paymentStatus: null,
    leadSource: null,
    dateFrom: null,
    dateTo: null,
  };

  if (query.branchId && mongoose.isValidObjectId(query.branchId)) {
    filters.branchId = new mongoose.Types.ObjectId(query.branchId);
  }
  if (query.doctorId && mongoose.isValidObjectId(query.doctorId)) {
    filters.doctorId = new mongoose.Types.ObjectId(query.doctorId);
  }
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filters.departmentId = new mongoose.Types.ObjectId(query.departmentId);
  }
  if (query.serviceId && mongoose.isValidObjectId(query.serviceId)) {
    filters.serviceId = new mongoose.Types.ObjectId(query.serviceId);
  }
  if (query.paymentStatus) filters.paymentStatus = String(query.paymentStatus);
  if (query.leadSource) filters.leadSource = String(query.leadSource);

  if (query.dateFrom) {
    const d = new Date(query.dateFrom);
    if (!Number.isNaN(d.getTime())) filters.dateFrom = startOfDay(d);
  }
  if (query.dateTo) {
    const d = new Date(query.dateTo);
    if (!Number.isNaN(d.getTime())) filters.dateTo = endOfDay(d);
  }

  // A named financial-year period fills in whichever bound the caller did not pin explicitly.
  const period = query.period ? String(query.period).toUpperCase() : null;
  if (period === REPORT_PERIOD.FY || period === REPORT_PERIOD.FY_PREV) {
    const fy = financialYearRange(new Date(), period === REPORT_PERIOD.FY_PREV ? -1 : 0);
    if (!filters.dateFrom) filters.dateFrom = fy.from;
    if (!filters.dateTo) filters.dateTo = fy.to;
    filters.period = period;
    filters.financialYearLabel = fy.label;
  }

  if (!filters.dateFrom && !filters.dateTo) {
    filters.dateFrom = daysAgo(30);
    filters.dateTo = endOfDay();
  } else if (filters.dateFrom && !filters.dateTo) {
    filters.dateTo = endOfDay();
  } else if (!filters.dateFrom && filters.dateTo) {
    filters.dateFrom = daysAgo(30, filters.dateTo);
  }

  return filters;
}

export function applyCommonMatch(match, filters, { dateField = 'createdAt', includeDoctor = true } = {}) {
  const m = { ...match, deletedAt: null };
  if (filters.branchId) m.branchId = filters.branchId;
  if (includeDoctor && filters.doctorId) m.doctorId = filters.doctorId;
  if (filters.departmentId) m.departmentId = filters.departmentId;
  if (filters.serviceId) m.serviceId = filters.serviceId;
  if (dateField && (filters.dateFrom || filters.dateTo)) {
    m[dateField] = {};
    if (filters.dateFrom) m[dateField].$gte = filters.dateFrom;
    if (filters.dateTo) m[dateField].$lte = filters.dateTo;
  }
  return m;
}

export function pct(numerator, denominator, decimals = 1) {
  if (!denominator) return 0;
  const f = 10 ** decimals;
  return Math.round((numerator / denominator) * 100 * f) / f;
}

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * `YYYY-MM-DD` for the LOCAL calendar day. Must NOT be `toISOString().slice(0, 10)`: the range
 * bounds come from `startOfDay`/`endOfDay`, which are local, so in IST (UTC+5:30) local midnight is
 * `…T18:30:00.000Z` on the PREVIOUS UTC date — a UTC slice labelled every bucket a day early.
 */
export function localDayKey(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The inclusive list of local calendar-day keys spanned by `from`..`to`.
 *
 * These keys are joined against `$dateToString` group ids, so those aggregations MUST pass
 * `timezone: clinicTimezone()` — otherwise Mongo groups on the UTC day while this list is on the
 * local day and the two disagree. Before the timezone was supplied, a request for Aug 3–5 produced
 * labels Aug 2–4, and the last day of every instant-based series (revenue, patient growth) was
 * dropped entirely because its UTC key fell outside the shifted list.
 */
export function eachDayKey(from, to) {
  const keys = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    keys.push(localDayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export default {
  parseReportFilters,
  financialYearRange,
  REPORT_PERIOD,
  applyCommonMatch,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  daysAgo,
  pct,
  roundMoney,
  localDayKey,
  eachDayKey,
};
