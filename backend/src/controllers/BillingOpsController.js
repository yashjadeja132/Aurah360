import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CashCloseService from '../services/CashCloseService.js';
import CashSessionService from '../services/CashSessionService.js';
import FeeScheduleService from '../services/FeeScheduleService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — row-level branch scoping.
 *
 * Both resources this controller serves carry a real branch dimension, and both were passing raw
 * `req.query` through: a CASHIER holding `billing.*` read (and could approve) every branch's daily
 * cash close, and any BILLING_VIEW holder read every branch's negotiated pricing. OWNER/ADMIN keep
 * organisation-wide reach (`resolveBranchScope` returns null for them).
 *
 * Single-record writes (`approveCashClose`, `deactivateFeeSchedule`) answer 404 rather than 403
 * when the row belongs to another branch — a 403 would confirm the id exists.
 */
class BillingOpsController {
  constructor() {
    this.cashCloseService = new CashCloseService();
    this.cashSessionService = new CashSessionService();
    this.feeScheduleService = new FeeScheduleService();
  }

  /** "Open cash for the day" — Operations → Cash → [Open cash] → {opening float} → [Confirm]. */
  openCashSession = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const session = await this.cashSessionService.openSession(req.body, req.auth.userId, req, branchId);
    return ApiResponse.created(res, { message: 'Cash session opened', data: { session } });
  });

  getCashSession = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const session = await this.cashSessionService.getTodaySession(
      query.branchId,
      query.date ? new Date(query.date) : new Date()
    );
    return ApiResponse.success(res, { message: 'Cash session retrieved', data: { session } });
  });

  submitCashClose = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const close = await this.cashCloseService.submit(req.body, req.auth.userId, req, branchId);
    return ApiResponse.created(res, { message: 'Cash close submitted', data: { close } });
  });

  approveCashClose = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const close = await this.cashCloseService.approve(req.params.id, req.auth.userId, req, branchId);
    return ApiResponse.success(res, { message: 'Cash close approved', data: { close } });
  });

  listCashCloses = asyncHandler(async (req, res) => {
    const closes = await this.cashCloseService.list(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Cash closes retrieved', data: { closes } });
  });

  createFeeSchedule = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const feeSchedule = await this.feeScheduleService.create(req.body, req.auth.userId, req, branchId);
    return ApiResponse.created(res, { message: 'Fee schedule created', data: { feeSchedule } });
  });

  listFeeSchedules = asyncHandler(async (req, res) => {
    const feeSchedules = await this.feeScheduleService.list(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Fee schedules retrieved', data: { feeSchedules } });
  });

  deactivateFeeSchedule = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const feeSchedule = await this.feeScheduleService.deactivate(req.params.id, req.auth.userId, branchId);
    return ApiResponse.success(res, { message: 'Fee schedule deactivated', data: { feeSchedule } });
  });

  /**
   * Price resolution is a pricing LOOKUP used while building an invoice, so it must answer for the
   * branch the caller is actually billing at — a scoped caller cannot probe another branch's rates
   * by aiming `?branchId=` elsewhere (`resolveBranchScope` rejects a widening branchId outright).
   */
  resolvePrice = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const result = await this.feeScheduleService.resolvePrice(
      query.serviceId,
      { branchId: query.branchId, doctorId: query.doctorId },
      Number(query.defaultPrice) || 0
    );
    return ApiResponse.success(res, { message: 'Price resolved', data: result });
  });
}

export default BillingOpsController;
