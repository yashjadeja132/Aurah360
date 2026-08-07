import mongoose from 'mongoose';

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

export function eachDayKey(from, to) {
  const keys = [];
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    keys.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export default {
  parseReportFilters,
  applyCommonMatch,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  daysAgo,
  pct,
  roundMoney,
  eachDayKey,
};
