import ApiError from '../libs/ApiError.js';
import { ROLES } from '../constants/roles.js';
import DoctorRepository from '../repositories/DoctorRepository.js';

/**
 * SEC-030 — row-level (data) scoping for list/browse endpoints.
 *
 * RBAC (`requirePermission`) answers "may this user call this endpoint at all". It does NOT
 * answer "which ROWS may they see". Before this helper existed, every list endpoint passed
 * `req.query` straight through to the repository, so a DOCTOR holding plain `patients.view` /
 * `appointments.view` received every patient in the organisation and every other doctor's
 * appointments — and could freely aim `?doctorId=<colleague>` at any list to read their book.
 *
 * The rule, applied identically everywhere:
 *
 *   1. BRANCH — every role except OWNER/ADMIN is pinned to their own `user.branch`
 *      (carried on the access token as `req.auth.branch`, set in AuthService).
 *   2. DOCTOR — a DOCTOR's own `doctorId` is resolved SERVER-SIDE from the token subject
 *      (same lookup ReportService#doctorDashboard already uses) and forced onto the filter.
 *   3. A client-supplied `branchId`/`doctorId` may only ever NARROW within the caller's
 *      scope. Anything that would WIDEN it is rejected with 403 — never silently honoured,
 *      and never silently dropped either (a dropped param would show the caller a list they
 *      did not ask for and quietly hide the fact that their filter was ignored).
 *
 * Scope is derived from the auth token only. Nothing a caller can type into a query string
 * can grant them a wider scope than their account already has.
 */

const doctorRepository = new DoctorRepository();

/**
 * Roles that legitimately see across every branch. Deliberately NOT permission-derived:
 * a wildcard like `patients.*` describes which VERBS a role may use, not how many branches
 * it may read, and conflating the two is exactly how BRANCH_MANAGER (`patients.*`) ended up
 * with organisation-wide reach.
 */
const GLOBAL_SCOPE_ROLES = Object.freeze([ROLES.OWNER, ROLES.ADMIN]);

export const hasGlobalScope = (auth) => GLOBAL_SCOPE_ROLES.includes(auth?.role);

const asId = (value) => (value == null ? null : String(value));

/**
 * The signed-in user's own Doctor._id, or null when they have no Doctor profile.
 * Memoised per-request: several controllers scope more than one query per call.
 */
export const resolveOwnDoctorId = async (req) => {
  if (Object.prototype.hasOwnProperty.call(req, 'ownDoctorId')) return req.ownDoctorId;
  const userId = req.auth?.userId;
  const doctor = userId ? await doctorRepository.findByUserId(userId) : null;
  req.ownDoctorId = doctor ? doctor._id.toString() : null;
  return req.ownDoctorId;
};

/**
 * The branchId this caller's list queries must be pinned to, or null for OWNER/ADMIN
 * (who may filter by any branch, or none, at will).
 *
 * NULL-BRANCH POLICY (deliberate, fail-closed): if a non-OWNER/ADMIN account has no branch
 * assigned we CANNOT scope it, so we refuse the request rather than fall back to "unscoped"
 * — an unassigned account must never mean "sees the whole organisation". The failure is
 * explicit (409 BRANCH_SCOPE_UNASSIGNED, naming the remedy) rather than an empty list, so it
 * cannot be mistaken for "there is no data" and reads as a fixable misconfiguration.
 * `src/scripts/backfill-user-branch.js` assigns branches to existing accounts.
 */
export const resolveBranchScope = (req) => {
  const requested = asId(req.query?.branchId);

  if (hasGlobalScope(req.auth)) return requested;

  const own = asId(req.auth?.branch);
  if (!own) {
    throw ApiError.conflict(
      'Your account has no branch assigned, so branch-scoped data cannot be shown. '
        + 'Ask an administrator to assign your user to a branch.',
      'BRANCH_SCOPE_UNASSIGNED'
    );
  }
  if (requested && requested !== own) {
    throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
  }
  return own;
};

/**
 * The doctorId a DOCTOR's list queries must be pinned to. Returns null (no doctor pinning)
 * for every other role — a receptionist filtering by doctor is normal and stays allowed.
 */
export const resolveDoctorScope = async (req) => {
  if (req.auth?.role !== ROLES.DOCTOR) return null;

  const own = await resolveOwnDoctorId(req);
  if (!own) {
    throw ApiError.conflict(
      'Your user has the DOCTOR role but no linked doctor profile, so your own records '
        + 'cannot be identified. Ask an administrator to link your user to a doctor profile.',
      'DOCTOR_PROFILE_MISSING'
    );
  }

  const requested = asId(req.query?.doctorId);
  if (requested && requested !== own) {
    throw ApiError.forbidden('doctorId is outside your scope', 'DOCTOR_SCOPE_VIOLATION');
  }
  return own;
};

/**
 * Returns a copy of `req.query` with the caller's scope forced onto it. Use for LIST/BROWSE
 * endpoints; individual-record reads are deliberately left broad (see the module docblock of
 * each controller) because a doctor covering a colleague must still be able to open a record.
 *
 * @param {import('express').Request} req
 * @param {{ branch?: boolean, doctor?: boolean }} opts
 *   branch — pin `branchId` (default true).
 *   doctor — pin `doctorId` when the caller is a DOCTOR (default false; enable on lists that
 *            represent a doctor's own workload: appointments, consultations, plans, sessions, queue).
 */
export const scopedListQuery = async (req, { branch = true, doctor = false } = {}) => {
  const query = { ...(req.query || {}) };

  if (branch) {
    const branchId = resolveBranchScope(req);
    if (branchId) query.branchId = branchId;
    else delete query.branchId;
  }

  if (doctor) {
    const doctorId = await resolveDoctorScope(req);
    if (doctorId) query.doctorId = doctorId;
  }

  return query;
};

/**
 * The same scope as `scopedListQuery`, but shaped for SINGLE-RECORD reads/writes rather than a
 * query string: `{ branchId, doctorId }`, either of which may be null meaning "unrestricted for
 * this caller" (OWNER/ADMIN branch, non-doctor roles' doctorId).
 *
 * Callers must answer an out-of-scope id with 404, NOT 403 — a 403 tells an enumerating caller
 * that the id exists and belongs to someone, which is the very fact the scope is protecting.
 */
export const resolveRecordScope = async (req, { branch = true, doctor = true } = {}) => ({
  branchId: branch ? resolveBranchScope(req) : null,
  doctorId: doctor ? await resolveDoctorScope(req) : null,
});

export default scopedListQuery;
