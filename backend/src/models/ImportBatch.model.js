import mongoose from 'mongoose';
import { IMPORT_BATCH_STATUS_LIST } from '../enums/patient.js';

/** Migration/import batch header (PAT-008, §19.5) — every imported row references this. */
const importBatchSchema = new mongoose.Schema(
  {
    sourceSystem: { type: String, required: true, trim: true },
    status: { type: String, enum: IMPORT_BATCH_STATUS_LIST, default: 'DRY_RUN', index: true },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    errorRows: { type: Number, default: 0 },
    duplicateCandidates: { type: Number, default: 0 },
    committedRows: { type: Number, default: 0 },
    /** Named rowErrors, not errors — `errors` collides with Mongoose's reserved document API. */
    rowErrors: { type: [{ row: Number, message: String }], default: [] },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: () => new Date() },
    committedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'import_batches' }
);

importBatchSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    sourceSystem: this.sourceSystem,
    status: this.status,
    totalRows: this.totalRows,
    validRows: this.validRows,
    errorRows: this.errorRows,
    duplicateCandidates: this.duplicateCandidates,
    committedRows: this.committedRows,
    rowErrors: this.rowErrors,
    startedAt: this.startedAt,
    committedAt: this.committedAt,
    createdAt: this.createdAt,
  };
};

const ImportBatch = mongoose.model('ImportBatch', importBatchSchema);

export default ImportBatch;
