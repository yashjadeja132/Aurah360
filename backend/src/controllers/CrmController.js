import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CrmService from '../services/CrmService.js';

class CrmController {
  constructor() {
    this.service = new CrmService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(req.query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(req.query);
    return ApiResponse.success(res, {
      message: 'Leads retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  pipeline = asyncHandler(async (req, res) => {
    const data = await this.service.pipeline(req.query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  create = asyncHandler(async (req, res) => {
    const lead = await this.service.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Lead created', data: { lead } });
  });

  getById = asyncHandler(async (req, res) => {
    const lead = await this.service.getById(req.params.id);
    return ApiResponse.success(res, { data: { lead } });
  });

  update = asyncHandler(async (req, res) => {
    const lead = await this.service.update(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Lead updated', data: { lead } });
  });

  assign = asyncHandler(async (req, res) => {
    const lead = await this.service.assign(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Lead assigned', data: { lead } });
  });

  changeStatus = asyncHandler(async (req, res) => {
    const lead = await this.service.changeStatus(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Status updated', data: { lead } });
  });

  addFollowUp = asyncHandler(async (req, res) => {
    const data = await this.service.addFollowUp(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Follow-up added', data });
  });

  convert = asyncHandler(async (req, res) => {
    const data = await this.service.convert(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Lead converted to patient', data });
  });

  logCommunication = asyncHandler(async (req, res) => {
    const data = await this.service.logCommunication(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Communication logged (placeholder)', data });
  });

  listTasks = asyncHandler(async (req, res) => {
    const result = await this.service.listTasks(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createTask = asyncHandler(async (req, res) => {
    const task = await this.service.createTask(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Task created', data: { task } });
  });

  updateTask = asyncHandler(async (req, res) => {
    const task = await this.service.updateTask(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Task updated', data: { task } });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.service.reports(req.params.type, req.query);
    return ApiResponse.success(res, { data });
  });

  /** Manual trigger for smoke/testing BullMQ reminder scan */
  runReminders = asyncHandler(async (req, res) => {
    const data = await this.service.processFollowUpReminders();
    return ApiResponse.success(res, { message: 'Reminders processed', data });
  });
}

export default CrmController;
