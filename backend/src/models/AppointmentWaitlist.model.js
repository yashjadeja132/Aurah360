import mongoose from 'mongoose';
import { WAITLIST_STATUS, WAITLIST_STATUS_LIST } from '../enums/appointment.js';

/** Waitlist entry when the requested slot has no capacity (APT-006). */
const waitlistSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', default: null },
    preferredDate: { type: Date, required: true },
    preferredWindowStart: { type: String, default: null },
    preferredWindowEnd: { type: String, default: null },
    status: { type: String, enum: WAITLIST_STATUS_LIST, default: WAITLIST_STATUS.WAITING, index: true },
    offeredSlot: {
      type: new mongoose.Schema(
        { appointmentDate: Date, startTime: String, endTime: String },
        { _id: false }
      ),
      default: null,
    },
    offeredAt: { type: Date, default: null },
    offerExpiresAt: { type: Date, default: null },
    resultingAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'appointment_waitlist' }
);

waitlistSchema.index({ doctorId: 1, preferredDate: 1, status: 1 });

waitlistSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    doctorId: this.doctorId.toString(),
    branchId: this.branchId.toString(),
    serviceId: this.serviceId ? this.serviceId.toString() : null,
    preferredDate: this.preferredDate,
    preferredWindowStart: this.preferredWindowStart,
    preferredWindowEnd: this.preferredWindowEnd,
    status: this.status,
    offeredSlot: this.offeredSlot,
    offeredAt: this.offeredAt,
    offerExpiresAt: this.offerExpiresAt,
    resultingAppointmentId: this.resultingAppointmentId ? this.resultingAppointmentId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const AppointmentWaitlist = mongoose.model('AppointmentWaitlist', waitlistSchema);

export default AppointmentWaitlist;
