/** Loyalty & Rewards module (LOY) — see aurah_loyalty_points_prd.md.
 *  All point values/rates/caps live in admin-configurable masters (LoyaltyEarningRule,
 *  LoyaltyProgramSettings) — nothing here is a point VALUE, only the fixed vocabulary the
 *  engine and ledger use (LOY-002: "no hard-coded values").
 */

/** Built-in earning-event types (E1–E12 in the PRD). Custom rules can reuse CUSTOM. */
export const LOYALTY_EARNING_EVENT = Object.freeze({
  VISIT_COMPLETED: 'VISIT_COMPLETED', // E1
  SPEND_BASED: 'SPEND_BASED', // E2
  TREATMENT_SESSION_COMPLETED: 'TREATMENT_SESSION_COMPLETED', // E3
  PACKAGE_PURCHASE: 'PACKAGE_PURCHASE', // E4
  REFERRAL_REFERRER: 'REFERRAL_REFERRER', // E5 (referrer side)
  REFERRAL_REFEREE: 'REFERRAL_REFEREE', // E5 (referee side)
  ON_TIME_FOLLOW_UP: 'ON_TIME_FOLLOW_UP', // E6
  APP_REGISTRATION: 'APP_REGISTRATION', // E7 (one-time)
  REVIEW_SUBMITTED: 'REVIEW_SUBMITTED', // E8
  BIRTHDAY_BONUS: 'BIRTHDAY_BONUS', // E9
  PROFILE_COMPLETION: 'PROFILE_COMPLETION', // E10 (one-time)
  CAMPAIGN_MULTIPLIER: 'CAMPAIGN_MULTIPLIER', // E11 (applied on top of another event)
  MANUAL_GOODWILL: 'MANUAL_GOODWILL', // E12
  CUSTOM: 'CUSTOM',
});
export const LOYALTY_EARNING_EVENT_LIST = Object.freeze(Object.values(LOYALTY_EARNING_EVENT));

/** Ledger entry types — append-only, mirrors StockTransaction.model.js's immutable pattern. */
export const LOYALTY_ENTRY_TYPE = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT_REDEEM: 'DEBIT_REDEEM',
  DEBIT_EXPIRY: 'DEBIT_EXPIRY',
  DEBIT_CLAWBACK: 'DEBIT_CLAWBACK',
  CREDIT_REVERSAL: 'CREDIT_REVERSAL',
  MANUAL_CREDIT: 'MANUAL_CREDIT',
  MANUAL_DEBIT: 'MANUAL_DEBIT',
});
export const LOYALTY_ENTRY_TYPE_LIST = Object.freeze(Object.values(LOYALTY_ENTRY_TYPE));

/** Entry types that increase balance (credits) vs decrease it (debits) — used by the ledger
 *  service to derive `points` sign consistently rather than trusting caller-supplied sign. */
export const LOYALTY_CREDIT_ENTRY_TYPES = Object.freeze([
  LOYALTY_ENTRY_TYPE.CREDIT,
  LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL,
  LOYALTY_ENTRY_TYPE.MANUAL_CREDIT,
]);

export const LOYALTY_SOURCE_REF_TYPE = Object.freeze({
  INVOICE: 'INVOICE',
  APPOINTMENT: 'APPOINTMENT',
  TREATMENT_SESSION: 'TREATMENT_SESSION',
  TREATMENT_PLAN: 'TREATMENT_PLAN',
  REFERRAL: 'REFERRAL',
  CAMPAIGN: 'CAMPAIGN',
  FEEDBACK: 'FEEDBACK',
  MANUAL: 'MANUAL',
});
export const LOYALTY_SOURCE_REF_TYPE_LIST = Object.freeze(Object.values(LOYALTY_SOURCE_REF_TYPE));

export const LOYALTY_POINT_FORMULA_TYPE = Object.freeze({
  FIXED: 'FIXED', // flat points per occurrence
  PER_AMOUNT: 'PER_AMOUNT', // N points per ₹X spent
  PERCENT_OF_AMOUNT: 'PERCENT_OF_AMOUNT', // % of amount as points
});
export const LOYALTY_POINT_FORMULA_TYPE_LIST = Object.freeze(Object.values(LOYALTY_POINT_FORMULA_TYPE));

export const LOYALTY_ROUNDING_RULE = Object.freeze({
  FLOOR: 'FLOOR',
  ROUND: 'ROUND',
  CEILING: 'CEILING',
});
export const LOYALTY_ROUNDING_RULE_LIST = Object.freeze(Object.values(LOYALTY_ROUNDING_RULE));

export const LOYALTY_ELIGIBILITY = Object.freeze({
  ALL_PATIENTS: 'ALL_PATIENTS',
  NEW_PATIENTS_ONLY: 'NEW_PATIENTS_ONLY',
  SPECIFIC_TIER: 'SPECIFIC_TIER',
  MINIMUM_VISITS: 'MINIMUM_VISITS',
});
export const LOYALTY_ELIGIBILITY_LIST = Object.freeze(Object.values(LOYALTY_ELIGIBILITY));

export const LOYALTY_MANUAL_REASON_CATEGORY = Object.freeze({
  SERVICE_RECOVERY: 'SERVICE_RECOVERY',
  CORRECTION: 'CORRECTION',
  PROMOTION: 'PROMOTION',
  OTHER: 'OTHER',
});
export const LOYALTY_MANUAL_REASON_CATEGORY_LIST = Object.freeze(
  Object.values(LOYALTY_MANUAL_REASON_CATEGORY)
);

export const LOYALTY_ADJUSTMENT_STATUS = Object.freeze({
  APPLIED: 'APPLIED', // within staff's own limit, no approval needed
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});
export const LOYALTY_ADJUSTMENT_STATUS_LIST = Object.freeze(Object.values(LOYALTY_ADJUSTMENT_STATUS));

/** Pending-clawback state when a refund/reversal would push balance negative (LOY-006). */
export const LOYALTY_CLAWBACK_STATUS = Object.freeze({
  COMPLETED: 'COMPLETED',
  PENDING_INSUFFICIENT_BALANCE: 'PENDING_INSUFFICIENT_BALANCE',
});
export const LOYALTY_CLAWBACK_STATUS_LIST = Object.freeze(Object.values(LOYALTY_CLAWBACK_STATUS));

export const LOYALTY_CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
});
export const LOYALTY_CAMPAIGN_STATUS_LIST = Object.freeze(Object.values(LOYALTY_CAMPAIGN_STATUS));

/** Domain events emitted by the loyalty engine — other modules (notifications) subscribe. */
export const LOYALTY_EVENTS = Object.freeze({
  POINTS_EARNED: 'LoyaltyPointsEarned',
  POINTS_REDEEMED: 'LoyaltyPointsRedeemed',
  POINTS_EXPIRING_SOON: 'LoyaltyPointsExpiringSoon',
  POINTS_EXPIRED: 'LoyaltyPointsExpired',
  CLAWBACK_PENDING: 'LoyaltyClawbackPending',
  TIER_CHANGED: 'LoyaltyTierChanged',
  ADJUSTMENT_PENDING_APPROVAL: 'LoyaltyAdjustmentPendingApproval',
});
