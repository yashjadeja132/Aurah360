import mongoose from 'mongoose';

/** Offer board — localized title/description/validity/audience/CTA (§12.5, CRM-001). */
const localizedTextSchema = new mongoose.Schema(
  { en: String, gu: String, hi: String },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    title: { type: localizedTextSchema, required: true },
    description: { type: localizedTextSchema, default: () => ({}) },
    imageUrl: { type: String, default: null },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    branchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] }, // empty = all branches
    serviceIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Master', default: [] },
    audience: { type: String, enum: ['ALL', 'NEW_PATIENTS', 'EXISTING_PATIENTS', 'VIP'], default: 'ALL' },
    /**
     * CRM-consent — an offer is outbound marketing content, so it defaults to requiring the
     * patient's marketing consent (opt-in-by-default-safety), unlike LoyaltyEarningRule's
     * per-rule requiresMarketingConsent (default false there, since most earning rules are not
     * marketing pushes). CrmExtensionsService.listOffers filters out offers a non-consenting
     * patient would otherwise see, mirroring LoyaltyEarningEngineService.isEligible's consent
     * check.
     */
    requiresMarketingConsent: { type: Boolean, default: true },
    /** Names from LoyaltyTier.model.js. Empty = every tier (no targeting). */
    targetTiers: { type: [String], default: [] },
    terms: { type: localizedTextSchema, default: () => ({}) },
    bookingCta: { type: String, default: 'Book now' },
    isActive: { type: Boolean, default: true, index: true },
    /**
     * Approval workflow (CRM-001 §12.5) — a newly-created offer is not yet publishable; it must
     * be reviewed by someone holding CRM_OFFERS_MANAGE (Manager/Admin/Owner) before it can appear
     * on the patient-facing offer board. `listOffers`'s patient-facing (activeOnly) filter
     * requires APPROVED regardless of isActive/consent/audience.
     */
    approvalStatus: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'offers' }
);

offerSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    title: this.title,
    description: this.description,
    imageUrl: this.imageUrl,
    validFrom: this.validFrom,
    validTo: this.validTo,
    branchIds: (this.branchIds || []).map((id) => id.toString()),
    serviceIds: (this.serviceIds || []).map((id) => id.toString()),
    audience: this.audience,
    requiresMarketingConsent: this.requiresMarketingConsent,
    targetTiers: this.targetTiers || [],
    terms: this.terms,
    bookingCta: this.bookingCta,
    isActive: this.isActive,
    approvalStatus: this.approvalStatus,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    rejectionReason: this.rejectionReason,
    isCurrentlyValid:
      this.isActive &&
      this.approvalStatus === 'APPROVED' &&
      this.validFrom <= new Date() &&
      this.validTo >= new Date(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;
