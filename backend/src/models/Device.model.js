import mongoose from 'mongoose';
import {
  DEVICE_CAPABILITY_LIST,
  RESOURCE_STATUS,
  RESOURCE_STATUS_LIST,
} from '../enums/resource.js';

/** Branch device resource — laser/procedure/imaging equipment (§4.3, TRT-003). */
const deviceSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    serialNumber: { type: String, default: null, trim: true },
    capability: { type: String, enum: DEVICE_CAPABILITY_LIST, default: 'OTHER' },
    /** Free-form capability tags used to match protocol.deviceRequired to a specific unit. */
    tags: { type: [String], default: [] },
    status: { type: String, enum: RESOURCE_STATUS_LIST, default: RESOURCE_STATUS.AVAILABLE, index: true },
    statusReason: { type: String, default: null },
    statusUpdatedAt: { type: Date, default: null },
    lastMaintenanceAt: { type: Date, default: null },
    nextMaintenanceDueAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'devices' }
);

deviceSchema.index({ branchId: 1, code: 1 }, { unique: true });

deviceSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    branchId: this.branchId.toString(),
    name: this.name,
    code: this.code,
    serialNumber: this.serialNumber,
    capability: this.capability,
    tags: this.tags,
    status: this.status,
    statusReason: this.statusReason,
    statusUpdatedAt: this.statusUpdatedAt,
    lastMaintenanceAt: this.lastMaintenanceAt,
    nextMaintenanceDueAt: this.nextMaintenanceDueAt,
    isActive: this.isActive,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Device = mongoose.model('Device', deviceSchema);

export default Device;
