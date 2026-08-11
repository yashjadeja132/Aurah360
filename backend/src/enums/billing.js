export const INVOICE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
  VOID: 'VOID',
  CANCELLED: 'CANCELLED',
});

export const INVOICE_STATUS_LIST = Object.freeze(Object.values(INVOICE_STATUS));

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
  /**
   * MON-002 — the remaining balance was judged uncollectable and written off. Distinct from
   * CANCELLED (the invoice itself is annulled) and from PAID (money was actually received): the
   * revenue stays on the finalized invoice, the receivable does not. Without its own state a
   * written-off invoice would have to masquerade as PAID, which overstates collections.
   */
  WRITTEN_OFF: 'WRITTEN_OFF',
});

export const PAYMENT_STATUS_LIST = Object.freeze(Object.values(PAYMENT_STATUS));

export const INVOICE_ITEM_TYPE = Object.freeze({
  CONSULTATION: 'CONSULTATION',
  SERVICE: 'SERVICE',
  PACKAGE: 'PACKAGE',
  MEDICINE: 'MEDICINE',
  CONSUMABLES: 'CONSUMABLES',
});

export const INVOICE_ITEM_TYPE_LIST = Object.freeze(Object.values(INVOICE_ITEM_TYPE));

export const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  UPI: 'UPI',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  ADVANCE: 'ADVANCE',
  SPLIT: 'SPLIT',
});

export const PAYMENT_METHOD_LIST = Object.freeze(Object.values(PAYMENT_METHOD));

/**
 * Modes that carry no external instrument reference: CASH is settled in hand and SPLIT is only a
 * container whose legs each carry their own mode/reference. Every other mode is non-cash and needs a
 * reference number to stay reconcilable (PAY-04).
 */
export const REFERENCE_EXEMPT_PAYMENT_METHODS = Object.freeze([PAYMENT_METHOD.CASH, PAYMENT_METHOD.SPLIT]);

/** PAY-04 — true when the given payment mode must be recorded with a non-empty reference. */
export const paymentMethodRequiresReference = (method) =>
  Boolean(method) && !REFERENCE_EXEMPT_PAYMENT_METHODS.includes(method);

export const DISCOUNT_TYPE = Object.freeze({
  FLAT: 'FLAT',
  PERCENTAGE: 'PERCENTAGE',
});

export const DISCOUNT_TYPE_LIST = Object.freeze(Object.values(DISCOUNT_TYPE));

/**
 * Lifecycle of the discount-approval gate on a draft invoice (A.5). Only the MANUAL discount
 * (line-item discounts + the header discount) is measured against
 * config.billing.discountApprovalThresholdPercent — see BillingService #manualDiscountTotal.
 *
 * NOT_REQUIRED   — at or below the threshold; the discount applies normally.
 * PENDING_APPROVAL — above the threshold; finalize is blocked until an approver decides.
 * APPROVED       — an approver with billing.discount_approve cleared it; finalize is unblocked.
 * REJECTED       — an approver refused it; finalize stays blocked until the discount is edited.
 */
export const DISCOUNT_APPROVAL_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const DISCOUNT_APPROVAL_STATUS_LIST = Object.freeze(Object.values(DISCOUNT_APPROVAL_STATUS));

export const PAYMENT_RECORD_STATUS = Object.freeze({
  RECORDED: 'RECORDED',
  REFUNDED: 'REFUNDED',
  VOID: 'VOID',
});

export const PAYMENT_RECORD_STATUS_LIST = Object.freeze(Object.values(PAYMENT_RECORD_STATUS));

/** Domain event names for future subscribers (notifications, CRM, reports). */
export const BILLING_EVENTS = Object.freeze({
  INVOICE_CREATED: 'InvoiceCreated',
  INVOICE_FINALIZED: 'InvoiceFinalized',
  PAYMENT_RECORDED: 'PaymentRecorded',
  INVOICE_PAID: 'InvoicePaid',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  CASH_CLOSE_SUBMITTED: 'CashCloseSubmitted',
});

/** Real refund (BIL-002) — replaces the RC1 placeholder. */
export const REFUND_METHOD = Object.freeze({
  ORIGINAL_MODE: 'ORIGINAL_MODE',
  CASH: 'CASH',
  CREDIT_NOTE: 'CREDIT_NOTE',
});

export const REFUND_METHOD_LIST = Object.freeze(Object.values(REFUND_METHOD));

/**
 * A.8 — controlled reason list for a refund. `BillingService.refund` has always required *a*
 * reason; this is the vocabulary the HTTP layer accepts (see refundSchema), so refund reporting
 * can group by cause instead of parsing free text. Free-form detail goes in `notes`, which is
 * mandatory for OTHER.
 */
export const REFUND_REASON = Object.freeze({
  PATIENT_REQUEST: 'PATIENT_REQUEST',
  TREATMENT_DISCONTINUED: 'TREATMENT_DISCONTINUED',
  PACKAGE_CANCELLED: 'PACKAGE_CANCELLED',
  SERVICE_NOT_RENDERED: 'SERVICE_NOT_RENDERED',
  DUPLICATE_PAYMENT: 'DUPLICATE_PAYMENT',
  OVERCHARGE_CORRECTION: 'OVERCHARGE_CORRECTION',
  BILLING_ERROR: 'BILLING_ERROR',
  CLINICAL_CONTRAINDICATION: 'CLINICAL_CONTRAINDICATION',
  GOODWILL: 'GOODWILL',
  OTHER: 'OTHER',
});

export const REFUND_REASON_LIST = Object.freeze(Object.values(REFUND_REASON));

/**
 * A.8 — lifecycle of a refund request that exceeds config.billing.refundApprovalThresholdAmount.
 * Mirrors DISCOUNT_APPROVAL_STATUS / LOYALTY_ADJUSTMENT_STATUS: the requesting staff member
 * creates a RefundRequest PENDING_APPROVAL, and only an approver (BILLING_REFUND_APPROVE) can
 * move it to APPROVED (which then actually calls BillingService#refund) or REJECTED.
 */
export const REFUND_APPROVAL_STATUS = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const REFUND_APPROVAL_STATUS_LIST = Object.freeze(Object.values(REFUND_APPROVAL_STATUS));

/**
 * MON-002 — why a FINALIZED invoice was cancelled. A finalized invoice is a issued document, so
 * annulling one is a control event: the vocabulary exists so "how often do we issue wrong
 * invoices?" is answerable without parsing free text. Free-form detail goes in `note`.
 */
export const INVOICE_CANCEL_REASON = Object.freeze({
  BILLED_IN_ERROR: 'BILLED_IN_ERROR',
  DUPLICATE_INVOICE: 'DUPLICATE_INVOICE',
  SERVICE_NOT_RENDERED: 'SERVICE_NOT_RENDERED',
  WRONG_PATIENT: 'WRONG_PATIENT',
  PRICING_ERROR: 'PRICING_ERROR',
  OTHER: 'OTHER',
});

export const INVOICE_CANCEL_REASON_LIST = Object.freeze(Object.values(INVOICE_CANCEL_REASON));

/**
 * MON-002 — why an outstanding balance was declared uncollectable. Bad debt has to be
 * attributable: a write-off is revenue the clinic never collects, so the cause is the whole
 * point of recording it.
 */
export const WRITE_OFF_REASON = Object.freeze({
  BAD_DEBT: 'BAD_DEBT',
  PATIENT_UNTRACEABLE: 'PATIENT_UNTRACEABLE',
  GOODWILL: 'GOODWILL',
  SMALL_BALANCE: 'SMALL_BALANCE',
  INSURANCE_SHORTFALL: 'INSURANCE_SHORTFALL',
  DECEASED: 'DECEASED',
  OTHER: 'OTHER',
});

export const WRITE_OFF_REASON_LIST = Object.freeze(Object.values(WRITE_OFF_REASON));

/**
 * A.4 — aging buckets for the due-payments worklist, measured in days since the invoice date.
 * Boundaries live here (not in the page) so backend totals and frontend labels cannot drift.
 */
export const AGING_BUCKET = Object.freeze({
  CURRENT: 'CURRENT',
  DAYS_8_30: 'DAYS_8_30',
  DAYS_31_60: 'DAYS_31_60',
  DAYS_60_PLUS: 'DAYS_60_PLUS',
});

export const AGING_BUCKET_LIST = Object.freeze(Object.values(AGING_BUCKET));

/** Inclusive upper bound in days for each bucket; null = unbounded. */
export const AGING_BUCKET_MAX_DAYS = Object.freeze({
  [AGING_BUCKET.CURRENT]: 7,
  [AGING_BUCKET.DAYS_8_30]: 30,
  [AGING_BUCKET.DAYS_31_60]: 60,
  [AGING_BUCKET.DAYS_60_PLUS]: null,
});

/** Days since invoiceDate -> bucket key. */
export function agingBucketForDays(days) {
  const d = Number(days) || 0;
  if (d <= AGING_BUCKET_MAX_DAYS[AGING_BUCKET.CURRENT]) return AGING_BUCKET.CURRENT;
  if (d <= AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_8_30]) return AGING_BUCKET.DAYS_8_30;
  if (d <= AGING_BUCKET_MAX_DAYS[AGING_BUCKET.DAYS_31_60]) return AGING_BUCKET.DAYS_31_60;
  return AGING_BUCKET.DAYS_60_PLUS;
}

export const CREDIT_NOTE_STATUS = Object.freeze({
  ISSUED: 'ISSUED',
  PARTIALLY_USED: 'PARTIALLY_USED',
  FULLY_USED: 'FULLY_USED',
  EXPIRED: 'EXPIRED',
  VOID: 'VOID',
});

export const CREDIT_NOTE_STATUS_LIST = Object.freeze(Object.values(CREDIT_NOTE_STATUS));

/** The only states from which a credit note may still be spent. FULLY_USED has no balance left,
 *  EXPIRED is past its validity, VOID was revoked — none of them are money any more. */
export const CREDIT_NOTE_REDEEMABLE_STATUSES = Object.freeze([
  CREDIT_NOTE_STATUS.ISSUED,
  CREDIT_NOTE_STATUS.PARTIALLY_USED,
]);

/**
 * Cash close (BIL-003). `PENDING_OWNER_APPROVAL` — the spec's "may need Owner approver depending
 * on threshold": a variance whose absolute value exceeds
 * config.billing.cashCloseVarianceEscalationThresholdAmount cannot be approved by a
 * BRANCH_MANAGER (who normally holds BILLING_CASH_CLOSE_APPROVE) — only OWNER may clear it. A
 * variance within the threshold still requires a reason (DISPUTED→SUBMITTED path, unchanged) but
 * stays approvable at the branch level.
 */
export const CASH_CLOSE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  DISPUTED: 'DISPUTED',
  PENDING_OWNER_APPROVAL: 'PENDING_OWNER_APPROVAL',
});

export const CASH_CLOSE_STATUS_LIST = Object.freeze(Object.values(CASH_CLOSE_STATUS));

export default {
  INVOICE_STATUS,
  PAYMENT_STATUS,
  INVOICE_ITEM_TYPE,
  PAYMENT_METHOD,
  DISCOUNT_TYPE,
  BILLING_EVENTS,
  REFUND_METHOD,
  REFUND_REASON,
  INVOICE_CANCEL_REASON,
  WRITE_OFF_REASON,
  AGING_BUCKET,
  CREDIT_NOTE_STATUS,
  CASH_CLOSE_STATUS,
};
