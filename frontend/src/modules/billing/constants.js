export const INVOICE_STATUS_LABELS = Object.freeze({
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  VOID: 'Void',
  CANCELLED: 'Cancelled',
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
});

export const ITEM_TYPE_OPTIONS = Object.freeze([
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'PACKAGE', label: 'Package' },
  { value: 'MEDICINE', label: 'Medicine (future)' },
  { value: 'CONSUMABLES', label: 'Consumables (future)' },
]);

export const PAYMENT_METHOD_OPTIONS = Object.freeze([
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'SPLIT', label: 'Split' },
]);

/**
 * A.8 — mirrors the backend REFUND_REASON enum (backend/src/enums/billing.js). The server
 * rejects anything outside this list, so keep the two in step. `label` is the i18n default.
 */
export const REFUND_REASON_OPTIONS = Object.freeze([
  { value: 'PATIENT_REQUEST', label: 'Patient requested a refund' },
  { value: 'TREATMENT_DISCONTINUED', label: 'Treatment discontinued' },
  { value: 'PACKAGE_CANCELLED', label: 'Package cancelled' },
  { value: 'SERVICE_NOT_RENDERED', label: 'Service not rendered' },
  { value: 'DUPLICATE_PAYMENT', label: 'Duplicate payment' },
  { value: 'OVERCHARGE_CORRECTION', label: 'Overcharge correction' },
  { value: 'BILLING_ERROR', label: 'Billing error' },
  { value: 'CLINICAL_CONTRAINDICATION', label: 'Clinical contraindication' },
  { value: 'GOODWILL', label: 'Goodwill gesture' },
  { value: 'OTHER', label: 'Other (explain in notes)' },
]);

/** Mirrors the backend REFUND_METHOD enum. */
export const REFUND_MODE_OPTIONS = Object.freeze([
  { value: 'ORIGINAL_MODE', label: 'Back to original payment mode' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CREDIT_NOTE', label: 'Credit note (usable on a future invoice)' },
]);

/** A.4 — mirrors the backend AGING_BUCKET enum and its day boundaries. */
export const AGING_BUCKET_OPTIONS = Object.freeze([
  { value: 'CURRENT', label: 'Current (0–7 days)' },
  { value: 'DAYS_8_30', label: '8–30 days' },
  { value: 'DAYS_31_60', label: '31–60 days' },
  { value: 'DAYS_60_PLUS', label: '60+ days' },
]);

export const emptyItem = () => ({
  itemType: 'SERVICE',
  referenceId: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

export function formatMoney(n, currency = 'INR') {
  const value = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

export default {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
};
