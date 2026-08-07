import mongoose from 'mongoose';
import {
  LEAD_TASK_ASSIGNEE_ROLE_LIST,
  LEAD_TASK_STATUS,
  LEAD_TASK_STATUS_LIST,
} from '../enums/crm.js';

const leadTaskSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    assigneeRole: {
      type: String,
      enum: [...LEAD_TASK_ASSIGNEE_ROLE_LIST, null],
      default: null,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    dueDate: { type: Date, default: null, index: true },
    reminderAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: LEAD_TASK_STATUS_LIST,
      default: LEAD_TASK_STATUS.PENDING,
      index: true,
    },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'lead_tasks',
  }
);

leadTaskSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    leadId: this.leadId?.toString?.() || this.leadId,
    title: this.title,
    description: this.description,
    assigneeRole: this.assigneeRole,
    assignedTo: this.assignedTo?.toString?.() || null,
    dueDate: this.dueDate,
    reminderAt: this.reminderAt,
    status: this.status,
    completedAt: this.completedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const LeadTask = mongoose.model('LeadTask', leadTaskSchema);

export default LeadTask;
