import mongoose from 'mongoose';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LIST,
  APPOINTMENT_TYPE_LIST,
  APPOINTMENT_SOURCE_LIST,
  APPOINTMENT_PRIORITY_LIST,
  CANCELLATION_REASON_LIST,
  SLOT_COMMITTED_STATUSES,
} from '../enums/appointment.js';

const resourceAllocationSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, default: null },
    deviceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const recurringPlaceholderSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, default: null },
    interval: { type: Number, default: null },
    endDate: { type: Date, default: null },
    seriesId: { type: String, default: null },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
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
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      required: true,
    },
    appointmentDate: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, min: 1, default: 15 },
    status: {
      type: String,
      enum: APPOINTMENT_STATUS_LIST,
      default: APPOINTMENT_STATUS.SCHEDULED,
      index: true,
    },
    appointmentType: {
      type: String,
      enum: APPOINTMENT_TYPE_LIST,
      default: 'CONSULTATION',
    },
    source: {
      type: String,
      enum: APPOINTMENT_SOURCE_LIST,
      default: 'WALK_IN',
    },
    priority: {
      type: String,
      enum: APPOINTMENT_PRIORITY_LIST,
      default: 'NORMAL',
    },
    notes: { type: String, default: null },
    reasonForVisit: { type: String, default: null },
    resourceAllocation: {
      type: resourceAllocationSchema,
      default: () => ({}),
    },
    roomId: { type: mongoose.Schema.Types.ObjectId, default: null },
    deviceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parentAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    rescheduledFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    recurring: {
      type: recurringPlaceholderSchema,
      default: () => ({ enabled: false }),
    },
    /** A13 — controlled cancellation reason; `cancellationReason` holds the free-text note. */
    cancellationReasonCode: {
      type: String,
      enum: [...CANCELLATION_REASON_LIST, null],
      default: null,
    },
    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    /** Appointment reminder dedup — set once a reminder scan has dispatched it, to prevent
     *  duplicate sends on subsequent repeatable-job runs (see queues/appointmentReminderJobs.js). */
    reminder24hSentAt: { type: Date, default: null },
    reminderSameDaySentAt: { type: Date, default: null },
    /** APT-008 — client-supplied idempotency key prevents duplicate booking on retry. */
    /** No `default` — must stay genuinely absent (not `null`) for the sparse unique index below
     *  to only apply to appointments that actually supplied a key (APT-008). */
    idempotencyKey: { type: String, sparse: true, unique: true },
    /** APT-003 — approval workflow for patient-proposed / custom slots. */
    requiresApproval: { type: Boolean, default: false },
    approvalDecision: { type: String, enum: ['ACCEPTED', 'ALTERNATIVE_PROPOSED', 'REJECTED', null], default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    proposedAlternative: {
      type: new mongoose.Schema(
        { appointmentDate: Date, startTime: String, endTime: String },
        { _id: false }
      ),
      default: null,
    },
    /** Optimistic-lock guard — incremented on every resource-affecting update (NFR-004). */
    version: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'appointments',
  }
);

/** Read path: doctor day-calendar lookups over ALL statuses — the unique index below is partial
 *  and therefore unusable by those queries, so this stays. */
appointmentSchema.index({ doctorId: 1, appointmentDate: 1, startTime: 1 });

/**
 * §2.4 "zero system-permitted double-booking" / NFR-004 — the DATABASE is what prevents the
 * double booking. AppointmentService reads to detect a clash and then inserts; between those two
 * statements a second request can do exactly the same and both inserts succeed. Only a constraint
 * the storage engine evaluates at write time is race-proof.
 *
 * CATCHES: two capacity-consuming appointments for the same doctor, same day, starting at the same
 * minute. That is the shape virtually every real double-booking takes, because slots are offered
 * from a generated grid, so both receptionists click the same grid start.
 *
 * DOES NOT CATCH: partial overlaps (10:00–10:30 vs 10:15–10:45). Interval overlap is not an
 * equality predicate and no B-tree unique key can express it. Those are serialized in
 * AppointmentService via a per-doctor-day mutex inside a transaction — see #withSlotClaim.
 *
 * The partial filter is what keeps it from over-constraining: cancelled / no-show / rescheduled /
 * pending-approval / soft-deleted rows are not in the index, so the minute they vacate is
 * immediately rebookable and a patient may still PROPOSE a taken slot (APT-003).
 */
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, startTime: 1 },
  {
    unique: true,
    name: 'uniq_doctor_committed_slot',
    partialFilterExpression: {
      deletedAt: null,
      status: { $in: [...SLOT_COMMITTED_STATUSES] },
    },
  }
);

appointmentSchema.index({ patientId: 1, appointmentDate: 1 });
appointmentSchema.index({ branchId: 1, appointmentDate: 1 });

appointmentSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    appointmentNumber: this.appointmentNumber,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    branchId: this.branchId?.toString?.() || this.branchId,
    departmentId: this.departmentId ? this.departmentId.toString() : null,
    serviceId: this.serviceId?.toString?.() || this.serviceId,
    appointmentDate: this.appointmentDate,
    startTime: this.startTime,
    endTime: this.endTime,
    duration: this.duration,
    status: this.status,
    appointmentType: this.appointmentType,
    source: this.source,
    priority: this.priority,
    notes: this.notes,
    reasonForVisit: this.reasonForVisit,
    resourceAllocation: this.resourceAllocation,
    roomId: this.roomId ? this.roomId.toString() : null,
    deviceId: this.deviceId ? this.deviceId.toString() : null,
    technicianId: this.technicianId ? this.technicianId.toString() : null,
    parentAppointmentId: this.parentAppointmentId
      ? this.parentAppointmentId.toString()
      : null,
    rescheduledFromId: this.rescheduledFromId
      ? this.rescheduledFromId.toString()
      : null,
    recurring: this.recurring,
    cancellationReasonCode: this.cancellationReasonCode,
    cancellationReason: this.cancellationReason,
    cancelledAt: this.cancelledAt,
    completedAt: this.completedAt,
    requiresApproval: this.requiresApproval,
    approvalDecision: this.approvalDecision,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    proposedAlternative: this.proposedAlternative,
    version: this.version,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    reminder24hSentAt: this.reminder24hSentAt,
    reminderSameDaySentAt: this.reminderSameDaySentAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
