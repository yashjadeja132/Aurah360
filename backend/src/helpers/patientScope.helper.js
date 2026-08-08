import mongoose from 'mongoose';
import ApiError from '../libs/ApiError.js';
import Patient from '../models/Patient.model.js';
import Consultation from '../models/Consultation.model.js';
import Appointment from '../models/Appointment.model.js';
import { resolveBranchScope } from './scope.helper.js';

/**
 * SEC-030 (extension) — PATIENT-ANCHORED row scoping.
 *
 * `scope.helper.js` pins a *row's own* `branchId`. That works for rows that carry a branch
 * (appointments, cash closes, loyalty ledger entries). It does not work for the records this
 * module guards — patient documents, clinical photos, consent grants, privacy requests, loyalty
 * balances — because those rows either have no branch column at all, or carry one that is
 * routinely null/irrelevant. The thing that has a branch is the PATIENT.
 *
 * Naively pinning to `Patient.primaryBranchId` would be an outage, not a fix: a patient registered
 * at Branch A who is treated at Branch B must remain fully readable to Branch B's staff, and a
 * loyalty balance earned at A must be redeemable at B. So the scope here is the set of branches a
 * patient is actually CONNECTED to:
 *
 *   primaryBranchId  ∪  every branch they have a consultation at  ∪  every branch they have an
 *   appointment at
 *
 * A caller may read the patient's records iff their own branch is in that set. That is the
 * "patient-relationship check" that staff file access was missing entirely.
 *
 * OWNER/ADMIN are unrestricted (resolveBranchScope returns null for them).
 *
 * Out-of-scope reads answer 404, never 403 — a 403 confirms the id exists and belongs to someone,
 * which is precisely the fact the scope protects. This matters most for file ids.
 */

const toObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) return value;
  const s = String(value ?? '');
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
};

const addAll = (set, values) => {
  (values || []).forEach((v) => {
    if (v) set.add(String(v));
  });
};

/**
 * @param {Array<string|ObjectId>} patientIds
 * @returns {Promise<Map<string, Set<string>>>} patientId -> set of connected branchId strings
 */
export const branchesForPatients = async (patientIds) => {
  const objIds = [...new Set((patientIds || []).map((id) => String(id)))]
    .map(toObjectId)
    .filter(Boolean);

  const result = new Map();
  if (!objIds.length) return result;
  objIds.forEach((id) => result.set(id.toString(), new Set()));

  const [patients, consultations, appointments] = await Promise.all([
    Patient.find({ _id: { $in: objIds } }).select('primaryBranchId').lean(),
    Consultation.aggregate([
      { $match: { patientId: { $in: objIds } } },
      { $group: { _id: '$patientId', branches: { $addToSet: '$branchId' } } },
    ]),
    Appointment.aggregate([
      { $match: { patientId: { $in: objIds } } },
      { $group: { _id: '$patientId', branches: { $addToSet: '$branchId' } } },
    ]),
  ]);

  patients.forEach((p) => {
    if (p.primaryBranchId) result.get(p._id.toString())?.add(String(p.primaryBranchId));
  });
  [...consultations, ...appointments].forEach((row) => {
    const set = result.get(String(row._id));
    if (set) addAll(set, row.branches);
  });

  return result;
};

/** Single-patient convenience wrapper around `branchesForPatients`. */
export const branchesForPatient = async (patientId) =>
  (await branchesForPatients([patientId])).get(String(patientId)) || new Set();

/**
 * The caller's branch, or null when they are unrestricted (OWNER/ADMIN). Throws the same
 * fail-closed 409 as `resolveBranchScope` for a branch-less staff account.
 */
export const callerBranchId = (req) => resolveBranchScope(req);

/** True when `patientId` is connected to the caller's branch (always true for OWNER/ADMIN). */
export const isPatientInScope = async (req, patientId) => {
  const branchId = callerBranchId(req);
  if (!branchId) return true;
  const branches = await branchesForPatient(patientId);
  return branches.has(String(branchId));
};

/**
 * Guard for SINGLE-RECORD reads/writes hung off a patient. 404 (never 403) when out of scope.
 */
export const assertPatientInScope = async (req, patientId, notFoundMessage = 'Not found') => {
  if (!(await isPatientInScope(req, patientId))) throw ApiError.notFound(notFoundMessage);
};

/**
 * Drops rows whose patient is not connected to the caller's branch. Used for LIST endpoints
 * whose rows carry a patientId but no branchId of their own (privacy requests, consent history).
 *
 * @param {import('express').Request} req
 * @param {Array<object>} rows
 * @param {(row:object)=>string|null} getPatientId
 */
export const filterRowsToPatientScope = async (req, rows, getPatientId = (r) => r.patientId) => {
  const branchId = callerBranchId(req);
  if (!branchId) return rows;
  const list = rows || [];
  const map = await branchesForPatients(list.map(getPatientId).filter(Boolean));
  return list.filter((row) => {
    const pid = getPatientId(row);
    if (!pid) return false; // no patient anchor => cannot be proven in-scope => fail closed
    return (map.get(String(pid)) || new Set()).has(String(branchId));
  });
};

export default assertPatientInScope;
