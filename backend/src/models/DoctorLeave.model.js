import mongoose from 'mongoose';
import { LEAVE_STATUS_LIST, LEAVE_TYPE_LIST, LEAVE_STATUS } from '../enums/leave.js';

const doctorLeaveSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    leaveType: {
      type: String,
      enum: LEAVE_TYPE_LIST,
      default: 'FULL_DAY',
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    reason: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: LEAVE_STATUS_LIST,
      default: LEAVE_STATUS.APPROVED,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'doctor_leaves',
  }
);

doctorLeaveSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    branchId: this.branchId ? this.branchId.toString() : null,
    leaveType: this.leaveType,
    startDate: this.startDate,
    endDate: this.endDate,
    reason: this.reason,
    status: this.status,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const DoctorLeave = mongoose.model('DoctorLeave', doctorLeaveSchema);

export default DoctorLeave;
