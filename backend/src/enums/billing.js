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

export const DISCOUNT_TYPE = Object.freeze({
  FLAT: 'FLAT',
  PERCENTAGE: 'PERCENTAGE',
});

export const DISCOUNT_TYPE_LIST = Object.freeze(Object.values(DISCOUNT_TYPE));

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

export const CREDIT_NOTE_STATUS = Object.freeze({
  ISSUED: 'ISSUED',
  PARTIALLY_USED: 'PARTIALLY_USED',
  FULLY_USED: 'FULLY_USED',
  EXPIRED: 'EXPIRED',
  VOID: 'VOID',
});

export const CREDIT_NOTE_STATUS_LIST = Object.freeze(Object.values(CREDIT_NOTE_STATUS));

/** Cash close (BIL-003) */
export const CASH_CLOSE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  DISPUTED: 'DISPUTED',
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
  CREDIT_NOTE_STATUS,
  CASH_CLOSE_STATUS,
};
