/**
 * SEC-030 remediation — makes existing installations compatible with row-level (data) scoping.
 *
 * Two idempotent steps:
 *
 *   1. RESYNC Permission catalogue + Role.permissions from the code constants. Tokens carry the
 *      permissions stored on the Role document (AuthService -> RoleService.getEffectivePermissions),
 *      so a change to ROLE_PERMISSIONS in code has no effect until the Role documents are updated.
 *      This is what actually removes MASTERS_VIEW / RESOURCES_VIEW from live DOCTOR sessions and
 *      grants the narrower MASTERS_LOOKUP in their place.
 *
 *   2. BACKFILL User.branch for every non-OWNER/ADMIN account that has none. Branch scoping is
 *      fail-closed by design (see helpers/scope.helper.js): an account with no branch is refused
 *      rather than shown the whole organisation. Existing seeded accounts predate that rule and
 *      have branch === null, so they must be assigned one. A staff user's branch is inferred, in
 *      order, from: their doctor profile's appointments, then the busiest branch overall.
 *
 * Run: node src/scripts/backfill-user-branch.js  [--dry-run]
 * Safe to re-run. Touches no patient or clinical data.
 */
import '../config/env.js';
import database from '../config/database.js';
import Permission from '../models/Permission.model.js';
import Role from '../models/Role.model.js';
import User from '../models/User.model.js';
import Branch from '../models/Branch.model.js';
import Doctor from '../models/Doctor.model.js';
import Appointment from '../models/Appointment.model.js';
import { PERMISSION_CATALOG } from '../constants/permissions.js';
import { ROLES, ROLE_LABELS, ROLE_LIST } from '../constants/roles.js';
import { ROLE_PERMISSIONS } from '../constants/rolePermissions.js';
import logger from '../libs/logger.js';

const DRY_RUN = process.argv.includes('--dry-run');

/** Roles that legitimately span every branch and so need no branch assignment. */
const GLOBAL_ROLES = [ROLES.OWNER, ROLES.ADMIN];

async function resyncPermissionsAndRoles() {
  for (const entry of PERMISSION_CATALOG) {
    if (DRY_RUN) continue;
    await Permission.findOneAndUpdate(
      { key: entry.key },
      { $set: { key: entry.key, module: entry.module, description: entry.description } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  const changed = [];
  for (const code of ROLE_LIST) {
    const desired = ROLE_PERMISSIONS[code] || [];
    const existing = await Role.findOne({ code });
    const before = existing?.permissions || [];
    const differs =
      before.length !== desired.length || desired.some((p) => !before.includes(p));
    if (!differs) continue;

    changed.push({
      code,
      added: desired.filter((p) => !before.includes(p)),
      removed: before.filter((p) => !desired.includes(p)),
    });
    if (DRY_RUN) continue;

    await Role.findOneAndUpdate(
      { code },
      {
        $set: {
          code,
          name: ROLE_LABELS[code],
          permissions: desired,
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  logger.info('Role permissions resynced', { changedRoles: changed.length });
  for (const c of changed) {
    logger.info(`  ${c.code}: +[${c.added.join(', ')}] -[${c.removed.join(', ')}]`);
  }
  return changed;
}

/** Busiest branch by appointment volume — the best available guess at "the main branch". */
async function busiestBranchId() {
  const [top] = await Appointment.aggregate([
    { $match: { deletedAt: null, branchId: { $ne: null } } },
    { $group: { _id: '$branchId', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  if (top?._id) return top._id;
  const branch = await Branch.findOne({ deletedAt: null }).sort({ createdAt: 1 }).select('_id');
  return branch?._id || null;
}

/** A doctor's own busiest branch, from their appointment history. */
async function branchForDoctorUser(userId) {
  const doctor = await Doctor.findOne({ userId, deletedAt: null }).select('_id');
  if (!doctor) return null;
  const [top] = await Appointment.aggregate([
    { $match: { deletedAt: null, doctorId: doctor._id, branchId: { $ne: null } } },
    { $group: { _id: '$branchId', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 1 },
  ]);
  return top?._id || null;
}

async function backfillBranches() {
  const fallback = await busiestBranchId();
  if (!fallback) {
    logger.error('No branch exists — create a branch before backfilling user branches');
    return { assigned: 0, skipped: 0 };
  }

  const users = await User.find({
    deletedAt: null,
    role: { $nin: GLOBAL_ROLES },
    $or: [{ branch: null }, { branch: { $exists: false } }],
  }).select('_id email role branch');

  let assigned = 0;
  for (const user of users) {
    const branchId = (await branchForDoctorUser(user._id)) || fallback;
    logger.info('Assigning branch', {
      email: user.email,
      role: user.role,
      branchId: branchId.toString(),
    });
    if (!DRY_RUN) {
      await User.updateOne({ _id: user._id }, { $set: { branch: branchId } });
    }
    assigned += 1;
  }

  const globals = await User.countDocuments({ deletedAt: null, role: { $in: GLOBAL_ROLES } });
  logger.info('Branch backfill complete', { assigned, globalRolesLeftUnscoped: globals });
  return { assigned, skipped: globals };
}

async function main() {
  await database.connect();
  logger.info(DRY_RUN ? 'SEC-030 remediation (DRY RUN)' : 'SEC-030 remediation');
  await resyncPermissionsAndRoles();
  await backfillBranches();
  logger.info('Done. Existing sessions must re-login for new role permissions to take effect.');
  await database.disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  logger.error('SEC-030 remediation failed', { error: error.message });
  process.exit(1);
});
