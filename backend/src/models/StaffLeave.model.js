import mongoose from 'mongoose';
import { LEAVE_STATUS_LIST, LEAVE_TYPE_LIST, LEAVE_STATUS } from '../enums/leave.js';

/**
 * Generic staff leave/absence — nurses, technicians, pharmacy, reception, cashier and any
 * other non-doctor role. DOCTOR leave stays on the existing `DoctorLeave` model/flow (which is
 * deeply coupled to the doctor-specific roster-impact/appointment-reassignment logic in
 * `DoctorLeaveService`); this is a deliberate parallel model rather than a generalisation of
 * DoctorLeave, because a non-doctor absence does not cascade into appointment conflicts the
 * same way and forcing the reassign/reschedule UX onto it would be the wrong shape.
 */
const staffLeaveSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    leaveType: { type: String, enum: LEAVE_TYPE_LIST, default: 'FULL_DAY' },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    reason: { type: String, trim: true, required: true },
    status: { type: String, enum: LEAVE_STATUS_LIST, default: LEAVE_STATUS.APPROVED, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'staff_leaves' }
);

staffLeaveSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    role: this.role,
    branchId: this.branchId ? this.branchId.toString() : null,
    leaveType: this.leaveType,
    startDate: this.startDate,
    endDate: this.endDate,
    reason: this.reason,
    status: this.status,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const StaffLeave = mongoose.model('StaffLeave', staffLeaveSchema);

export default StaffLeave;
