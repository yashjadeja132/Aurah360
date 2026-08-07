import mongoose from 'mongoose';
import { TIMELINE_EVENT_LIST } from '../enums/patient.js';

const patientTimelineSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: TIMELINE_EVENT_LIST,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    occurredAt: { type: Date, default: () => new Date(), index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'patient_timelines',
  }
);

patientTimelineSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    eventType: this.eventType,
    title: this.title,
    description: this.description,
    metadata: this.metadata,
    actorId: this.actorId ? this.actorId.toString() : null,
    occurredAt: this.occurredAt,
    createdAt: this.createdAt,
  };
};

const PatientTimeline = mongoose.model('PatientTimeline', patientTimelineSchema);

export default PatientTimeline;
