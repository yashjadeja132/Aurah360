import mongoose from 'mongoose';

const doctorScheduleSchema = new mongoose.Schema(
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
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    startTime: { type: String, required: true, default: '10:00' },
    endTime: { type: String, required: true, default: '19:00' },
    lunchStart: { type: String, default: '13:00' },
    lunchEnd: { type: String, default: '14:00' },
    slotDuration: { type: Number, min: 5, max: 240, default: 15 },
    bufferTime: { type: Number, min: 0, max: 120, default: 5 },
    maximumAppointments: { type: Number, min: 0, default: 0 },
    isWorking: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'doctor_schedules',
  }
);

doctorScheduleSchema.index(
  { doctorId: 1, branchId: 1, dayOfWeek: 1 },
  { unique: true }
);

doctorScheduleSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    branchId: this.branchId.toString(),
    dayOfWeek: this.dayOfWeek,
    startTime: this.startTime,
    endTime: this.endTime,
    lunchStart: this.lunchStart,
    lunchEnd: this.lunchEnd,
    slotDuration: this.slotDuration,
    bufferTime: this.bufferTime,
    maximumAppointments: this.maximumAppointments,
    isWorking: this.isWorking,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);

export default DoctorSchedule;
