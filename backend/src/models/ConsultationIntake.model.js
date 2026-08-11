import mongoose from 'mongoose';
import { INTAKE_CATEGORY_LIST, SKIN_TYPE_LIST, DURATION_UNIT_LIST } from '../enums/consultation.js';

/**
 * §2 Pre-consult intake.
 *
 * DECISION — this is its own model (`consultation_intakes`), NOT a nested sub-document on
 * Consultation.model.js. Every other clinical sub-record (SOAP, vitals, diagnosis, examination)
 * already follows the "one Consultation{Thing} model keyed by consultationId, unique index,
 * `toSafeObject()`, its own repository" convention — see ConsultationVitals.model.js /
 * ConsultationExamination.model.js. Nesting a large intake block directly on the frequently-read
 * Consultation document (loaded on every list/getById) would break that convention for no benefit,
 * since intake is only needed on the intake screen and the workspace/doctor summary.
 *
 * DECISION — "specialty template auto-selected" (spec: "New dermatology patient" / "Acne" /
 * "Hair loss") is NOT wired to `ConsultationTemplate.model.js`. Those templates are per-doctor,
 * free-text SOAP/DIAGNOSIS/EXAMINATION/QUICK_PHRASE authoring aids (`content: Mixed`), versioned
 * and medical-lead approved — they carry no structured field list and are not specialty-keyed.
 * Reusing them here would mean inventing a structured schema on top of a free-text model just to
 * get a label. Instead `category` is a small fixed enum (`INTAKE_CATEGORY`) the nurse
 * confirms/changes on the intake screen; the mandatory field set is the same regardless of
 * category (per spec, only the skin/hair/laser history block is "configurable"), so the category
 * is informational/labeling only today — a hook for a future per-category mandatory-field config
 * without another migration.
 */
const skinHistorySchema = new mongoose.Schema(
  {
    skinType: { type: String, enum: [...SKIN_TYPE_LIST, null], default: null },
    photosensitivity: { type: Boolean, default: null },
    photosensitivityNotes: { type: String, default: null },
    scarKeloidTendency: { type: Boolean, default: null },
    isotretinoinHistory: { type: Boolean, default: null },
    isotretinoinNotes: { type: String, default: null },
    /** Relevant only when clinically applicable; left null rather than forced false. */
    pregnancyLactation: { type: Boolean, default: null },
    priorReactions: { type: String, default: null },
    contraindications: { type: String, default: null },
  },
  { _id: false }
);

const consultationIntakeSchema = new mongoose.Schema(
  {
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      enum: INTAKE_CATEGORY_LIST,
      default: 'GENERAL',
    },
    chiefComplaint: { type: String, default: null },
    durationValue: { type: Number, min: 0, default: null },
    durationUnit: { type: String, enum: [...DURATION_UNIT_LIST, null], default: null },
    bodyArea: { type: String, default: null },
    // Reviewed/confirmed for THIS visit — the actual text is pre-filled from Patient.medical and
    // is editable here without forcing re-entry of already-known data (spec requirement). The
    // boolean is the mandatory signal: "was this looked at and confirmed", independent of whether
    // the resulting text is empty (e.g. genuinely no known allergies).
    allergies: { type: String, default: null },
    allergiesReviewed: { type: Boolean, default: false },
    currentMedications: { type: String, default: null },
    currentMedicationsReviewed: { type: Boolean, default: false },
    conditions: { type: String, default: null },
    conditionsReviewed: { type: Boolean, default: false },
    pastTreatment: { type: String, default: null },
    pastTreatmentReviewed: { type: Boolean, default: false },
    skinHistory: { type: skinHistorySchema, default: () => ({}) },
    // Computed at save-time (see pre-save hook) so the doctor's consultation summary/workspace
    // can trust a real server-side signal instead of re-deriving completeness client-side.
    mandatoryIncomplete: { type: [String], default: [] },
    isComplete: { type: Boolean, default: false, index: true },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consultation_intakes',
  }
);

/**
 * Mandatory items per spec's top block: chief complaint / duration / body area, plus the
 * allergies/current-meds/conditions/past-treatment "confirm/complete" set. The skin/hair/laser
 * history block is explicitly "(configurable)" in the spec, so it is deliberately NOT counted —
 * it stays a recommended-but-optional section today.
 */
consultationIntakeSchema.statics.computeMandatoryIncomplete = function computeMandatoryIncomplete(doc) {
  const missing = [];
  if (!doc.chiefComplaint || !String(doc.chiefComplaint).trim()) missing.push('chiefComplaint');
  if (doc.durationValue == null) missing.push('durationValue');
  if (!doc.durationUnit) missing.push('durationUnit');
  if (!doc.bodyArea || !String(doc.bodyArea).trim()) missing.push('bodyArea');
  if (!doc.allergiesReviewed) missing.push('allergiesReviewed');
  if (!doc.currentMedicationsReviewed) missing.push('currentMedicationsReviewed');
  if (!doc.conditionsReviewed) missing.push('conditionsReviewed');
  if (!doc.pastTreatmentReviewed) missing.push('pastTreatmentReviewed');
  return missing;
};

consultationIntakeSchema.pre('save', function preSave(next) {
  const missing = consultationIntakeSchema.statics.computeMandatoryIncomplete(this);
  this.mandatoryIncomplete = missing;
  this.isComplete = missing.length === 0;
  if (this.isComplete && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (!this.isComplete) {
    // Guard (spec): an intake that regresses to incomplete (e.g. a field cleared) must not keep
    // reporting a stale completedAt/completedBy from an earlier pass.
    this.completedAt = null;
    this.completedBy = null;
  }
  next();
});

/**
 * `updateById` (BaseRepository) goes through `findByIdAndUpdate`, which runs QUERY middleware,
 * not document 'save' middleware — the pre('save') hook above never fires for it. Recompute the
 * same signal here against the merged (existing + incoming $set) document so a partial autosave
 * PUT still lands a trustworthy `mandatoryIncomplete`/`isComplete` instead of a stale one.
 */
consultationIntakeSchema.pre('findOneAndUpdate', async function preFindOneAndUpdate(next) {
  try {
    const update = this.getUpdate() || {};
    const existing = await this.model.findOne(this.getQuery()).lean();
    const merged = { ...(existing || {}), ...update };
    const missing = consultationIntakeSchema.statics.computeMandatoryIncomplete(merged);
    const isComplete = missing.length === 0;
    update.mandatoryIncomplete = missing;
    update.isComplete = isComplete;
    if (isComplete) {
      update.completedAt = merged.completedAt || new Date();
    } else {
      update.completedAt = null;
      update.completedBy = null;
    }
    this.setUpdate(update);
    next();
  } catch (err) {
    next(err);
  }
});

consultationIntakeSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    category: this.category,
    chiefComplaint: this.chiefComplaint,
    durationValue: this.durationValue,
    durationUnit: this.durationUnit,
    bodyArea: this.bodyArea,
    allergies: this.allergies,
    allergiesReviewed: this.allergiesReviewed,
    currentMedications: this.currentMedications,
    currentMedicationsReviewed: this.currentMedicationsReviewed,
    conditions: this.conditions,
    conditionsReviewed: this.conditionsReviewed,
    pastTreatment: this.pastTreatment,
    pastTreatmentReviewed: this.pastTreatmentReviewed,
    skinHistory: this.skinHistory,
    mandatoryIncomplete: this.mandatoryIncomplete,
    isComplete: this.isComplete,
    completedBy: this.completedBy ? this.completedBy.toString() : null,
    completedAt: this.completedAt,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsultationIntake = mongoose.model('ConsultationIntake', consultationIntakeSchema);

export default ConsultationIntake;
