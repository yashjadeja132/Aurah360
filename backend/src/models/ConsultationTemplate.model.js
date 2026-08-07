import mongoose from 'mongoose';
import { TEMPLATE_TYPE, TEMPLATE_TYPE_LIST } from '../enums/consultation.js';

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
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationTemplate = mongoose.model('ConsultationTemplate', consultationTemplateSchema);

export default ConsultationTemplate;
