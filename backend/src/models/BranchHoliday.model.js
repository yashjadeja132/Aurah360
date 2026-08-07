import mongoose from 'mongoose';

const branchHolidaySchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    holidayName: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    isRecurring: { type: Boolean, default: false },
    description: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'branch_holidays',
  }
);

branchHolidaySchema.index({ branchId: 1, date: 1 });

branchHolidaySchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    branchId: this.branchId.toString(),
    holidayName: this.holidayName,
    date: this.date,
    isRecurring: this.isRecurring,
    description: this.description,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const BranchHoliday = mongoose.model('BranchHoliday', branchHolidaySchema);

export default BranchHoliday;
