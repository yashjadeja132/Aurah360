import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import NotificationService from '../services/NotificationService.js';

class NotificationController {
  constructor() {
    this.service = new NotificationService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(req.query);
    return ApiResponse.success(res, {
      message: 'Notifications',
      data: result.items,
      meta: result.meta,
    });
  });

  inbox = asyncHandler(async (req, res) => {
    const result = await this.service.inbox(req.auth.userId, req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  unreadCount = asyncHandler(async (req, res) => {
    const data = await this.service.unreadCount(req.auth.userId);
    return ApiResponse.success(res, { data });
  });

  getById = asyncHandler(async (req, res) => {
    const notification = await this.service.getById(req.params.id);
    return ApiResponse.success(res, { data: { notification } });
  });

  markRead = asyncHandler(async (req, res) => {
    const notification = await this.service.markRead(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Marked read', data: { notification } });
  });

  markAllRead = asyncHandler(async (req, res) => {
    const data = await this.service.markAllRead(req.auth.userId);
    return ApiResponse.success(res, { message: 'All read', data });
  });

  archive = asyncHandler(async (req, res) => {
    const notification = await this.service.archive(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Archived', data: { notification } });
  });

  retry = asyncHandler(async (req, res) => {
    const notification = await this.service.retry(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Retry queued', data: { notification } });
  });

  processPending = asyncHandler(async (req, res) => {
    const data = await this.service.processPending(Number(req.query.limit) || 20);
    return ApiResponse.success(res, { message: 'Processed', data });
  });

  schedule = asyncHandler(async (req, res) => {
    const data = await this.service.queueEvent({
      ...req.body,
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.created(res, { message: 'Notification queued', data });
  });

  reports = asyncHandler(async (req, res) => {
    const data = await this.service.reports();
    return ApiResponse.success(res, { data });
  });

  listTemplates = asyncHandler(async (req, res) => {
    const result = await this.service.listTemplates(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  getTemplate = asyncHandler(async (req, res) => {
    const template = await this.service.getTemplate(req.params.id);
    return ApiResponse.success(res, { data: { template } });
  });

  createTemplate = asyncHandler(async (req, res) => {
    const template = await this.service.createTemplate(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Template created', data: { template } });
  });

  updateTemplate = asyncHandler(async (req, res) => {
    const template = await this.service.updateTemplate(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Template updated', data: { template } });
  });
}

export default NotificationController;
