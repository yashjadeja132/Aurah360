import mongoose from 'mongoose';
import { ROOM_TYPE_LIST, RESOURCE_STATUS, RESOURCE_STATUS_LIST } from '../enums/resource.js';

/** Branch room resource — consultation/procedure/photo/recovery (§4.3). */
const roomSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, enum: ROOM_TYPE_LIST, default: 'CONSULTATION' },
    capacity: { type: Number, default: 1, min: 1 },
    cleaningBufferMinutes: { type: Number, default: 5, min: 0 },
    status: { type: String, enum: RESOURCE_STATUS_LIST, default: RESOURCE_STATUS.AVAILABLE, index: true },
    statusReason: { type: String, default: null },
    statusUpdatedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'rooms' }
);

roomSchema.index({ branchId: 1, code: 1 }, { unique: true });

roomSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    branchId: this.branchId.toString(),
    name: this.name,
    code: this.code,
    type: this.type,
    capacity: this.capacity,
    cleaningBufferMinutes: this.cleaningBufferMinutes,
    status: this.status,
    statusReason: this.statusReason,
    statusUpdatedAt: this.statusUpdatedAt,
    isActive: this.isActive,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Room = mongoose.model('Room', roomSchema);

export default Room;
