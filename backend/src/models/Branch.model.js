import mongoose from 'mongoose';
import { ENTITY_STATUS } from '../constants/index.js';

const dayScheduleSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true }, // 0=Sun
    isClosed: { type: Boolean, default: false },
    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '19:00' },
  },
  { _id: false }
);

const lunchBreakSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    startTime: { type: String, default: '13:00' },
    endTime: { type: String, default: '14:00' },
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    name: { type: String, required: true, trim: true },
    isRecurring: { type: Boolean, default: false },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    email: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const branchSettingsSchema = new mongoose.Schema(
  {
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    weeklySchedule: { type: [dayScheduleSchema], default: [] },
    lunchBreak: { type: lunchBreakSchema, default: () => ({}) },
    timeSlotDurationMinutes: { type: Number, default: 15, min: 5, max: 240 },
    appointmentBufferMinutes: { type: Number, default: 5, min: 0, max: 120 },
    holidayCalendar: { type: [holidaySchema], default: [] },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
    /** Billing / GST placeholder — additive for Module 11 */
    taxPercent: { type: Number, default: 18, min: 0, max: 100 },
    gstEnabled: { type: Boolean, default: true },
    gstNumber: { type: String, default: null },
  },
  { _id: false }
);

const DEFAULT_WEEKLY = [1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  isClosed: false,
  openTime: '10:00',
  closeTime: '19:00',
})).concat([{ day: 0, isClosed: true, openTime: '10:00', closeTime: '19:00' }]);

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branchCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    displayName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, trim: true, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },
    logo: { type: String, default: null },
    workingHours: { type: String, default: '10:00 - 19:00' },
    holidayCalendar: { type: [holidaySchema], default: [] },
    /** ORG-002 — amenity/equipment categories offered at this branch (e.g. "parking", "wheelchair_access", "lab", "pharmacy"). */
    facilities: { type: [String], default: [] },
    settings: {
      type: branchSettingsSchema,
      default: () => ({
        workingDays: [1, 2, 3, 4, 5, 6],
        weeklySchedule: DEFAULT_WEEKLY,
        lunchBreak: { enabled: true, startTime: '13:00', endTime: '14:00' },
        timeSlotDurationMinutes: 15,
        appointmentBufferMinutes: 5,
        holidayCalendar: [],
        emergencyContact: {},
      }),
    },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'branches',
  }
);

branchSchema.index({ name: 'text', displayName: 'text', branchCode: 'text', city: 'text' });

branchSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    branchCode: this.branchCode,
    displayName: this.displayName,
    email: this.email,
    phone: this.phone,
    alternatePhone: this.alternatePhone,
    address: this.address,
    city: this.city,
    state: this.state,
    country: this.country,
    postalCode: this.postalCode,
    latitude: this.latitude,
    longitude: this.longitude,
    timezone: this.timezone,
    currency: this.currency,
    logo: this.logo,
    workingHours: this.workingHours,
    holidayCalendar: this.holidayCalendar,
    facilities: this.facilities || [],
    settings: this.settings,
    status: this.status,
    isActive: this.isActive,
    notes: this.notes,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Branch = mongoose.model('Branch', branchSchema);

export default Branch;
export { DEFAULT_WEEKLY };
