import mongoose from 'mongoose';

const consultationExaminationSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      unique: true,
      index: true,
    },
    generalExamination: { type: String, default: '' },
    skinExamination: { type: String, default: '' },
    hairExamination: { type: String, default: '' },
    scalpExamination: { type: String, default: '' },
    laserAssessment: { type: String, default: '' },
    clinicalFindings: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_examinations',
  }
);

consultationExaminationSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    generalExamination: this.generalExamination,
    skinExamination: this.skinExamination,
    hairExamination: this.hairExamination,
    scalpExamination: this.scalpExamination,
    laserAssessment: this.laserAssessment,
    clinicalFindings: this.clinicalFindings,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationExamination = mongoose.model(
  'ConsultationExamination',
  consultationExaminationSchema
);

export default ConsultationExamination;
