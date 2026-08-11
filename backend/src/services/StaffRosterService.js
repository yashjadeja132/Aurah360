import User from '../models/User.model.js';
import Doctor from '../models/Doctor.model.js';
import DoctorLeaveService from './DoctorLeaveService.js';
import StaffLeaveService from './StaffLeaveService.js';
import { ROLES } from '../constants/roles.js';

/**
 * Branch Manager staff roster board — "Sidebar → Staff/Rosters → View today's roster (doctors,
 * nurses, technicians, pharmacy, reception, cashier) → Staff absent/late → Mark leave/blocked".
 *
 * Read-only aggregation over `User` (already branch + role + active status scoped) grouped by
 * role, cross-referenced against today's leave for each staff member — DoctorLeaveService for
 * DOCTOR rows (so the existing roster-impact/reassign flow keeps working unchanged), and the new
 * StaffLeaveService for everyone else.
 */
class StaffRosterService {
  constructor() {
    this.doctorLeaveService = new DoctorLeaveService();
    this.staffLeaveService = new StaffLeaveService();
  }

  async today(branchId, date = new Date()) {
    const filter = { deletedAt: null, isActive: true };
    if (branchId) filter.branch = branchId;

    const users = await User.find(filter).select('firstName lastName role branch email employeeId').lean();

    const doctorUserIds = users.filter((u) => u.role === ROLES.DOCTOR).map((u) => u._id);
    const doctors = doctorUserIds.length
      ? await Doctor.find({ userId: { $in: doctorUserIds }, deletedAt: null }).select('userId').lean()
      : [];
    const doctorIdByUserId = new Map(doctors.map((d) => [d.userId.toString(), d._id.toString()]));

    const nonDoctorUserIds = users.filter((u) => u.role !== ROLES.DOCTOR).map((u) => u._id);
    const activeStaffLeaves = await this.staffLeaveService.findActiveOn(nonDoctorUserIds, date);
    const staffLeaveByUserId = new Map(activeStaffLeaves.map((l) => [l.userId, l]));

    const rows = [];
    for (const u of users) {
      const userId = u._id.toString();
      let onLeave = false;
      let leaveReason = null;
      let doctorId = null;

      if (u.role === ROLES.DOCTOR) {
        doctorId = doctorIdByUserId.get(userId) || null;
        if (doctorId) {
          const leaveCheck = await this.doctorLeaveService.checkOnLeave(doctorId, date, branchId);
          onLeave = Boolean(leaveCheck);
        }
      } else {
        const leave = staffLeaveByUserId.get(userId);
        if (leave) {
          onLeave = true;
          leaveReason = leave.reason;
        }
      }

      rows.push({
        userId,
        doctorId,
        fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        role: u.role,
        branchId: u.branch ? u.branch.toString() : null,
        email: u.email,
        employeeId: u.employeeId || null,
        onLeaveToday: onLeave,
        leaveReason,
      });
    }

    const byRole = {};
    for (const row of rows) {
      if (!byRole[row.role]) byRole[row.role] = [];
      byRole[row.role].push(row);
    }

    return {
      date,
      total: rows.length,
      onLeaveCount: rows.filter((r) => r.onLeaveToday).length,
      byRole,
    };
  }
}

export default StaffRosterService;
