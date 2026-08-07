import mongoose from 'mongoose';

const soapVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
    savedAt: { type: Date, default: () => new Date() },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const consultationSoapSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      unique: true,
      index: true,
    },
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
    currentVersion: { type: Number, default: 1 },
    isDraft: { type: Boolean, default: true },
    lastAutosavedAt: { type: Date, default: null },
    versions: { type: [soapVersionSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_soaps',
  }
);

consultationSoapSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    subjective: this.subjective,
    objective: this.objective,
    assessment: this.assessment,
    plan: this.plan,
    currentVersion: this.currentVersion,
    isDraft: this.isDraft,
    lastAutosavedAt: this.lastAutosavedAt,
    versions: (this.versions || []).map((v) => ({
      version: v.version,
      subjective: v.subjective,
      objective: v.objective,
      assessment: v.assessment,
      plan: v.plan,
      savedAt: v.savedAt,
      savedBy: v.savedBy ? v.savedBy.toString() : null,
    })),
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationSoap = mongoose.model('ConsultationSoap', consultationSoapSchema);

export default ConsultationSoap;
