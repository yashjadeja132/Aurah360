import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CrmService from '../services/CrmService.js';
import {
  scopedListQuery,
  resolveRecordScope,
  resolveBranchScope,
} from '../helpers/scope.helper.js';

/**
 * SEC-030 — CRM is branch-scoped. `Lead.branchId` is required on every row, so pinning it
 * hides nothing from the branch that owns the lead.
 *
 * The leak this closes is a marketing/PII one rather than a clinical one, and it was total: a
 * RECEPTIONIST or CRM_EXECUTIVE at one site read every lead in the organisation — name, phone,
 * email, budget, interested services, assigned counsellor — plus the dashboard, pipeline board
 * and conversion reports for every other branch, and could aim `?branchId=<other>` at any of
 * them. Lead lists are precisely the data a departing employee walks out with.
 *
 * TASKS have no branchId of their own; they hang off a lead (`LeadTask.leadId`) and inherit
 * that lead's branch, so the task list resolves the caller's leads first and filters to them.
 *
 * Single-record reads and writes answer 404 for an out-of-branch lead, never 403 — a 403 would
 * confirm the lead exists, which is the fact the scope is protecting.
 */
class CrmController {
  constructor() {
    this.service = new CrmService();
  }

  dashboard = asyncHandler(async (req, res) => {
    return ApiResponse.success(res, { data: await this.service.dashboard(resolveBranchScope(req)) });
  });

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, {
      message: 'Leads retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  pipeline = asyncHandler(async (req, res) => {
    return ApiResponse.success(res, { data: await this.service.pipeline(resolveBranchScope(req)) });
  });

  create = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const lead = await this.service.create(req.body, req.auth.userId, req, { branchId });
    return ApiResponse.created(res, { message: 'Lead created', data: { lead } });
  });

  getById = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const lead = await this.service.getById(req.params.id, scope);
    return ApiResponse.success(res, { data: { lead } });
  });

  update = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const lead = await this.service.update(req.params.id, req.body, req.auth.userId, scope);
    return ApiResponse.success(res, { message: 'Lead updated', data: { lead } });
  });

  assign = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const lead = await this.service.assign(req.params.id, req.body, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Lead assigned', data: { lead } });
  });

  changeStatus = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const lead = await this.service.changeStatus(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Status updated', data: { lead } });
  });

  addFollowUp = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const data = await this.service.addFollowUp(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.created(res, { message: 'Follow-up added', data });
  });

  convert = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const data = await this.service.convert(req.params.id, req.body, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Lead converted to patient', data });
  });

  logCommunication = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const data = await this.service.logCommunication(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Communication logged (placeholder)', data });
  });

  listTasks = asyncHandler(async (req, res) => {
    const result = await this.service.listTasks(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createTask = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const task = await this.service.createTask(req.body, req.auth.userId, scope);
    return ApiResponse.created(res, { message: 'Task created', data: { task } });
  });

  updateTask = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const task = await this.service.updateTask(req.params.id, req.body, req.auth.userId, scope);
    return ApiResponse.success(res, { message: 'Task updated', data: { task } });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.service.reports(
      req.params.type,
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, { data });
  });

  /** Manual trigger for smoke/testing BullMQ reminder scan */
  runReminders = asyncHandler(async (req, res) => {
    const data = await this.service.processFollowUpReminders();
    return ApiResponse.success(res, { message: 'Reminders processed', data });
  });
}

export default CrmController;
