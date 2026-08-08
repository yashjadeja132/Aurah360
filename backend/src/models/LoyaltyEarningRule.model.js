import mongoose from 'mongoose';
import {
  LOYALTY_EARNING_EVENT_LIST,
  LOYALTY_POINT_FORMULA_TYPE_LIST,
  LOYALTY_ROUNDING_RULE_LIST,
  LOYALTY_ELIGIBILITY_LIST,
} from '../enums/loyalty.js';

/**
 * LOY-002 — one document per earning rule (E1–E12 built-ins + custom). `versions` holds every
 * effective-dated revision (mirrors TreatmentProtocol.model.js's version/previousVersionId
 * pattern, but nested here since a rule's identity — code — never changes, only its terms do).
 * The engine resolves "the version active on event date" and pins that version's id onto every
 * ledger entry it produces — a later admin edit never recomputes past entries.
 */
const ruleVersionSchema = new mongoose.Schema(
  {
    formulaType: { type: String, enum: LOYALTY_POINT_FORMULA_TYPE_LIST, required: true },
    /** FIXED: points per occurrence. PER_AMOUNT: points per `perAmountInr` spent.
     *  PERCENT_OF_AMOUNT: percent (0-100) of amount as points. */
    pointValue: { type: Number, required: true, min: 0 },
    perAmountInr: { type: Number, default: null, min: 1 }, // required when formulaType = PER_AMOUNT
    roundingRule: { type: String, enum: LOYALTY_ROUNDING_RULE_LIST, default: 'FLOOR' },

    branchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] }, // [] = all branches
    branchOverrides: {
      type: Map,
      of: new mongoose.Schema({ pointValue: Number }, { _id: false }),
      default: undefined,
    },
    serviceIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Master', default: [] }, // E3/E4 applicability
    packageIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'TreatmentPackage', default: [] },

    perEventCap: { type: Number, default: null, min: 0 },
    perDayCap: { type: Number, default: null, min: 0 },
    perMonthCap: { type: Number, default: null, min: 0 },
    lifetimeCap: { type: Number, default: null, min: 0 },

    eligibility: { type: String, enum: LOYALTY_ELIGIBILITY_LIST, default: 'ALL_PATIENTS' },
    minimumVisits: { type: Number, default: null, min: 0 }, // used when eligibility = MINIMUM_VISITS
    requiresMarketingConsent: { type: Boolean, default: false }, // E9/E11-style rules

    effectiveFrom: { type: Date, required: true, default: Date.now },
    effectiveTo: { type: Date, default: null }, // null = open-ended; set when superseded

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const loyaltyEarningRuleSchema = new mongoose.Schema(
  {
    ruleCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    eventType: { type: String, enum: LOYALTY_EARNING_EVENT_LIST, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, default: null, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },

    versions: { type: [ruleVersionSchema], default: [] },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'loyalty_earning_rules' }
);

loyaltyEarningRuleSchema.index({ eventType: 1, isActive: 1 });

/** The version whose [effectiveFrom, effectiveTo) window contains `atDate` (default now). */
loyaltyEarningRuleSchema.methods.activeVersionAt = function activeVersionAt(atDate = new Date()) {
  return (
    this.versions
      .filter((v) => v.effectiveFrom <= atDate && (!v.effectiveTo || v.effectiveTo > atDate))
      .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0] || null
  );
};

loyaltyEarningRuleSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    ruleCode: this.ruleCode,
    eventType: this.eventType,
    name: this.name,
    notes: this.notes,
    isActive: this.isActive,
    versions: this.versions.map((v) => ({
      id: v._id.toString(),
      formulaType: v.formulaType,
      pointValue: v.pointValue,
      perAmountInr: v.perAmountInr,
      roundingRule: v.roundingRule,
      branchIds: (v.branchIds || []).map((b) => b.toString()),
      branchOverrides: v.branchOverrides ? Object.fromEntries(v.branchOverrides) : null,
      serviceIds: (v.serviceIds || []).map((s) => s.toString()),
      packageIds: (v.packageIds || []).map((p) => p.toString()),
      perEventCap: v.perEventCap,
      perDayCap: v.perDayCap,
      perMonthCap: v.perMonthCap,
      lifetimeCap: v.lifetimeCap,
      eligibility: v.eligibility,
      minimumVisits: v.minimumVisits,
      requiresMarketingConsent: v.requiresMarketingConsent,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      approvedBy: v.approvedBy?.toString?.() || null,
      approvedAt: v.approvedAt,
    })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const LoyaltyEarningRule = mongoose.model('LoyaltyEarningRule', loyaltyEarningRuleSchema);

export default LoyaltyEarningRule;
