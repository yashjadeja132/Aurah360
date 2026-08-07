import mongoose from 'mongoose';
import { FOLLOW_UP_TYPE_LIST } from '../enums/crm.js';

const leadFollowUpSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },
    type: {
      type: String,
      enum: FOLLOW_UP_TYPE_LIST,
      required: true,
    },
    notes: { type: String, default: null },
    outcome: { type: String, default: null },
    nextFollowUp: { type: Date, default: null },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: 'lead_follow_ups',
  }
);

leadFollowUpSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    leadId: this.leadId?.toString?.() || this.leadId,
    date: this.date,
    type: this.type,
    notes: this.notes,
    outcome: this.outcome,
    nextFollowUp: this.nextFollowUp,
    assignedTo: this.assignedTo?.toString?.() || null,
    createdBy: this.createdBy?.toString?.() || null,
    createdAt: this.createdAt,
    ...extra,
  };
};

const LeadFollowUp = mongoose.model('LeadFollowUp', leadFollowUpSchema);

export default LeadFollowUp;
