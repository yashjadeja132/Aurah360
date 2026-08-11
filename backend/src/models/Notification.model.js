import mongoose from 'mongoose';
import {
  NOTIFICATION_CHANNEL_LIST,
  NOTIFICATION_STATUS,
  NOTIFICATION_STATUS_LIST,
} from '../enums/notification.js';

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    eventName: { type: String, required: true, trim: true, index: true },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    recipient: { type: String, required: true, trim: true },
    channel: {
      type: String,
      enum: NOTIFICATION_CHANNEL_LIST,
      required: true,
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationTemplate',
      default: null,
    },
    templateCode: { type: String, default: null, index: true },
    subject: { type: String, default: null },
    message: { type: String, required: true },
    variables: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: NOTIFICATION_STATUS_LIST,
      default: NOTIFICATION_STATUS.QUEUED,
      index: true,
    },
    scheduledAt: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },
    failedReason: { type: String, default: null },
    cancelReason: { type: String, default: null },
    retryCount: { type: Number, default: 0, min: 0 },
    readAt: { type: Date, default: null, index: true },
    archivedAt: { type: Date, default: null },
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    /** NTF-005 — provider message/call ID + webhook delivery trail. */
    providerMessageId: { type: String, default: null, index: true },
    deliveryEvents: {
      type: [
        {
          type: { type: String },
          at: { type: Date, default: () => new Date() },
          raw: mongoose.Schema.Types.Mixed,
        },
      ],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /**
     * Set when this notification was auto-created by the WhatsApp→SMS→voice fallback
     * chain after the named channel's send failed (see NotificationService#markFailed).
     */
    fallbackFromChannel: { type: String, enum: NOTIFICATION_CHANNEL_LIST, default: null },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

notificationSchema.index({ userId: 1, channel: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ status: 1, channel: 1, createdAt: -1 });

notificationSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    notificationId: this.notificationId,
    eventName: this.eventName,
    patientId: this.patientId?.toString?.() || null,
    userId: this.userId?.toString?.() || null,
    recipient: this.recipient,
    channel: this.channel,
    templateId: this.templateId?.toString?.() || null,
    templateCode: this.templateCode,
    subject: this.subject,
    message: this.message,
    variables: this.variables || {},
    status: this.status,
    scheduledAt: this.scheduledAt,
    sentAt: this.sentAt,
    failedReason: this.failedReason,
    cancelReason: this.cancelReason,
    providerMessageId: this.providerMessageId,
    deliveryEvents: this.deliveryEvents,
    retryCount: this.retryCount,
    fallbackFromChannel: this.fallbackFromChannel,
    readAt: this.readAt,
    archivedAt: this.archivedAt,
    isRead: Boolean(this.readAt),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
