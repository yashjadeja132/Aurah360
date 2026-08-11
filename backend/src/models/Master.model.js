import mongoose from 'mongoose';
import { MASTER_TYPE_LIST } from '../constants/masterTypes.js';
import { ENTITY_STATUS } from '../constants/index.js';

/**
 * Polymorphic master catalog — one collection, filtered by `type`.
 * Service-specific fields are optional and only used when type === SERVICE.
 */
const masterSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: MASTER_TYPE_LIST,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    /** SERVICE only — refs SERVICE_CATEGORY master */
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
      min: 1,
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
    /** Optional UI hint (e.g. appointment status color) */
    color: {
      type: String,
      default: null,
    },
    /** Optional effective-dating window. Both nullable — omitted means "always effective". */
    effectiveFrom: {
      type: Date,
      default: null,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
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
  },
  {
    timestamps: true,
    collection: 'masters',
  }
);

masterSchema.index(
  { type: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    collation: { locale: 'en', strength: 2 },
  }
);

masterSchema.index(
  { type: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null, code: { $type: 'string' } },
  }
);

masterSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    type: this.type,
    name: this.name,
    code: this.code,
    description: this.description,
    sortOrder: this.sortOrder,
    categoryId: this.categoryId ? this.categoryId.toString() : null,
    durationMinutes: this.durationMinutes,
    price: this.price,
    color: this.color,
    effectiveFrom: this.effectiveFrom,
    effectiveTo: this.effectiveTo,
    metadata: this.metadata,
    status: this.status,
    isActive: this.isActive,
    isSystem: this.isSystem,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Master = mongoose.model('Master', masterSchema);

export default Master;
