import mongoose from 'mongoose';
import {
  ADVERSE_EVENT_SEVERITY,
  ADVERSE_EVENT_SEVERITY_LIST,
  ADVERSE_EVENT_STATUS,
  ADVERSE_EVENT_STATUS_LIST,
} from '../enums/treatmentSession.js';

/**
 * Adverse event workflow — severity, onset, treatment, escalation, responsible clinician,
 * follow-up, attachments and closure (§10.3, §16.10). Cannot be hidden by completing billing.
 */
const attachmentSchema = new mongoose.Schema(
  { documentId: mongoose.Schema.Types.ObjectId, photoId: mongoose.Schema.Types.ObjectId, note: String },
  { _id: false }
);

const adverseEventSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    treatmentSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreatmentSession', default: null, index: true },
    treatmentPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreatmentPlan', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    severity: { type: String, enum: ADVERSE_EVENT_SEVERITY_LIST, required: true, index: true },
    status: { type: String, enum: ADVERSE_EVENT_STATUS_LIST, default: ADVERSE_EVENT_STATUS.OPEN, index: true },
    onsetAt: { type: Date, required: true },
    description: { type: String, required: true },
    treatmentGiven: { type: String, default: null },
    responsibleClinicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    escalatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedAt: { type: Date, default: null },
    followUpPlan: { type: String, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
    closureNotes: { type: String, default: null },
  },
  { timestamps: true, collection: 'adverse_events' }
);

adverseEventSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    treatmentSessionId: this.treatmentSessionId ? this.treatmentSessionId.toString() : null,
    treatmentPlanId: this.treatmentPlanId ? this.treatmentPlanId.toString() : null,
    branchId: this.branchId.toString(),
    severity: this.severity,
    status: this.status,
    onsetAt: this.onsetAt,
    description: this.description,
    treatmentGiven: this.treatmentGiven,
    responsibleClinicianId: this.responsibleClinicianId.toString(),
    escalatedTo: this.escalatedTo ? this.escalatedTo.toString() : null,
    escalatedAt: this.escalatedAt,
    followUpPlan: this.followUpPlan,
    attachments: this.attachments,
    reportedBy: this.reportedBy.toString(),
    closedBy: this.closedBy ? this.closedBy.toString() : null,
    closedAt: this.closedAt,
    closureNotes: this.closureNotes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const AdverseEvent = mongoose.model('AdverseEvent', adverseEventSchema);

export default AdverseEvent;
