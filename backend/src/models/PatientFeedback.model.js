import mongoose from 'mongoose';

const patientFeedbackSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    doctorRating: { type: Number, min: 1, max: 5, default: null },
    clinicRating: { type: Number, min: 1, max: 5, required: true },
    /** Net Promoter Score, 0–10 (§14.2 Communications / retention reports). */
    npsScore: { type: Number, min: 0, max: 10, default: null },
    comments: { type: String, trim: true, default: null },
    suggestions: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['SUBMITTED', 'REVIEWED', 'ARCHIVED'],
      default: 'SUBMITTED',
      index: true,
    },
    /** §12.5 — complaint escalation is separate from a public-review request. */
    isComplaint: { type: Boolean, default: false, index: true },
    escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'patient_feedback',
  }
);

patientFeedbackSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    doctorId: this.doctorId ? this.doctorId.toString() : null,
    appointmentId: this.appointmentId ? this.appointmentId.toString() : null,
    doctorRating: this.doctorRating,
    clinicRating: this.clinicRating,
    npsScore: this.npsScore,
    comments: this.comments,
    suggestions: this.suggestions,
    status: this.status,
    isComplaint: this.isComplaint,
    escalatedTo: this.escalatedTo ? this.escalatedTo.toString() : null,
    escalatedAt: this.escalatedAt,
    resolutionNotes: this.resolutionNotes,
    resolvedAt: this.resolvedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const PatientFeedback = mongoose.model('PatientFeedback', patientFeedbackSchema);
export default PatientFeedback;
