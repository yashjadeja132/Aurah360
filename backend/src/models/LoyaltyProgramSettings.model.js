import mongoose from 'mongoose';

/**
 * LOY-001/Section 3.3 — global program settings, versioned like Organization.model.js's
 * branchOverridableFields pattern. Each save creates a NEW version (effective-dated); the
 * currently-active version is whichever has the latest effectiveFrom <= now. Past ledger
 * entries reference the settings version active when they were created (conversionRateVersion
 * on redemption entries) so a later rate change never recomputes history.
 */
const loyaltyProgramSettingsSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, default: 1 },
    previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyProgramSettings', default: null },
    effectiveFrom: { type: Date, required: true, default: Date.now },

    /** LOY-001 — master kill switch. OFF blocks new accrual/redemption; balances untouched. */
    programEnabled: { type: Boolean, default: false },
    programDisplayName: { type: String, default: 'Aurah Rewards', trim: true, maxlength: 100 },

    /** Redemption conversion: `redemptionPointsPerRupee` points = ₹1. */
    redemptionPointsPerRupee: { type: Number, required: true, default: 10, min: 1 },
    minimumPointsToRedeem: { type: Number, required: true, default: 500, min: 0 },
    /** At most one of these two caps is enforced; percent takes priority if both are set. */
    maxRedemptionPercentPerInvoice: { type: Number, default: 50, min: 0, max: 100 },
    maxRedemptionFlatInrPerInvoice: { type: Number, default: null, min: 0 },
    redemptionStepPoints: { type: Number, default: 100, min: 1 },

    /** null = never expire. */
    pointsExpiryMonths: { type: Number, default: 12, min: 1, max: 120 },
    expiryReminderDaysBefore: { type: [Number], default: [30, 7] },

    /** Category/item codes excluded from the redeemable base (e.g. pharmacy medicines, taxes). */
    excludedRedemptionCategories: { type: [String], default: [] },
    earnOnRedeemedPortion: { type: Boolean, default: false },

    tiersEnabled: { type: Boolean, default: false },
    /** Owner approval required for rule-value changes above this % delta from current value.
     *  null = no threshold, any rule-value change goes through unchallenged.
     *  Enforced by LoyaltyAdminService.addRuleVersion. */
    ruleChangeApprovalThresholdPercent: { type: Number, default: null, min: 0 },

    /**
     * LOY-008 — the largest manual adjustment a given role may apply on its own authority, keyed
     * by role name. A request above the requester's limit is queued for approval even when the
     * requester would otherwise be allowed to auto-apply. Roles absent from the map are
     * unlimited (which is the empty default: no limit until an owner configures one).
     * Enforced by LoyaltyAdminService.createPatientAdjustment.
     */
    manualAdjustmentPointLimitsByRole: { type: Map, of: Number, default: undefined },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'loyalty_program_settings' }
);

loyaltyProgramSettingsSchema.index({ effectiveFrom: -1 });

loyaltyProgramSettingsSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    version: this.version,
    previousVersionId: this.previousVersionId?.toString?.() || null,
    effectiveFrom: this.effectiveFrom,
    programEnabled: this.programEnabled,
    programDisplayName: this.programDisplayName,
    redemptionPointsPerRupee: this.redemptionPointsPerRupee,
    minimumPointsToRedeem: this.minimumPointsToRedeem,
    maxRedemptionPercentPerInvoice: this.maxRedemptionPercentPerInvoice,
    maxRedemptionFlatInrPerInvoice: this.maxRedemptionFlatInrPerInvoice,
    redemptionStepPoints: this.redemptionStepPoints,
    pointsExpiryMonths: this.pointsExpiryMonths,
    expiryReminderDaysBefore: this.expiryReminderDaysBefore,
    excludedRedemptionCategories: this.excludedRedemptionCategories,
    earnOnRedeemedPortion: this.earnOnRedeemedPortion,
    tiersEnabled: this.tiersEnabled,
    ruleChangeApprovalThresholdPercent: this.ruleChangeApprovalThresholdPercent,
    manualAdjustmentPointLimitsByRole: this.manualAdjustmentPointLimitsByRole
      ? Object.fromEntries(this.manualAdjustmentPointLimitsByRole)
      : {},
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const LoyaltyProgramSettings = mongoose.model('LoyaltyProgramSettings', loyaltyProgramSettingsSchema);

export default LoyaltyProgramSettings;
