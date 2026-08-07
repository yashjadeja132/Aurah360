import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ReportService from '../services/ReportService.js';
import AnalyticsService from '../services/AnalyticsService.js';

class ReportController {
  constructor() {
    this.service = new ReportService();
    this.analyticsService = new AnalyticsService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(req.params.type, req.query, {
      userId: req.auth.userId,
      role: req.auth.role,
    });
    return ApiResponse.success(res, { data });
  });

  analytics = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.analyticsDashboard(req.query);
    return ApiResponse.success(res, { data });
  });

  kpis = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.kpis(req.query);
    return ApiResponse.success(res, { data });
  });

  chart = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.chart(req.params.type, req.query);
    return ApiResponse.success(res, { data });
  });

  generate = asyncHandler(async (req, res) => {
    const data = await this.service.generateReport(req.params.type, req.query, {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { message: 'Report generated', data });
  });

  exportReport = asyncHandler(async (req, res) => {
    const format = req.query.format || req.body?.format || 'csv';
    const result = await this.service.export(req.params.type, format, req.query, {
      actorId: req.auth.userId,
      req,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.body);
  });

  queueExport = asyncHandler(async (req, res) => {
    const data = await this.service.queueHeavyReport(
      req.params.type,
      req.body?.format || req.query.format || 'csv',
      { ...req.query, ...req.body?.filters },
      { actorId: req.auth.userId }
    );
    return ApiResponse.success(res, { statusCode: 202, message: 'Report queued', data });
  });

  getRun = asyncHandler(async (req, res) => {
    const data = await this.service.getReportRun(req.params.id);
    return ApiResponse.success(res, { data });
  });

  listScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.listScheduled(req.query);
    return ApiResponse.success(res, { data: data.items });
  });

  createScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.createScheduled(req.body, {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.created(res, { message: 'Scheduled report created', data });
  });

  updateScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.updateScheduled(req.params.id, req.body, {
      actorId: req.auth.userId,
    });
    return ApiResponse.success(res, { message: 'Scheduled report updated', data });
  });

  deleteScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.deleteScheduled(req.params.id);
    return ApiResponse.success(res, { message: 'Scheduled report deleted', data });
  });

  runDueScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.runDueScheduledReports();
    return ApiResponse.success(res, { message: 'Due schedules processed', data });
  });

  listSavedFilters = asyncHandler(async (req, res) => {
    const data = await this.service.listSavedFilters(req.auth.userId, req.query.scope);
    return ApiResponse.success(res, { data: data.items });
  });

  saveFilter = asyncHandler(async (req, res) => {
    const data = await this.service.saveFilter(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Filter saved', data });
  });

  deleteSavedFilter = asyncHandler(async (req, res) => {
    const data = await this.service.deleteSavedFilter(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Filter deleted', data });
  });
}

export default ReportController;
