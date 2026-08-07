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
