import mongoose from 'mongoose';

/**
 * Effective-dated fee override for a service — branch/doctor-specific price that beats
 * the Master default when active (BIL-001, §11.3). Absence of a row means "use Master price".
 */
const feeScheduleSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null, index: true },
    price: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: null, min: 0, max: 100 },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'fee_schedules' }
);

feeScheduleSchema.index({ serviceId: 1, branchId: 1, doctorId: 1, effectiveFrom: -1 });

feeScheduleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    serviceId: this.serviceId.toString(),
    branchId: this.branchId ? this.branchId.toString() : null,
    doctorId: this.doctorId ? this.doctorId.toString() : null,
    price: this.price,
    taxPercent: this.taxPercent,
    effectiveFrom: this.effectiveFrom,
    effectiveTo: this.effectiveTo,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

const FeeSchedule = mongoose.model('FeeSchedule', feeScheduleSchema);

export default FeeSchedule;
