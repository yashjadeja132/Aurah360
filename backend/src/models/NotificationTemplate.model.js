import mongoose from 'mongoose';
import {
  NOTIFICATION_CHANNEL_LIST,
  WHATSAPP_APPROVAL_STATUS,
  WHATSAPP_APPROVAL_STATUS_LIST,
} from '../enums/notification.js';

const notificationTemplateSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    eventName: { type: String, default: null, index: true },
    channel: {
      type: String,
      enum: [...NOTIFICATION_CHANNEL_LIST, 'ALL'],
      default: 'ALL',
    },
    subject: { type: String, default: null },
    body: { type: String, required: true },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    /**
     * DLT (Distributed Ledger Technology) SMS registration fields — required by Indian
     * telecom regulation for transactional/promotional SMS. Only meaningful for
     * channel === 'SMS' templates, but left optional/unenforced at the schema level so
     * templates of other channel types are never blocked from saving.
     */
    dltHeader: { type: String, default: null, trim: true },
    dltTemplateId: { type: String, default: null, trim: true },
    /**
     * WhatsApp Business/Meta template approval state. Only meaningful for
     * channel === 'WHATSAPP' templates; optional/nullable elsewhere so existing
     * non-WhatsApp templates are unaffected.
     */
    whatsappApprovalStatus: {
      type: String,
      enum: WHATSAPP_APPROVAL_STATUS_LIST,
      default: WHATSAPP_APPROVAL_STATUS.PENDING,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'notification_templates',
  }
);

notificationTemplateSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    code: this.code,
    name: this.name,
    description: this.description,
    eventName: this.eventName,
    channel: this.channel,
    subject: this.subject,
    body: this.body,
    variables: this.variables || [],
    isActive: this.isActive,
    dltHeader: this.dltHeader,
    dltTemplateId: this.dltTemplateId,
    whatsappApprovalStatus: this.whatsappApprovalStatus,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const NotificationTemplate = mongoose.model(
  'NotificationTemplate',
  notificationTemplateSchema
);

export default NotificationTemplate;
