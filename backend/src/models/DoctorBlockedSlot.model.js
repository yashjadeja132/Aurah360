import mongoose from 'mongoose';
import { BLOCKED_SLOT_REASON_LIST } from '../enums/scheduling.js';

const doctorBlockedSlotSchema = new mongoose.Schema(
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
    title: { type: String, required: true, trim: true },
    reason: {
      type: String,
      enum: BLOCKED_SLOT_REASON_LIST,
      default: 'OTHER',
    },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    description: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'doctor_blocked_slots',
  }
);

doctorBlockedSlotSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    branchId: this.branchId ? this.branchId.toString() : null,
    title: this.title,
    reason: this.reason,
    startAt: this.startAt,
    endAt: this.endAt,
    description: this.description,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const DoctorBlockedSlot = mongoose.model('DoctorBlockedSlot', doctorBlockedSlotSchema);

export default DoctorBlockedSlot;
