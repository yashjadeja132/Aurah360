import mongoose from 'mongoose';

/** Lab/report order — structured object linked to a consultation (EMR-004). */
const LAB_ORDER_STATUS = ['ORDERED', 'RESULT_RECEIVED', 'REVIEWED', 'CANCELLED'];

const labOrderSchema = new mongoose.Schema(
  {
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    testName: { type: String, required: true, trim: true },
    reason: { type: String, default: null },
    dueDate: { type: Date, default: null },
    provider: { type: String, default: null },
    status: { type: String, enum: LAB_ORDER_STATUS, default: 'ORDERED', index: true },
    resultDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientDocument', default: null },
    resultReceivedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: null },
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'lab_orders' }
);

labOrderSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    patientId: this.patientId.toString(),
    testName: this.testName,
    reason: this.reason,
    dueDate: this.dueDate,
    provider: this.provider,
    status: this.status,
    resultDocumentId: this.resultDocumentId ? this.resultDocumentId.toString() : null,
    resultReceivedAt: this.resultReceivedAt,
    reviewedBy: this.reviewedBy ? this.reviewedBy.toString() : null,
    reviewedAt: this.reviewedAt,
    reviewComment: this.reviewComment,
    orderedBy: this.orderedBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const LAB_ORDER_STATUS_LIST = LAB_ORDER_STATUS;
const LabOrder = mongoose.model('LabOrder', labOrderSchema);
export default LabOrder;
