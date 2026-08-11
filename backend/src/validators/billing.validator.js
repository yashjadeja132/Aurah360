import { z } from 'zod';
import {
  AGING_BUCKET_LIST,
  DISCOUNT_APPROVAL_STATUS_LIST,
  REFUND_APPROVAL_STATUS_LIST,
  REFUND_METHOD_LIST,
  REFUND_REASON,
  REFUND_REASON_LIST,
  DISCOUNT_TYPE_LIST,
  INVOICE_CANCEL_REASON_LIST,
  INVOICE_ITEM_TYPE_LIST,
  INVOICE_STATUS_LIST,
  WRITE_OFF_REASON_LIST,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LIST,
  paymentMethodRequiresReference,
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
  // `tax`, `taxPercent` and `total` are NOT accepted. The GST rate for each line is derived
  // server-side from the item master (InventoryItem.gstPercent) or the service's fee schedule,
  // and the amounts follow from it — see BillingService#resolveLineTaxRates and
  // helpers/invoiceTax.helper.js. Accepting them here previously let a caller name its own tax
  // rate; the value was then silently overwritten by a pro-rata reallocation, which was both
  // confusing and, on a mixed-rate invoice, wrong.
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
  // Mandatory only when the discount exceeds the configured threshold — that check needs the
  // computed subtotal, so it lives in BillingService (#assertDiscountReason).
  discountReason: z.string().max(500).optional().nullable(),
  // discountApprovalStatus/discountApprovalRequired/discountApproved are computed server-side and cannot be set by the caller.
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
  // Mandatory only above the threshold — enforced in BillingService (#assertDiscountReason).
  discountReason: z.string().max(500).optional().nullable(),
  // discountApprovalStatus/discountApprovalRequired/discountApproved are computed server-side and cannot be set by the caller.
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Approve/reject both take the approver's decision note. `reason` is this endpoint's original
 * field name; `decisionNote` matches the approval-queue vocabulary used by loyalty. Either
 * satisfies the requirement — BillingService reads whichever is present.
 */
export const discountDecisionSchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
    decisionNote: z.string().min(1).max(500).optional(),
  })
  .refine((v) => Boolean(v.reason?.trim() || v.decisionNote?.trim()), {
    message: 'A decision note is required',
    path: ['decisionNote'],
  });

/** @deprecated kept as an alias so existing imports of the approve-only schema keep working. */
export const approveDiscountSchema = discountDecisionSchema;

export const discountApprovalQueueQuerySchema = z.object({
  status: z.enum(DISCOUNT_APPROVAL_STATUS_LIST).optional(),
  branchId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const voidDraftSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * MON-002 — cancelling an ISSUED invoice and writing off a balance are both control events, so
 * the reason comes from a controlled list (reportable by cause) and OTHER must be explained.
 * The write-off AMOUNT is deliberately absent: it is derived from the payment ledger server-side,
 * because a client-named write-off amount is a client-named revenue reduction.
 */
const controlReasonSchema = (reasons) =>
  z
    .object({
      reason: z.enum(reasons, { errorMap: () => ({ message: 'A reason is required' }) }),
      note: z.string().max(500).optional().nullable(),
    })
    .superRefine((val, ctx) => {
      if (val.reason === 'OTHER' && !String(val.note ?? '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['note'],
          message: 'A note is required when the reason is OTHER',
        });
      }
    });

export const cancelInvoiceSchema = controlReasonSchema(INVOICE_CANCEL_REASON_LIST);
export const writeOffSchema = controlReasonSchema(WRITE_OFF_REASON_LIST);

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

/** PAY-04 — non-cash modes are unreconcilable without a reference number. */
const referenceMissing = (reference) => !String(reference ?? '').trim();

export const paymentSplitSchema = z
  .object({
    method: z.enum(PAYMENT_METHOD_LIST),
    amount: z.coerce.number().min(0),
    reference: z.string().max(200).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (paymentMethodRequiresReference(val.method) && referenceMissing(val.reference)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: `Reference is required for ${val.method} payments`,
      });
    }
  });

export const recordPaymentSchema = z
  .object({
    amount: z.coerce.number().min(0).optional(),
    method: z.enum(PAYMENT_METHOD_LIST).optional(),
    splits: z.array(paymentSplitSchema).optional(),
    isAdvance: z.boolean().optional(),
    reference: z.string().max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    paidAt: z.coerce.date().optional(),
    /** MON-001 — a client-generated key so a retried collection (flaky network, double-clicked
     *  "Record payment") replays the original payment instead of taking the money twice. */
    idempotencyKey: z.string().min(8).max(120).optional(),
  })
  .superRefine((val, ctx) => {
    // Split payments carry their reference per leg (validated by paymentSplitSchema).
    if (val.method === PAYMENT_METHOD.SPLIT || (val.splits && val.splits.length > 0)) return;
    if (paymentMethodRequiresReference(val.method) && referenceMissing(val.reference)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: `Reference is required for ${val.method} payments`,
      });
    }
  });

/**
 * A.8 — the refund reason is mandatory and drawn from a controlled list (REFUND_REASON) so
 * refunds can be reported on by cause. BillingService.refund still accepts any non-empty reason
 * (internal/script callers predate this list); this schema is the HTTP contract.
 */
export const refundSchema = z
  .object({
    amount: z.coerce.number().min(0).optional(),
    notes: z.string().max(1000).optional().nullable(),
    reason: z.enum(REFUND_REASON_LIST, {
      errorMap: () => ({ message: 'A refund reason is required' }),
    }),
    method: z.enum(REFUND_METHOD_LIST).optional(),
    creditNoteExpiresAt: z.coerce.date().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // OTHER carries no information on its own — force the cashier to say what happened.
    if (val.reason === REFUND_REASON.OTHER && !String(val.notes ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notes'],
        message: 'Notes are required when the refund reason is OTHER',
      });
    }
  });

/**
 * A.8 — approve/reject a queued refund request. `reason` is accepted as an alias of
 * `decisionNote` for symmetry with discountDecisionSchema; BillingService reads either.
 */
export const refundDecisionSchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
    decisionNote: z.string().min(1).max(500).optional(),
  })
  .refine((v) => Boolean(v.reason?.trim() || v.decisionNote?.trim()), {
    message: 'A decision note is required',
    path: ['decisionNote'],
  });

export const refundApprovalQueueQuerySchema = z.object({
  status: z.enum(REFUND_APPROVAL_STATUS_LIST).optional(),
  branchId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** A.4 — due-payments worklist filters. */
export const duePaymentsQuerySchema = z.object({
  branchId: objectId.optional(),
  patientId: objectId.optional(),
  bucket: z.enum(AGING_BUCKET_LIST).optional(),
  search: z.string().optional(),
  /** Restrict to patients with a CHECKED_IN appointment today (collect while they are here). */
  checkedInToday: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const applyLoyaltyRedemptionSchema = z.object({
  points: z.coerce.number().int().positive(),
  /** LOY-005 — a client-generated key so a retried apply (flaky network, double-clicked button)
   *  replays the original redemption instead of spending the patient's points a second time. */
  idempotencyKey: z.string().min(8).max(120).optional(),
  /** LOY-005 — identity confirmation gate. Required (true) whenever
   *  LoyaltyProgramSettings.redemptionIdentityConfirmation is not 'NONE'; enforced server-side in
   *  LoyaltyLedgerService.redeem(), not just here — this is the request-shape check only. */
  identityConfirmed: z.boolean().optional(),
  /** Required (true) only when redemptionIdentityConfirmation = 'OTP'. This flags "an OTP was
   *  verified elsewhere"; actually sending/checking the OTP code is out of scope for this pass. */
  otpVerified: z.boolean().optional(),
});

export const applyCreditNoteSchema = z.object({
  invoiceId: z.string().regex(/^[a-f\d]{24}$/i),
  amount: z.coerce.number().positive(),
});

export const creditNoteIdParamSchema = z.object({
  creditNoteId: z.string().regex(/^[a-f\d]{24}$/i),
});
