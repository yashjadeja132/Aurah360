import mongoose from 'mongoose';

/**
 * Temporary one-day schedule override for a doctor at a branch.
 */
const doctorSpecialScheduleSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    isWorking: { type: Boolean, default: true },
    startTime: { type: String, default: '10:00' },
    endTime: { type: String, default: '19:00' },
    lunchStart: { type: String, default: null },
    lunchEnd: { type: String, default: null },
    slotDuration: { type: Number, min: 5, max: 240, default: 15 },
    bufferTime: { type: Number, min: 0, max: 120, default: 5 },
    maximumAppointments: { type: Number, min: 0, default: 0 },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'doctor_special_schedules',
  }
);

doctorSpecialScheduleSchema.index({ doctorId: 1, branchId: 1, date: 1 }, { unique: true });

doctorSpecialScheduleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    branchId: this.branchId.toString(),
    date: this.date,
    isWorking: this.isWorking,
    startTime: this.startTime,
    endTime: this.endTime,
    lunchStart: this.lunchStart,
    lunchEnd: this.lunchEnd,
    slotDuration: this.slotDuration,
    bufferTime: this.bufferTime,
    maximumAppointments: this.maximumAppointments,
    notes: this.notes,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const DoctorSpecialSchedule = mongoose.model(
  'DoctorSpecialSchedule',
  doctorSpecialScheduleSchema
);

export default DoctorSpecialSchedule;
