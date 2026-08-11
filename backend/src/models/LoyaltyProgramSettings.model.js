import mongoose from 'mongoose';

const REDEMPTION_IDENTITY_CONFIRMATION_LIST = ['NONE', 'IN_PERSON', 'OTP'];
const EXPIRED_REDEMPTION_RESTORE_POLICY_LIST = ['RESTORE_SHORT_EXPIRY', 'FORFEIT'];

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

    /**
     * LOY-005 — how a redemption at the point of sale confirms the points actually belong to the
     * person present. NONE = no gate (legacy behaviour); IN_PERSON = staff must tick that they
     * checked the patient's identity (front-desk visual/ID check, no OTP infra needed);
     * OTP = an OTP was sent to the patient and verified before redeeming. OTP *delivery* is out of
     * scope for this pass — LoyaltyLedgerService.redeem() only validates the `otpVerified` flag
     * the caller supplies; wiring an actual SMS/WhatsApp OTP send-and-verify flow is left to the
     * module that adds one.
     */
    redemptionIdentityConfirmation: {
      type: String,
      enum: REDEMPTION_IDENTITY_CONFIRMATION_LIST,
      // Defaults to NONE (legacy/no-gate behaviour) — this is a new opt-in control, not a
      // retroactive requirement. Defaulting to IN_PERSON silently broke every existing
      // redemption call site (smoke scripts, pre-existing tests, the money-safety concurrency
      // suite) that had no reason to know this flag existed. Admin turns it on deliberately.
      default: 'NONE',
    },

    /**
     * LOY-006 — when a refund re-credits previously-redeemed points that have since expired
     * (DEBIT_EXPIRY already ran), what happens to the re-credit: RESTORE_SHORT_EXPIRY re-credits
     * them with a fresh short expiry (see BillingService's refund path) so the patient isn't
     * simply denied the refund of their own points; FORFEIT does not re-credit expired points at
     * all — only points that had not yet expired are restored, with their original expiry.
     */
    expiredRedemptionRestorePolicy: {
      type: String,
      enum: EXPIRED_REDEMPTION_RESTORE_POLICY_LIST,
      default: 'RESTORE_SHORT_EXPIRY',
    },

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

    /** LOY Flow C anti-abuse — max Referral documents a single referrer may create (across all
     *  their referees) within one calendar month. Enforced by ReferralService.registerReferral;
     *  exceeding it sets the new Referral's status to BLOCKED_MONTHLY_CAP instead of PENDING. */
    referralMonthlyCapPerPatient: { type: Number, default: 10, min: 1 },

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
    redemptionIdentityConfirmation: this.redemptionIdentityConfirmation,
    expiredRedemptionRestorePolicy: this.expiredRedemptionRestorePolicy,
    tiersEnabled: this.tiersEnabled,
    ruleChangeApprovalThresholdPercent: this.ruleChangeApprovalThresholdPercent,
    referralMonthlyCapPerPatient: this.referralMonthlyCapPerPatient,
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
