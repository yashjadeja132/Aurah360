import mongoose from 'mongoose';

/**
 * Doctor favorite medicines / prescription templates.
 */
const prescriptionTemplateSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    isFavorite: { type: Boolean, default: true, index: true },
    /** Single medicine favorite (quick pick) */
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
      index: true,
    },
    /** Full prescription template items */
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: { type: String, default: null },
    useCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'prescription_templates',
  }
);

prescriptionTemplateSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    doctorId: this.doctorId.toString(),
    name: this.name,
    isFavorite: this.isFavorite,
    medicineId: this.medicineId ? this.medicineId.toString() : null,
    items: this.items || [],
    notes: this.notes,
    useCount: this.useCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const PrescriptionTemplate = mongoose.model('PrescriptionTemplate', prescriptionTemplateSchema);

export default PrescriptionTemplate;
