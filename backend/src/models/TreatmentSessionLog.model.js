import mongoose from 'mongoose';

/**
 * Append-only session execution log entries.
 */
const treatmentSessionLogSchema = new mongoose.Schema(
  {
    treatmentSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentSession',
      required: true,
      index: true,
    },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    operatorName: { type: String, default: null },
    deviceUsed: { type: String, default: null },
    machineSettings: { type: mongoose.Schema.Types.Mixed, default: {} },
    consumables: { type: [String], default: [] },
    complications: { type: String, default: null },
    outcome: { type: String, default: null },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'treatment_session_logs',
  }
);

treatmentSessionLogSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    treatmentSessionId: this.treatmentSessionId.toString(),
    startTime: this.startTime,
    endTime: this.endTime,
    operatorId: this.operatorId ? this.operatorId.toString() : null,
    operatorName: this.operatorName,
    deviceUsed: this.deviceUsed,
    machineSettings: this.machineSettings || {},
    consumables: this.consumables || [],
    complications: this.complications,
    outcome: this.outcome,
    notes: this.notes,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const TreatmentSessionLog = mongoose.model('TreatmentSessionLog', treatmentSessionLogSchema);

export default TreatmentSessionLog;
