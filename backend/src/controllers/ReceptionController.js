import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ReceptionService from '../services/ReceptionService.js';

class ReceptionController {
  constructor() {
    this.receptionService = new ReceptionService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.receptionService.receptionDashboard({
      branchId: req.query.branchId,
      date: req.query.date ? new Date(req.query.date) : new Date(),
    });
    return ApiResponse.success(res, { message: 'Reception dashboard', data });
  });

  todaysAppointments = asyncHandler(async (req, res) => {
    const items = await this.receptionService.todaysAppointments({
      branchId: req.query.branchId,
      doctorId: req.query.doctorId || null,
      date: req.query.date ? new Date(req.query.date) : new Date(),
      search: req.query.search || null,
    });
    return ApiResponse.success(res, { data: items });
  });

  checkIn = asyncHandler(async (req, res) => {
    const result = await this.receptionService.checkIn(
      req.params.appointmentId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Patient checked in', data: result });
  });

  undoCheckIn = asyncHandler(async (req, res) => {
    const appointment = await this.receptionService.undoCheckIn(
      req.params.appointmentId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Check-in undone', data: { appointment } });
  });

  walkIn = asyncHandler(async (req, res) => {
    const result = await this.receptionService.walkIn(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Walk-in registered', data: result });
  });
}

export default ReceptionController;
