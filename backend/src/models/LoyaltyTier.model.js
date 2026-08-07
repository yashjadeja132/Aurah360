import mongoose from 'mongoose';

/** LOY-012 — optional tier system, OFF by default (LoyaltyProgramSettings.tiersEnabled). */
const loyaltyTierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    rank: { type: Number, required: true, min: 0 }, // 0 = lowest tier, ordering for progress display
    qualificationBasis: {
      type: String,
      enum: ['POINTS_EARNED_ROLLING_12M', 'VISITS_COUNT_ROLLING_12M', 'SPEND_ROLLING_12M'],
      required: true,
    },
    threshold: { type: Number, required: true, min: 0 },
    earningMultiplier: { type: Number, default: 1, min: 1 },
    benefits: {
      birthdayBonusMultiplier: { type: Number, default: 1, min: 1 },
      /** Service/marketing flag only — never a clinical queue-priority flag (PRD §4 clinical boundary). */
      priorityBookingFlag: { type: Boolean, default: false },
      offerSegmentTag: { type: String, default: null, trim: true },
    },
    downgradeGracePeriodDays: { type: Number, default: 30, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'loyalty_tiers' }
);

loyaltyTierSchema.index({ rank: 1 });

loyaltyTierSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    name: this.name,
    rank: this.rank,
    qualificationBasis: this.qualificationBasis,
    threshold: this.threshold,
    earningMultiplier: this.earningMultiplier,
    benefits: this.benefits,
    downgradeGracePeriodDays: this.downgradeGracePeriodDays,
    isActive: this.isActive,
    ...extra,
  };
};

export const LoyaltyTier = mongoose.model('LoyaltyTier', loyaltyTierSchema);

/** One document per patient tracking current tier + rolling progress — rebuildable from the
 *  ledger/appointment history, same "cache, not truth" status as LoyaltyBalanceCache. */
const patientTierStateSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    currentTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyTier', default: null },
    rollingPointsEarned: { type: Number, default: 0 },
    rollingVisitsCount: { type: Number, default: 0 },
    rollingSpend: { type: Number, default: 0 },
    tierSince: { type: Date, default: null },
    downgradeWarningAt: { type: Date, default: null },
    recalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'loyalty_patient_tier_state' }
);

patientTierStateSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    patientId: this.patientId?.toString?.() || this.patientId,
    currentTierId: this.currentTierId?.toString?.() || null,
    rollingPointsEarned: this.rollingPointsEarned,
    rollingVisitsCount: this.rollingVisitsCount,
    rollingSpend: this.rollingSpend,
    tierSince: this.tierSince,
    downgradeWarningAt: this.downgradeWarningAt,
    recalculatedAt: this.recalculatedAt,
    ...extra,
  };
};

export const PatientTierState = mongoose.model('PatientTierState', patientTierStateSchema);

export default LoyaltyTier;
