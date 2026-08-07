import mongoose from 'mongoose';

const RECALL_STATUS = [
  'PENDING',
  'BOOKED',
  'CALL_LATER',
  'NOT_INTERESTED',
  'UNREACHABLE',
  'WRONG_NUMBER',
  'OPTED_OUT',
];

/** Missed follow-up recall worklist — call desk works this queue (§12.1, CRM-001). */
const recallEntrySchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    preferredDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    dueDate: { type: Date, required: true, index: true },
    purpose: { type: String, default: null },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: RECALL_STATUS, default: 'PENDING', index: true },
    callAttempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    outcomeNotes: { type: String, default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resultingAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'recall_entries' }
);

/** Dedup key for automated scans (e.g. missedFollowUpJobs.js) — at most one recall entry
 *  per consultation+purpose combination, so a repeat scan never double-creates. Only
 *  enforced when consultationId is set; manually-created entries with no consultationId
 *  are unaffected. */
recallEntrySchema.index(
  { consultationId: 1, purpose: 1 },
  { unique: true, partialFilterExpression: { consultationId: { $type: 'objectId' } } }
);

recallEntrySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    consultationId: this.consultationId ? this.consultationId.toString() : null,
    branchId: this.branchId ? this.branchId.toString() : null,
    preferredDoctorId: this.preferredDoctorId ? this.preferredDoctorId.toString() : null,
    dueDate: this.dueDate,
    purpose: this.purpose,
    priority: this.priority,
    status: this.status,
    callAttempts: this.callAttempts,
    lastAttemptAt: this.lastAttemptAt,
    outcomeNotes: this.outcomeNotes,
    assignedTo: this.assignedTo ? this.assignedTo.toString() : null,
    resultingAppointmentId: this.resultingAppointmentId ? this.resultingAppointmentId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const RECALL_STATUS_LIST = RECALL_STATUS;
const RecallEntry = mongoose.model('RecallEntry', recallEntrySchema);
export default RecallEntry;
