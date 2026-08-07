import { LEAVE_STATUS } from '../enums/leave.js';

/**
 * Leave engine — reusable by Appointment module later.
 * Pure utilities; no DB access.
 */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Whether a date falls within an approved leave window.
 * branchId null on leave = all branches.
 */
export function isOnLeave(leaves = [], date, branchId = null) {
  const target = startOfDay(date).getTime();

  return leaves.some((leave) => {
    if (leave.deletedAt) return false;
    if (leave.status && leave.status !== LEAVE_STATUS.APPROVED) return false;

    if (
      branchId &&
      leave.branchId &&
      leave.branchId.toString() !== branchId.toString()
    ) {
      return false;
    }

    const from = startOfDay(leave.startDate).getTime();
    const to = endOfDay(leave.endDate).getTime();
    return target >= from && target <= to;
  });
}

/**
 * Find overlapping leave records (for validation).
 */
export function findOverlappingLeaves(leaves = [], startDate, endDate, { excludeId = null, branchId = null } = {}) {
  const from = startOfDay(startDate).getTime();
  const to = endOfDay(endDate).getTime();

  return leaves.filter((leave) => {
    if (excludeId && leave.id === excludeId) return false;
    if (leave._id && excludeId && leave._id.toString() === excludeId.toString()) return false;
    if (leave.deletedAt) return false;
    if (leave.status === LEAVE_STATUS.CANCELLED || leave.status === LEAVE_STATUS.REJECTED) {
      return false;
    }
    if (
      branchId &&
      leave.branchId &&
      leave.branchId.toString() !== branchId.toString()
    ) {
      return false;
    }

    const leaveFrom = startOfDay(leave.startDate).getTime();
    const leaveTo = endOfDay(leave.endDate).getTime();
    return from <= leaveTo && to >= leaveFrom;
  });
}

export default { isOnLeave, findOverlappingLeaves };
