import mongoose from 'mongoose';

/**
 * Fast-read cache of a patient's loyalty balance — REBUILDABLE from LoyaltyLedgerEntry at any
 * time (e.g. via a repair job). Never the source of truth; every write to this cache must be
 * derived from a ledger entry that was just appended, in the same logical operation.
 */
const loyaltyBalanceCacheSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, unique: true },
    currentBalance: { type: Number, default: 0, min: 0 },
    /** Balance not currently held by a pending clawback shortfall — what's actually redeemable. */
    redeemableBalance: { type: Number, default: 0, min: 0 },
    lifetimeEarned: { type: Number, default: 0, min: 0 },
    lifetimeRedeemed: { type: Number, default: 0, min: 0 },
    lifetimeExpired: { type: Number, default: 0, min: 0 },
    nextExpiringLotPoints: { type: Number, default: null },
    nextExpiringLotDate: { type: Date, default: null },
    lastLedgerEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyLedgerEntry', default: null },
    recalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'loyalty_balance_cache' }
);

loyaltyBalanceCacheSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    patientId: this.patientId?.toString?.() || this.patientId,
    currentBalance: this.currentBalance,
    redeemableBalance: this.redeemableBalance,
    lifetimeEarned: this.lifetimeEarned,
    lifetimeRedeemed: this.lifetimeRedeemed,
    lifetimeExpired: this.lifetimeExpired,
    nextExpiringLotPoints: this.nextExpiringLotPoints,
    nextExpiringLotDate: this.nextExpiringLotDate,
    recalculatedAt: this.recalculatedAt,
    ...extra,
  };
};

const LoyaltyBalanceCache = mongoose.model('LoyaltyBalanceCache', loyaltyBalanceCacheSchema);

export default LoyaltyBalanceCache;
