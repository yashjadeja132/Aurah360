import mongoose from 'mongoose';
import { QUEUE_PRIORITY_LIST, QUEUE_STATUS, QUEUE_STATUS_LIST } from '../enums/queue.js';

const queueEntrySchema = new mongoose.Schema(
  {
    tokenNumber: { type: String, required: true, trim: true, uppercase: true, index: true },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    queueDate: { type: Date, required: true, index: true },
    queueStatus: {
      type: String,
      enum: QUEUE_STATUS_LIST,
      default: QUEUE_STATUS.WAITING,
      index: true,
    },
    priority: {
      type: String,
      enum: QUEUE_PRIORITY_LIST,
      default: 'NORMAL',
      index: true,
    },
    priorityWeight: { type: Number, default: 6, index: true },
    sortOrder: { type: Number, default: 0, index: true },
    estimatedWaitTime: { type: Number, default: 0 },
    arrivalTime: { type: Date, default: () => new Date() },
    calledTime: { type: Date, default: null },
    startedTime: { type: Date, default: null },
    completedTime: { type: Date, default: null },
    isWalkIn: { type: Boolean, default: false },
    isLate: { type: Boolean, default: false },
    receptionNotes: { type: String, default: null },
    notes: { type: String, default: null },
    transferReason: { type: String, default: null },
    transferredFromDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'queue_entries',
  }
);

queueEntrySchema.index({ branchId: 1, queueDate: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index({ doctorId: 1, queueDate: 1, queueStatus: 1, priorityWeight: 1, sortOrder: 1 });
queueEntrySchema.index(
  { appointmentId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

queueEntrySchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    tokenNumber: this.tokenNumber,
    appointmentId: this.appointmentId?.toString?.() || this.appointmentId,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    branchId: this.branchId?.toString?.() || this.branchId,
    queueDate: this.queueDate,
    queueStatus: this.queueStatus,
    priority: this.priority,
    priorityWeight: this.priorityWeight,
    sortOrder: this.sortOrder,
    estimatedWaitTime: this.estimatedWaitTime,
    arrivalTime: this.arrivalTime,
    calledTime: this.calledTime,
    startedTime: this.startedTime,
    completedTime: this.completedTime,
    isWalkIn: this.isWalkIn,
    isLate: this.isLate,
    receptionNotes: this.receptionNotes,
    notes: this.notes,
    transferReason: this.transferReason,
    transferredFromDoctorId: this.transferredFromDoctorId
      ? this.transferredFromDoctorId.toString()
      : null,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);

export default QueueEntry;
