import { Router } from 'express';
import BillingController from '../../controllers/BillingController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { ROLES } from '../../constants/roles.js';
import { hasAnyPermission } from '../../helpers/permission.helper.js';
import ApiError from '../../libs/ApiError.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceIdParamSchema,
  paymentIdParamSchema,
  planIdParamSchema,
  invoiceListQuerySchema,
  recordPaymentSchema,
  refundSchema,
  applyCreditNoteSchema,
  creditNoteIdParamSchema,
  discountDecisionSchema,
  discountApprovalQueueQuerySchema,
  refundDecisionSchema,
  refundApprovalQueueQuerySchema,
  duePaymentsQuerySchema,
  voidDraftSchema,
  cancelInvoiceSchema,
  writeOffSchema,
  applyLoyaltyRedemptionSchema,
} from '../../validators/billing.validator.js';

const router = Router();
const controller = new BillingController();

const view = [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL];
const create = [PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_ALL];
const edit = [PERMISSIONS.BILLING_EDIT, PERMISSIONS.BILLING_ALL];
const finalize = [PERMISSIONS.BILLING_FINALIZE, PERMISSIONS.BILLING_ALL];
const payment = [PERMISSIONS.BILLING_PAYMENT, PERMISSIONS.BILLING_ALL];
const refund = [PERMISSIONS.BILLING_REFUND, PERMISSIONS.BILLING_ALL];
const print = [PERMISSIONS.BILLING_PRINT, PERMISSIONS.BILLING_ALL];
const discountApprove = [PERMISSIONS.BILLING_DISCOUNT_APPROVE, PERMISSIONS.BILLING_ALL];
const refundApprove = [PERMISSIONS.BILLING_REFUND_APPROVE, PERMISSIONS.BILLING_ALL];
/**
 * MON-002 — deliberately WITHOUT PERMISSIONS.BILLING_ALL. Every other billing capability accepts
 * the module wildcard, but cancelling an issued invoice and writing off a debt destroy
 * receivables, and a cashier holding `billing.*` must not inherit them: the person who raises and
 * collects an invoice cannot also be the person who makes it disappear. OWNER still passes, via
 * the role short-circuit in requirePermission.
 */
const voidFinalized = [PERMISSIONS.BILLING_VOID_FINALIZED];
const writeOff = [PERMISSIONS.BILLING_WRITE_OFF];
const loyaltyRedeem = [PERMISSIONS.LOYALTY_REDEEM, PERMISSIONS.BILLING_ALL];

router.use(authenticate);

router.get('/', requirePermission(...view), validate({ query: invoiceListQuerySchema }), controller.list);
router.post('/', requirePermission(...create), validate({ body: createInvoiceSchema }), controller.create);

router.post(
  '/from-plan/:planId',
  requirePermission(...create),
  validate({ params: planIdParamSchema }),
  controller.createFromPlan
);

router.get(
  '/payments/:paymentId/receipt',
  requirePermission(...print, ...view),
  validate({ params: paymentIdParamSchema }),
  controller.paymentReceipt
);

/**
 * A.8 — refunding needs billing.refund; settling the refund AS A CREDIT NOTE additionally needs
 * billing.credit_note, because that mints a new instrument redeemable against future invoices
 * rather than returning money. Body-dependent, so it cannot be a plain requirePermission.
 */
const requireCreditNoteWhenCreditNoteRefund = (req, _res, next) => {
  try {
    if (req.body?.method !== 'CREDIT_NOTE') return next();
    if (req.auth?.role === ROLES.OWNER) return next();
    const granted = req.auth?.permissions || [];
    if (!hasAnyPermission(granted, [PERMISSIONS.BILLING_CREDIT_NOTE, PERMISSIONS.BILLING_ALL])) {
      throw ApiError.forbidden('Issuing a credit note requires billing.credit_note');
    }
    next();
  } catch (error) {
    next(error);
  }
};

router.post(
  '/payments/:paymentId/refund',
  requirePermission(...refund),
  validate({ params: paymentIdParamSchema, body: refundSchema }),
  requireCreditNoteWhenCreditNoteRefund,
  controller.refund
);

router.post(
  '/credit-notes/:creditNoteId/apply',
  requirePermission(PERMISSIONS.BILLING_CREDIT_NOTE, PERMISSIONS.BILLING_ALL),
  validate({ params: creditNoteIdParamSchema, body: applyCreditNoteSchema }),
  controller.applyCreditNote
);

// A.4 — must stay above '/:id' so 'due-payments' is not swallowed as an invoice id.
router.get(
  '/due-payments',
  requirePermission(...view),
  validate({ query: duePaymentsQuerySchema }),
  controller.duePayments
);

// A.5 — must stay above '/:id' so 'discount-approvals' is not swallowed as an invoice id.
router.get(
  '/discount-approvals',
  requirePermission(...discountApprove),
  validate({ query: discountApprovalQueueQuerySchema }),
  controller.discountApprovalQueue
);

// A.8 — must stay above '/:id' so 'refund-approvals' is not swallowed as an invoice id.
router.get(
  '/refund-approvals',
  requirePermission(...refundApprove),
  validate({ query: refundApprovalQueueQuerySchema }),
  controller.refundApprovalQueue
);
router.post(
  '/refunds/:id/approve',
  requirePermission(...refundApprove),
  validate({ params: invoiceIdParamSchema, body: refundDecisionSchema }),
  controller.approveRefund
);
router.post(
  '/refunds/:id/reject',
  requirePermission(...refundApprove),
  validate({ params: invoiceIdParamSchema, body: refundDecisionSchema }),
  controller.rejectRefund
);

router.get(
  '/:id',
  requirePermission(...view),
  validate({ params: invoiceIdParamSchema }),
  controller.getById
);
router.patch(
  '/:id',
  requirePermission(...edit),
  validate({ params: invoiceIdParamSchema, body: updateInvoiceSchema }),
  controller.update
);
router.post(
  '/:id/void',
  requirePermission(...edit),
  validate({ params: invoiceIdParamSchema, body: voidDraftSchema }),
  controller.voidDraft
);
// MON-002 — a FINALIZED invoice is annulled here, not through '/:id/void' (which is draft-only
// by design: a draft was never issued, so voiding one is an edit, whereas cancelling an issued
// invoice is a control event).
router.post(
  '/:id/cancel',
  requirePermission(...voidFinalized),
  validate({ params: invoiceIdParamSchema, body: cancelInvoiceSchema }),
  controller.cancelFinalized
);
router.post(
  '/:id/write-off',
  requirePermission(...writeOff),
  validate({ params: invoiceIdParamSchema, body: writeOffSchema }),
  controller.writeOff
);
router.post(
  '/:id/finalize',
  requirePermission(...finalize),
  validate({ params: invoiceIdParamSchema }),
  controller.finalize
);
router.post(
  '/:id/approve-discount',
  requirePermission(...discountApprove),
  validate({ params: invoiceIdParamSchema, body: discountDecisionSchema }),
  controller.approveDiscount
);
router.post(
  '/:id/reject-discount',
  requirePermission(...discountApprove),
  validate({ params: invoiceIdParamSchema, body: discountDecisionSchema }),
  controller.rejectDiscount
);
router.post(
  '/:id/apply-loyalty-redemption',
  requirePermission(...loyaltyRedeem),
  validate({ params: invoiceIdParamSchema, body: applyLoyaltyRedemptionSchema }),
  controller.applyLoyaltyRedemption
);
router.post(
  '/:id/remove-loyalty-redemption',
  requirePermission(...loyaltyRedeem),
  validate({ params: invoiceIdParamSchema }),
  controller.removeLoyaltyRedemption
);
router.post(
  '/:id/payments',
  requirePermission(...payment),
  validate({ params: invoiceIdParamSchema, body: recordPaymentSchema }),
  controller.recordPayment
);
router.get(
  '/:id/payments',
  requirePermission(...view),
  validate({ params: invoiceIdParamSchema }),
  controller.listPayments
);
router.get(
  '/:id/print',
  requirePermission(...print, ...view),
  validate({ params: invoiceIdParamSchema }),
  controller.print
);
router.post(
  '/:id/email-placeholder',
  requirePermission(...edit, ...view),
  validate({ params: invoiceIdParamSchema }),
  controller.emailPlaceholder
);
router.post(
  '/:id/whatsapp-placeholder',
  requirePermission(...edit, ...view),
  validate({ params: invoiceIdParamSchema }),
  controller.whatsappPlaceholder
);

export default router;
