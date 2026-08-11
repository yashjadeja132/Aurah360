import mongoose from 'mongoose';
import { TEMPLATE_TYPE_LIST, TEMPLATE_STATUS, TEMPLATE_STATUS_LIST } from '../enums/consultation.js';

const consultationTemplateSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    templateType: {
      type: String,
      enum: TEMPLATE_TYPE_LIST,
      required: true,
      index: true,
    },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
    isShared: { type: Boolean, default: false },
    /**
     * Versioning/approval — mirrors TreatmentProtocol's convention (see
     * models/TreatmentProtocol.model.js §10.2): a new edit bumps `version` and resets to DRAFT;
     * `previousVersionId` chains back to what it replaced so a template used on an already
     * signed consultation is never silently mutated out from under that record.
     */
    version: { type: Number, default: 1 },
    previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationTemplate', default: null },
    status: { type: String, enum: TEMPLATE_STATUS_LIST, default: TEMPLATE_STATUS.DRAFT, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_templates',
  }
);

consultationTemplateSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    name: this.name,
    templateType: this.templateType,
    content: this.content || {},
    isShared: this.isShared,
    version: this.version,
    previousVersionId: this.previousVersionId ? this.previousVersionId.toString() : null,
    status: this.status,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationTemplate = mongoose.model('ConsultationTemplate', consultationTemplateSchema);

export default ConsultationTemplate;
