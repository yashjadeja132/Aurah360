import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import BillingService from '../services/BillingService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';
import { ROLES } from '../constants/roles.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';

/**
 * SEC-030 — the three billing BROWSE lists (invoices, due payments, discount approvals) are
 * branch-scoped for every role except OWNER/ADMIN. They are NOT doctor-scoped: billing is a
 * cashier/reception function and an invoice is not owned by a doctor, so pinning them to a
 * doctorId would hide a branch's own ledger from the people who have to reconcile it.
 * Invoice reads by id (and payments/print) stay broad and audited.
 */
class BillingController {
  constructor() {
    this.service = new BillingService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, {
      message: 'Invoices retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  create = asyncHandler(async (req, res) => {
    const invoice = await this.service.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Invoice created', data: { invoice } });
  });

  createFromPlan = asyncHandler(async (req, res) => {
    const invoice = await this.service.createFromTreatmentPlan(
      req.params.planId,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, {
      message: 'Invoice created from treatment plan',
      data: { invoice },
    });
  });

  getById = asyncHandler(async (req, res) => {
    const invoice = await this.service.getById(req.params.id);
    return ApiResponse.success(res, { data: { invoice } });
  });

  update = asyncHandler(async (req, res) => {
    const invoice = await this.service.updateDraft(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Invoice updated', data: { invoice } });
  });

  voidDraft = asyncHandler(async (req, res) => {
    const invoice = await this.service.voidDraft(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Draft invoice voided', data: { invoice } });
  });

  cancelFinalized = asyncHandler(async (req, res) => {
    const invoice = await this.service.cancelFinalized(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Invoice cancelled', data: { invoice } });
  });

  writeOff = asyncHandler(async (req, res) => {
    const invoice = await this.service.writeOff(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Invoice balance written off', data: { invoice } });
  });

  finalize = asyncHandler(async (req, res) => {
    const invoice = await this.service.finalize(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Invoice finalized', data: { invoice } });
  });

  duePayments = asyncHandler(async (req, res) => {
    const result = await this.service.listDuePayments(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, {
      message: 'Due payments retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  discountApprovalQueue = asyncHandler(async (req, res) => {
    const result = await this.service.listDiscountApprovalQueue(
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, {
      message: 'Discount approvals retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  approveDiscount = asyncHandler(async (req, res) => {
    const invoice = await this.service.approveDiscount(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Discount approved', data: { invoice } });
  });

  rejectDiscount = asyncHandler(async (req, res) => {
    const invoice = await this.service.rejectDiscount(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Discount rejected', data: { invoice } });
  });

  recordPayment = asyncHandler(async (req, res) => {
    const invoice = await this.service.recordPayment(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Payment recorded', data: { invoice } });
  });

  listPayments = asyncHandler(async (req, res) => {
    const items = await this.service.listPayments(req.params.id);
    return ApiResponse.success(res, { data: items });
  });

  applyLoyaltyRedemption = asyncHandler(async (req, res) => {
    const invoice = await this.service.applyLoyaltyRedemption(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Loyalty redemption applied', data: { invoice } });
  });

  removeLoyaltyRedemption = asyncHandler(async (req, res) => {
    const invoice = await this.service.removeLoyaltyRedemption(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Loyalty redemption removed', data: { invoice } });
  });

  refund = asyncHandler(async (req, res) => {
    const canAutoApply =
      req.auth?.role === ROLES.OWNER ||
      hasAnyPermission(req.auth?.permissions || [], [
        PERMISSIONS.BILLING_REFUND_APPROVE,
        PERMISSIONS.BILLING_ALL,
      ]);
    const result = await this.service.requestRefund(
      req.params.paymentId,
      req.body,
      req.auth,
      req,
      canAutoApply
    );
    return ApiResponse.success(res, {
      message: result.status === 'PENDING_APPROVAL' ? 'Refund submitted for approval' : 'Refund recorded',
      data: result,
    });
  });

  refundApprovalQueue = asyncHandler(async (req, res) => {
    const result = await this.service.listRefundApprovalQueue(
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, {
      message: 'Refund approvals retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  approveRefund = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.service.approveRefund(req.params.id, req.body, req.auth.userId, req, branchId);
    return ApiResponse.success(res, { message: 'Refund approved', data: result });
  });

  rejectRefund = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.service.rejectRefund(req.params.id, req.body, req.auth.userId, req, branchId);
    return ApiResponse.success(res, { message: 'Refund rejected', data: result });
  });

  applyCreditNote = asyncHandler(async (req, res) => {
    const result = await this.service.applyCreditNote(
      req.params.creditNoteId,
      req.body.invoiceId,
      req.body.amount,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Credit note applied', data: result });
  });

  print = asyncHandler(async (req, res) => {
    const data = await this.service.getPrintData(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Print data ready', data });
  });

  paymentReceipt = asyncHandler(async (req, res) => {
    const data = await this.service.getPaymentReceipt(
      req.params.paymentId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Receipt ready', data });
  });

  emailPlaceholder = asyncHandler(async (req, res) => {
    const invoice = await this.service.markEmailPlaceholder(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Email placeholder marked', data: { invoice } });
  });

  whatsappPlaceholder = asyncHandler(async (req, res) => {
    const invoice = await this.service.markWhatsappPlaceholder(req.params.id, req.auth.userId);
    return ApiResponse.success(res, {
      message: 'WhatsApp placeholder marked',
      data: { invoice },
    });
  });
}

export default BillingController;
