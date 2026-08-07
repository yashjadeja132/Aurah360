import mongoose from 'mongoose';
import { HANDOFF_CATEGORY_LIST, HANDOFF_URGENCY, HANDOFF_URGENCY_LIST } from '../enums/patient.js';

/** Reception → doctor structured handoff note (§5.3, PAT-006). Free text; amendment history kept. */
const amendmentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amendedAt: { type: Date, default: () => new Date() },
    reason: { type: String, default: null },
  },
  { _id: false }
);

const handoffNoteSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
    category: { type: String, enum: HANDOFF_CATEGORY_LIST, required: true },
    urgency: { type: String, enum: HANDOFF_URGENCY_LIST, default: HANDOFF_URGENCY.NORMAL, index: true },
    note: { type: String, required: true, maxlength: 2000 },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null, index: true },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    amendments: { type: [amendmentSchema], default: [] },
    /** Patient-facing app never sees this — visible to doctor/authorized clinical staff only. */
    releasedToPatient: { type: Boolean, default: false, immutable: true },
  },
  { timestamps: true, collection: 'handoff_notes' }
);

handoffNoteSchema.index({ patientId: 1, createdAt: -1 });
handoffNoteSchema.index({ assignedDoctorId: 1, acknowledgedAt: 1 });

handoffNoteSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    branchId: this.branchId.toString(),
    appointmentId: this.appointmentId ? this.appointmentId.toString() : null,
    category: this.category,
    urgency: this.urgency,
    note: this.note,
    authorId: this.authorId.toString(),
    assignedDoctorId: this.assignedDoctorId ? this.assignedDoctorId.toString() : null,
    acknowledgedBy: this.acknowledgedBy ? this.acknowledgedBy.toString() : null,
    acknowledgedAt: this.acknowledgedAt,
    resolutionNote: this.resolutionNote,
    resolvedAt: this.resolvedAt,
    amendments: this.amendments,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const HandoffNote = mongoose.model('HandoffNote', handoffNoteSchema);

export default HandoffNote;
