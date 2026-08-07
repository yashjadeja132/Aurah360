import mongoose from 'mongoose';
import { AUDIT_ACTION_LIST } from '../enums/auditAction.js';
import config from '../config/index.js';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: AUDIT_ACTION_LIST,
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    correlationId: {
      type: String,
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    resourceType: {
      type: String,
      default: null,
    },
    resourceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  }
);

/**
 * PRV-003 — audit retention. TTL is read from AUDIT_LOG_RETENTION_DAYS (default ~7 years);
 * append-only history is independently retained from operational edits, but is not infinite.
 */
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.retention.auditLogDays * 24 * 3600 });

auditLogSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    action: this.action,
    actorId: this.actorId ? this.actorId.toString() : null,
    targetUserId: this.targetUserId ? this.targetUserId.toString() : null,
    metadata: this.metadata,
    ipAddress: this.ipAddress,
    userAgent: this.userAgent,
    correlationId: this.correlationId,
    branchId: this.branchId ? this.branchId.toString() : null,
    resourceType: this.resourceType,
    resourceId: this.resourceId,
    createdAt: this.createdAt,
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
