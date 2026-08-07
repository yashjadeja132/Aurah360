import mongoose from 'mongoose';
import { LOYALTY_CAMPAIGN_STATUS_LIST } from '../enums/loyalty.js';

/** LOY-013 — E11 multiplier campaigns: date/branch/service/audience-targeted point boosts. */
const loyaltyCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    multiplier: { type: Number, required: true, min: 1 },
    /** Which earning rule(s) this multiplier applies on top of — e.g. E2 spend points. */
    appliesToRuleCodes: { type: [String], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    branchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] }, // [] = all
    serviceIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Master', default: [] },
    /** Free-text audience segment tag (tier name, offer-board segment, etc.) — resolved by
     *  whatever segmentation the CRM/offer-board module already uses; kept loose here. */
    audienceSegment: { type: String, default: null, trim: true },

    status: { type: String, enum: LOYALTY_CAMPAIGN_STATUS_LIST, default: 'DRAFT' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'loyalty_campaigns' }
);

loyaltyCampaignSchema.index({ startDate: 1, endDate: 1, status: 1 });

loyaltyCampaignSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    name: this.name,
    multiplier: this.multiplier,
    appliesToRuleCodes: this.appliesToRuleCodes,
    startDate: this.startDate,
    endDate: this.endDate,
    branchIds: (this.branchIds || []).map((b) => b.toString()),
    serviceIds: (this.serviceIds || []).map((s) => s.toString()),
    audienceSegment: this.audienceSegment,
    status: this.status,
    approvedBy: this.approvedBy?.toString?.() || null,
    approvedAt: this.approvedAt,
    createdAt: this.createdAt,
    ...extra,
  };
};

const LoyaltyCampaign = mongoose.model('LoyaltyCampaign', loyaltyCampaignSchema);

export default LoyaltyCampaign;
