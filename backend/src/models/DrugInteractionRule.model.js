import mongoose from 'mongoose';
import {
  INTERACTION_MATCH_ON,
  INTERACTION_MATCH_ON_LIST,
  INTERACTION_SEVERITY,
  INTERACTION_SEVERITY_LIST,
} from '../enums/prescription.js';
import { ENTITY_STATUS } from '../constants/index.js';

/**
 * RX-SAFETY — admin-maintained drug-interaction rule set.
 *
 * This repository ships with ZERO rules on purpose. There is no licensed interaction database
 * here and clinical pairs must never be invented: a fabricated interaction table in a medical
 * product is more dangerous than an empty one, because it reads as authoritative. The collection
 * exists so a clinic can enter pairs it can cite (`sourceReference` is how the citation is kept),
 * and so a real provider (First Databank / Medi-Span / RxNav …) can later be wired in behind the
 * same InteractionSource interface without touching the block/override/audit flow.
 *
 * Matching is TERM-based (against a prescribed item's name / generic name) because that is all
 * the medicine master carries — there is no drug-class or composition taxonomy in this schema.
 */
const drugInteractionRuleSchema = new mongoose.Schema(
  {
    ruleCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    /** Left-hand drug term, e.g. "warfarin". Matched word-wise, case-insensitively. */
    termA: { type: String, required: true, trim: true, lowercase: true, index: true },
    matchOnA: {
      type: String,
      enum: INTERACTION_MATCH_ON_LIST,
      default: INTERACTION_MATCH_ON.ANY,
    },
    /** Right-hand drug term. */
    termB: { type: String, required: true, trim: true, lowercase: true, index: true },
    matchOnB: {
      type: String,
      enum: INTERACTION_MATCH_ON_LIST,
      default: INTERACTION_MATCH_ON.ANY,
    },
    severity: {
      type: String,
      enum: INTERACTION_SEVERITY_LIST,
      default: INTERACTION_SEVERITY.MAJOR,
      index: true,
    },
    /** Whether a match refuses finalize (override-able) or is advisory only. */
    blocking: { type: Boolean, default: true },
    clinicalEffect: { type: String, default: null, trim: true },
    management: { type: String, default: null, trim: true },
    /**
     * Where this pair came from — a monograph, formulary, or clinic protocol. Recorded so a
     * clinician can judge how much to trust the alert. Rules with no reference are still allowed
     * but are reported as `sourceReference: null` in the alert payload.
     */
    sourceReference: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'druginteractionrules',
  }
);

drugInteractionRuleSchema.index(
  { termA: 1, termB: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

drugInteractionRuleSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    ruleCode: this.ruleCode,
    termA: this.termA,
    matchOnA: this.matchOnA,
    termB: this.termB,
    matchOnB: this.matchOnB,
    severity: this.severity,
    blocking: this.blocking,
    clinicalEffect: this.clinicalEffect,
    management: this.management,
    sourceReference: this.sourceReference,
    status: this.status,
    isActive: this.isActive,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const DrugInteractionRule = mongoose.model('DrugInteractionRule', drugInteractionRuleSchema);

export default DrugInteractionRule;
