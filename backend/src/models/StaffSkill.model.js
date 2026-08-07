import mongoose from 'mongoose';
import { SKILL_STATUS, SKILL_STATUS_LIST } from '../enums/resource.js';

/** Who may perform/assist a protocol — role, credential, supervision, branch, expiry (§4.3). */
const staffSkillSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    skillCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    credentialRef: { type: String, default: null },
    requiresSupervision: { type: Boolean, default: false },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    grantedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: SKILL_STATUS_LIST, default: SKILL_STATUS.ACTIVE, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'staff_skills' }
);

staffSkillSchema.index({ userId: 1, skillCode: 1, branchId: 1 }, { unique: true });

staffSkillSchema.methods.isValidNow = function isValidNow() {
  if (this.status !== SKILL_STATUS.ACTIVE) return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
};

staffSkillSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    userId: this.userId.toString(),
    branchId: this.branchId ? this.branchId.toString() : null,
    skillCode: this.skillCode,
    name: this.name,
    credentialRef: this.credentialRef,
    requiresSupervision: this.requiresSupervision,
    supervisorId: this.supervisorId ? this.supervisorId.toString() : null,
    grantedAt: this.grantedAt,
    expiresAt: this.expiresAt,
    status: this.status,
    isValidNow: this.isValidNow(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const StaffSkill = mongoose.model('StaffSkill', staffSkillSchema);

export default StaffSkill;
