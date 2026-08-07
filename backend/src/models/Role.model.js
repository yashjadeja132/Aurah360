import mongoose from 'mongoose';
import { ROLE_LIST } from '../constants/roles.js';

const roleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      enum: ROLE_LIST,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'roles',
  }
);

roleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    description: this.description,
    permissions: this.permissions,
    isSystem: this.isSystem,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Role = mongoose.model('Role', roleSchema);

export default Role;
