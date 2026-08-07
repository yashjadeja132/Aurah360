import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import BillingService from '../services/BillingService.js';

class BillingController {
  constructor() {
    this.service = new BillingService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(req.query);
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

  finalize = asyncHandler(async (req, res) => {
    const invoice = await this.service.finalize(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Invoice finalized', data: { invoice } });
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
    const result = await this.service.refund(req.params.paymentId, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Refund recorded', data: result });
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
