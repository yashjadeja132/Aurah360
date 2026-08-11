import mongoose from 'mongoose';

/**
 * LOY Flow C — patient-referral tracking. Fills the gap documented in
 * loyalty/eventSubscriptions.js (E5 REFERRAL_REFERRER/REFERRAL_REFEREE was previously unwired
 * because Patient.referredBy is free-text and there was no model pairing referrer↔referee).
 *
 * One document per referral relationship: referrer (existing patient) → referee (new patient),
 * created either self-service (patient shares their own code) or by staff (reception enters a
 * referral code while registering/converting a lead — `createdBy` set, audited separately).
 *
 * Status lifecycle:
 *   PENDING -> QUALIFIED -> CREDITED           (happy path)
 *   PENDING -> BLOCKED_SELF_REFERRAL            (referrer === referee)
 *   PENDING -> BLOCKED_DUPLICATE_DEVICE         (same device/IP fingerprint as referrer — only
 *                                                 set when a device/IP capture mechanism exists
 *                                                 upstream; see ReferralService for the gap note)
 *   PENDING -> BLOCKED_MONTHLY_CAP              (referrer exceeded LoyaltyProgramSettings
 *                                                 .referralMonthlyCapPerPatient for the calendar
 *                                                 month the referral was created in)
 */
export const REFERRAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  QUALIFIED: 'QUALIFIED',
  CREDITED: 'CREDITED',
  BLOCKED_SELF_REFERRAL: 'BLOCKED_SELF_REFERRAL',
  BLOCKED_DUPLICATE_DEVICE: 'BLOCKED_DUPLICATE_DEVICE',
  BLOCKED_MONTHLY_CAP: 'BLOCKED_MONTHLY_CAP',
});
export const REFERRAL_STATUS_LIST = Object.freeze(Object.values(REFERRAL_STATUS));

const referralSchema = new mongoose.Schema(
  {
    referrerPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    /** Null until a new patient actually registers/converts against this referrer's code. */
    refereePatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    /** The referrer's own stable code, captured on the referral rather than re-resolved later —
     *  so a referrer's code changing (should never happen, but defensively) never rewrites
     *  history. See ReferralService.codeForPatient for generation. */
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: REFERRAL_STATUS_LIST,
      default: REFERRAL_STATUS.PENDING,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    /** Staff user who entered the referral code on the patient's behalf (reception registration
     *  or CRM lead-conversion form). Null for self-service (patient portal / patient-supplied
     *  code at booking). Non-null triggers an AuditService record — see ReferralService. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /**
     * Anti-abuse device/IP signal. GAP: as of this build, no upstream registration/auth flow in
     * this codebase captures a device fingerprint or hashes the client IP anywhere the referral
     * flow can reuse (PatientService.create and PatientAuthService's OTP login take no such
     * input). These fields are kept present so the same-device anti-abuse check can be turned on
     * the moment that capture exists, but ReferralService currently never populates or checks
     * them — the BLOCKED_DUPLICATE_DEVICE status is defined but unreachable until then.
     */
    deviceFingerprint: { type: String, default: null },
    ipHash: { type: String, default: null },

    /** The invoice whose PAID event satisfied "first qualifying visit completed + paid". */
    qualifyingInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    creditedAt: { type: Date, default: null },
    blockedReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'referrals' }
);

/**
 * DEVIATION NOTE: the spec asks for "a unique index on referralCode". A referrer's code is
 * unique to THEM (see Patient.model.js#referralCode, which carries the actual `unique: true`
 * index — the source of truth), but one referrer creates MANY Referral documents over time (one
 * per person they refer), all sharing that same code string. A literal unique index on this
 * collection's referralCode field would therefore reject every referral after a referrer's
 * first. So uniqueness is enforced upstream on Patient.referralCode instead, and this field is
 * just a denormalized copy (kept so a Referral doc is self-contained even if the code were ever
 * regenerated) — indexed for lookup, not unique.
 */
referralSchema.index({ referralCode: 1 });
referralSchema.index({ referrerPatientId: 1, createdAt: -1 });
// A given referee can be the subject of at most one referral relationship.
referralSchema.index({ refereePatientId: 1 }, { unique: true, sparse: true });

referralSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    referrerPatientId: this.referrerPatientId?.toString?.() || this.referrerPatientId,
    refereePatientId: this.refereePatientId ? this.refereePatientId.toString() : null,
    referralCode: this.referralCode,
    status: this.status,
    branchId: this.branchId ? this.branchId.toString() : null,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    qualifyingInvoiceId: this.qualifyingInvoiceId ? this.qualifyingInvoiceId.toString() : null,
    creditedAt: this.creditedAt,
    blockedReason: this.blockedReason,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Referral = mongoose.model('Referral', referralSchema);

export default Referral;
