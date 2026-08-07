import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CashCloseService from '../services/CashCloseService.js';
import FeeScheduleService from '../services/FeeScheduleService.js';

class BillingOpsController {
  constructor() {
    this.cashCloseService = new CashCloseService();
    this.feeScheduleService = new FeeScheduleService();
  }

  submitCashClose = asyncHandler(async (req, res) => {
    const close = await this.cashCloseService.submit(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Cash close submitted', data: { close } });
  });

  approveCashClose = asyncHandler(async (req, res) => {
    const close = await this.cashCloseService.approve(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Cash close approved', data: { close } });
  });

  listCashCloses = asyncHandler(async (req, res) => {
    const closes = await this.cashCloseService.list(req.query);
    return ApiResponse.success(res, { message: 'Cash closes retrieved', data: { closes } });
  });

  createFeeSchedule = asyncHandler(async (req, res) => {
    const feeSchedule = await this.feeScheduleService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Fee schedule created', data: { feeSchedule } });
  });

  listFeeSchedules = asyncHandler(async (req, res) => {
    const feeSchedules = await this.feeScheduleService.list(req.query);
    return ApiResponse.success(res, { message: 'Fee schedules retrieved', data: { feeSchedules } });
  });

  deactivateFeeSchedule = asyncHandler(async (req, res) => {
    const feeSchedule = await this.feeScheduleService.deactivate(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Fee schedule deactivated', data: { feeSchedule } });
  });

  resolvePrice = asyncHandler(async (req, res) => {
    const result = await this.feeScheduleService.resolvePrice(
      req.query.serviceId,
      { branchId: req.query.branchId, doctorId: req.query.doctorId },
      Number(req.query.defaultPrice) || 0
    );
    return ApiResponse.success(res, { message: 'Price resolved', data: result });
  });
}

export default BillingOpsController;
