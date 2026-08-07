import mongoose from 'mongoose';

const consultationDiagnosisSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      unique: true,
      index: true,
    },
    primaryDiagnosis: { type: String, default: null },
    secondaryDiagnoses: { type: [String], default: [] },
    clinicalNotes: { type: String, default: null },
    icd10Codes: { type: [String], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_diagnoses',
  }
);

consultationDiagnosisSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    primaryDiagnosis: this.primaryDiagnosis,
    secondaryDiagnoses: this.secondaryDiagnoses || [],
    clinicalNotes: this.clinicalNotes,
    icd10Codes: this.icd10Codes || [],
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationDiagnosis = mongoose.model('ConsultationDiagnosis', consultationDiagnosisSchema);

export default ConsultationDiagnosis;
