import mongoose from 'mongoose';
import { PATCH_TEST_RESULT, PATCH_TEST_RESULT_LIST } from '../enums/treatmentSession.js';

/** Patch test record — setting/product, area, reaction, reviewer, validity (§10.3, TRT-006). */
const patchTestSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    treatmentPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreatmentPlan', default: null, index: true },
    protocolId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreatmentProtocol', default: null },
    productOrSetting: { type: String, required: true, trim: true },
    testArea: { type: String, required: true, trim: true },
    testedAt: { type: Date, default: () => new Date() },
    reviewDueAt: { type: Date, required: true },
    result: { type: String, enum: PATCH_TEST_RESULT_LIST, default: PATCH_TEST_RESULT.PENDING, index: true },
    reactionNotes: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    /** How long this negative result remains valid for reuse before a fresh test is required. */
    validUntil: { type: Date, default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'patch_tests' }
);

patchTestSchema.methods.isValidNow = function isValidNow() {
  return this.result === PATCH_TEST_RESULT.NEGATIVE && (!this.validUntil || this.validUntil.getTime() > Date.now());
};

patchTestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    treatmentPlanId: this.treatmentPlanId ? this.treatmentPlanId.toString() : null,
    protocolId: this.protocolId ? this.protocolId.toString() : null,
    productOrSetting: this.productOrSetting,
    testArea: this.testArea,
    testedAt: this.testedAt,
    reviewDueAt: this.reviewDueAt,
    result: this.result,
    reactionNotes: this.reactionNotes,
    reviewedBy: this.reviewedBy ? this.reviewedBy.toString() : null,
    reviewedAt: this.reviewedAt,
    validUntil: this.validUntil,
    isValidNow: this.isValidNow(),
    performedBy: this.performedBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const PatchTest = mongoose.model('PatchTest', patchTestSchema);

export default PatchTest;
