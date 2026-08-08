import { config } from './index.js';

/**
 * Runtime mirror of the Organization singleton's *operational* settings (ORG-001).
 *
 * WHY THIS EXISTS
 * ---------------
 * `Organization` is a database document, so reading it is asynchronous. But two of its settings
 * are needed from synchronous call sites that cannot be made async without rewriting every
 * aggregation in the app:
 *
 *   - `timezone`  — consumed by `dayBucket()` (src/utils/date.util.js), which is inlined into ~8
 *                   Mongo `$dateToString` pipeline stages built synchronously.
 *   - `financialYearStartMonth` — consumed by `parseReportFilters()`, a synchronous helper called
 *                   by every analytics service.
 *
 * This module holds the last-known org values so those helpers stay synchronous while still
 * honouring what an admin configured.
 *
 * PRECEDENCE (deliberate, in order — first non-null wins)
 * ------------------------------------------------------
 *   1. The Organization record.  It is the thing an administrator can actually edit in the
 *      product, so it MUST win. Previously it lost to (2) and the setting enforced nothing.
 *   2. The environment default (`CLINIC_DEFAULT_TIMEZONE`). This is a deployment-time bootstrap
 *      value only: it is what the process uses before the database has been read, and what it
 *      falls back to if the organization document is somehow unreadable.
 *   3. A hardcoded `Asia/Kolkata` / April, because this product ships for a clinic in Surat.
 *
 * The cache is refreshed by `OrganizationRepository.getSingleton()` — i.e. on every read AND
 * every write of the organization — and primed once at server start. A stale value can therefore
 * only survive until the next organization read, and never survives an edit.
 */

const FALLBACK_TIMEZONE = 'Asia/Kolkata';
const FALLBACK_FY_START_MONTH = 4; // April — Indian financial year.

/** Populated from the Organization record; `null` means "not read yet, use the env default". */
const state = {
  timezone: null,
  financialYearStartMonth: null,
};

/** Called with the Organization document (or a plain object) whenever one is loaded or saved. */
export function refreshOrgRuntime(org) {
  if (!org) return;
  if (org.timezone) state.timezone = String(org.timezone);
  const month = Number(org.financialYearStartMonth);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    state.financialYearStartMonth = month;
  }
}

/** Test/bootstrap seam — drops the cached org values so the env default applies again. */
export function resetOrgRuntime() {
  state.timezone = null;
  state.financialYearStartMonth = null;
}

/** Org record → env default → `Asia/Kolkata`. See the precedence note above. */
export function orgTimezone() {
  return state.timezone || config.clinic.defaultTimezone || FALLBACK_TIMEZONE;
}

/** Org record → April. There is no environment default for the financial year. */
export function orgFinancialYearStartMonth() {
  return state.financialYearStartMonth || FALLBACK_FY_START_MONTH;
}

export default {
  refreshOrgRuntime,
  resetOrgRuntime,
  orgTimezone,
  orgFinancialYearStartMonth,
};
