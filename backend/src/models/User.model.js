import mongoose from 'mongoose';
import { ROLES, ROLE_LIST } from '../constants/roles.js';
import { USER_STATUS, USER_STATUS_LIST } from '../enums/userStatus.js';
import { GENDER_LIST } from '../enums/gender.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_LIST,
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    /** Optional per-user permission overrides (union with role permissions) */
    permissions: {
      type: [String],
      default: [],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    designation: {
      type: String,
      trim: true,
      default: null,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: GENDER_LIST,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: USER_STATUS_LIST,
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    /** Staff MFA (SEC-002) */
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, default: null, select: false },
    mfaPendingSecret: { type: String, default: null, select: false },
    mfaBackupCodes: { type: [String], default: [], select: false },
    mfaEnabledAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

userSchema.index({ firstName: 'text', lastName: 'text', email: 'text', employeeId: 'text' });
userSchema.index({ role: 1, isActive: 1, deletedAt: 1 });

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: `${this.firstName} ${this.lastName}`.trim(),
    email: this.email,
    phone: this.phone,
    role: this.role,
    roleId: this.roleId ? this.roleId.toString() : null,
    permissions: this.permissions || [],
    branch: this.branch ? this.branch.toString() : null,
    department: this.department,
    designation: this.designation,
    employeeId: this.employeeId,
    profileImage: this.profileImage,
    gender: this.gender,
    dob: this.dob,
    status: this.status,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    mustChangePassword: this.mustChangePassword,
    mfaEnabled: this.mfaEnabled,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

userSchema.statics.isOwnerRole = function isOwnerRole(role) {
  return role === ROLES.OWNER;
};

const User = mongoose.model('User', userSchema);

export default User;
