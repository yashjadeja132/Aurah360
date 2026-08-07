import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AnalyticsFacadeService from '../services/analytics/AnalyticsFacadeService.js';

class AnalyticsController {
  constructor() {
    this.service = new AnalyticsFacadeService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(req.query, {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { data });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.service.getReport(req.params.category, req.query, {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { data });
  });

  export = asyncHandler(async (req, res) => {
    const format = req.query.format || 'csv';
    const result = await this.service.exportReport(req.params.category, format, req.query, {
      actorId: req.auth.userId,
      req,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    if (result.isBuffer) return res.status(200).send(result.body);
    return res.status(200).send(result.body);
  });

  queueExport = asyncHandler(async (req, res) => {
    const data = await this.service.queueHeavyExport(
      req.params.category,
      req.body?.format || req.query.format || 'csv',
      { ...req.query, ...(req.body?.filters || {}) },
      { actorId: req.auth.userId }
    );
    return ApiResponse.success(res, { statusCode: 202, message: 'Export queued', data });
  });
}

export default AnalyticsController;
