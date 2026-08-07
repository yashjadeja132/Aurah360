import { z } from 'zod';
import {
  DISCOUNT_TYPE_LIST,
  INVOICE_ITEM_TYPE_LIST,
  INVOICE_STATUS_LIST,
  PAYMENT_METHOD_LIST,
  PAYMENT_STATUS_LIST,
} from '../enums/billing.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const invoiceItemSchema = z.object({
  itemType: z.enum(INVOICE_ITEM_TYPE_LIST),
  referenceId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  total: z.coerce.number().min(0).optional(),
});

export const createInvoiceSchema = z.object({
  patientId: objectId,
  branchId: objectId,
  doctorId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  consultationId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  treatmentPlanId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  appointmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  invoiceDate: z.coerce.date().optional(),
  items: z.array(invoiceItemSchema).min(1),
  discountType: z.enum(DISCOUNT_TYPE_LIST).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  // discountApprovalRequired/discountApproved are computed server-side and cannot be set by the caller.
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
  packageSnapshot: z
    .object({
      packageId: z.preprocess(emptyToNull, objectId.nullable().optional()),
      packageName: z.string().optional().nullable(),
      packagePrice: z.coerce.number().optional().nullable(),
      discount: z.coerce.number().optional().nullable(),
      validityDays: z.coerce.number().optional().nullable(),
      maximumSessions: z.coerce.number().optional().nullable(),
      unusedSessions: z.coerce.number().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const updateInvoiceSchema = z.object({
  doctorId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  consultationId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  appointmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  items: z.array(invoiceItemSchema).min(1).optional(),
  discountType: z.enum(DISCOUNT_TYPE_LIST).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  // discountApprovalRequired/discountApproved are computed server-side and cannot be set by the caller.
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const approveDiscountSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const voidDraftSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const invoiceIdParamSchema = z.object({ id: objectId });
export const paymentIdParamSchema = z.object({ paymentId: objectId });
export const planIdParamSchema = z.object({ planId: objectId });

export const invoiceListQuerySchema = z.object({
  branchId: objectId.optional(),
  patientId: objectId.optional(),
  status: z.enum(INVOICE_STATUS_LIST).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_LIST).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const paymentSplitSchema = z.object({
  method: z.enum(PAYMENT_METHOD_LIST),
  amount: z.coerce.number().min(0),
  reference: z.string().max(200).optional().nullable(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0).optional(),
  method: z.enum(PAYMENT_METHOD_LIST).optional(),
  splits: z.array(paymentSplitSchema).optional(),
  isAdvance: z.boolean().optional(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  paidAt: z.coerce.date().optional(),
});

export const refundSchema = z.object({
  amount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
  reason: z.string().min(1).max(500),
  method: z.enum(['ORIGINAL_MODE', 'CASH', 'CREDIT_NOTE']).optional(),
  creditNoteExpiresAt: z.coerce.date().optional().nullable(),
});

export const applyLoyaltyRedemptionSchema = z.object({
  points: z.coerce.number().int().positive(),
});

export const applyCreditNoteSchema = z.object({
  invoiceId: z.string().regex(/^[a-f\d]{24}$/i),
  amount: z.coerce.number().positive(),
});

export const creditNoteIdParamSchema = z.object({
  creditNoteId: z.string().regex(/^[a-f\d]{24}$/i),
});
