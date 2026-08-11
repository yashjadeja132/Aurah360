import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AppointmentService from '../services/AppointmentService.js';
import AppointmentLifecycleService from '../services/AppointmentLifecycleService.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — the three BROWSE endpoints here (list, doctorCalendar, listWaitlist) are row-scoped
 * to the caller's branch and, for a DOCTOR, to their own doctorId (see scope.helper.js).
 * `getById` and `patientHistory` are deliberately left broad: a doctor covering a colleague or
 * handling an emergency must be able to open a specific appointment/patient history, which is
 * the same "broad read, strongly audited" model the break-glass mechanism assumes.
 */
class AppointmentController {
  constructor() {
    this.appointmentService = new AppointmentService();
    this.lifecycleService = new AppointmentLifecycleService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.appointmentService.list(
      await scopedListQuery(req, { branch: true, doctor: true })
    );
    return ApiResponse.success(res, {
      message: 'Appointments retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.getById(req.params.id);
    return ApiResponse.success(res, { data: { appointment } });
  });

  create = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Appointment created', data: { appointment } });
  });

  update = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Appointment updated', data: { appointment } });
  });

  availableSlots = asyncHandler(async (req, res) => {
    const result = await this.appointmentService.getAvailableSlots(
      req.query.doctorId,
      new Date(req.query.date),
      req.query.branchId
    );
    return ApiResponse.success(res, { data: result });
  });

  doctorCalendar = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    const items = await this.appointmentService.doctorCalendar(
      scoped.doctorId,
      new Date(scoped.from),
      new Date(scoped.to),
      scoped.branchId || null
    );
    return ApiResponse.success(res, { data: items });
  });

  patientHistory = asyncHandler(async (req, res) => {
    const items = await this.appointmentService.patientHistory(req.params.patientId);
    return ApiResponse.success(res, { data: items });
  });

  confirm = asyncHandler(async (req, res) => {
    const appointment = await this.lifecycleService.confirm(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Appointment confirmed', data: { appointment } });
  });

  cancel = asyncHandler(async (req, res) => {
    const appointment = await this.lifecycleService.cancel(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Appointment cancelled', data: { appointment } });
  });

  noShow = asyncHandler(async (req, res) => {
    const appointment = await this.lifecycleService.markNoShow(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Marked as no-show', data: { appointment } });
  });

  complete = asyncHandler(async (req, res) => {
    const appointment = await this.lifecycleService.complete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Appointment completed', data: { appointment } });
  });

  reschedule = asyncHandler(async (req, res) => {
    const result = await this.lifecycleService.reschedule(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, {
      message: 'Appointment rescheduled',
      data: result,
    });
  });

  followUp = asyncHandler(async (req, res) => {
    const appointment = await this.lifecycleService.createFollowUp(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, {
      message: 'Follow-up appointment created',
      data: { appointment },
    });
  });

  softDelete = asyncHandler(async (req, res) => {
    await this.lifecycleService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Appointment deleted' });
  });

  decideApproval = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.decideApproval(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Approval decision recorded', data: { appointment } });
  });

  acceptAlternative = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.acceptAlternative(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Alternative slot accepted', data: { appointment } });
  });

  addToWaitlist = asyncHandler(async (req, res) => {
    const entry = await this.appointmentService.addToWaitlist(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Added to waitlist', data: { entry } });
  });

  listWaitlist = asyncHandler(async (req, res) => {
    const entries = await this.appointmentService.listWaitlist(
      await scopedListQuery(req, { branch: true, doctor: true })
    );
    return ApiResponse.success(res, { message: 'Waitlist retrieved', data: { entries } });
  });

  offerWaitlistSlot = asyncHandler(async (req, res) => {
    const entry = await this.appointmentService.offerWaitlistSlot(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Slot offered', data: { entry } });
  });

  convertWaitlist = asyncHandler(async (req, res) => {
    const appointment = await this.appointmentService.convertWaitlistToAppointment(
      req.params.id,
      req.body || {},
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Waitlist entry converted', data: { appointment } });
  });
}

export default AppointmentController;
