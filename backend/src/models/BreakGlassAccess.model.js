import mongoose from 'mongoose';

/** Break-glass access — reason, recent MFA/step-up, short expiry, prominent audit (§3.1). */
const breakGlassAccessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: null },
    reason: { type: String, required: true },
    grantedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'break_glass_access' }
);

breakGlassAccessSchema.methods.isValidNow = function isValidNow() {
  return this.expiresAt.getTime() > Date.now();
};

breakGlassAccessSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    patientId: this.patientId ? this.patientId.toString() : null,
    resourceType: this.resourceType,
    resourceId: this.resourceId,
    reason: this.reason,
    grantedAt: this.grantedAt,
    expiresAt: this.expiresAt,
    usedAt: this.usedAt,
    isValidNow: this.isValidNow(),
    createdAt: this.createdAt,
  };
};

const BreakGlassAccess = mongoose.model('BreakGlassAccess', breakGlassAccessSchema);

export default BreakGlassAccess;
