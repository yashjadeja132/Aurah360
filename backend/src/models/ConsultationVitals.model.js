import mongoose from 'mongoose';

const consultationVitalsSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      unique: true,
      index: true,
    },
    heightCm: { type: Number, default: null },
    weightKg: { type: Number, default: null },
    bmi: { type: Number, default: null },
    temperatureC: { type: Number, default: null },
    pulseBpm: { type: Number, default: null },
    bloodPressureSystolic: { type: Number, default: null },
    bloodPressureDiastolic: { type: Number, default: null },
    respirationRpm: { type: Number, default: null },
    oxygenSaturation: { type: Number, default: null },
    painScale: { type: Number, min: 0, max: 10, default: null },
    notes: { type: String, default: null },
    recordedAt: { type: Date, default: () => new Date() },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_vitals',
  }
);

consultationVitalsSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    heightCm: this.heightCm,
    weightKg: this.weightKg,
    bmi: this.bmi,
    temperatureC: this.temperatureC,
    pulseBpm: this.pulseBpm,
    bloodPressureSystolic: this.bloodPressureSystolic,
    bloodPressureDiastolic: this.bloodPressureDiastolic,
    respirationRpm: this.respirationRpm,
    oxygenSaturation: this.oxygenSaturation,
    painScale: this.painScale,
    notes: this.notes,
    recordedAt: this.recordedAt,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationVitals = mongoose.model('ConsultationVitals', consultationVitalsSchema);

export default ConsultationVitals;
