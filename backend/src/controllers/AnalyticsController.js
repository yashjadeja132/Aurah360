import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AnalyticsFacadeService from '../services/analytics/AnalyticsFacadeService.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-001 — analytics shares the fail-open defect described in ReportController: a branch filter
 * was honoured only when the caller supplied one, so omitting `branchId` returned organisation-wide
 * figures. Scope is forced at the boundary here for the same reason given there — a fix inside the
 * shared filter helper would have to be remembered at every call site.
 */
class AnalyticsController {
  constructor() {
    this.service = new AnalyticsFacadeService();
  }

  /** Every analytics query passes through here — see the class docblock. */
  #scoped(req) {
    return scopedListQuery(req, { branch: true, doctor: true });
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(await this.#scoped(req), {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { data });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.service.getReport(req.params.category, await this.#scoped(req), {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { data });
  });

  export = asyncHandler(async (req, res) => {
    const format = req.query.format || 'csv';
    const result = await this.service.exportReport(req.params.category, format, await this.#scoped(req), {
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
      { ...(await this.#scoped(req)), ...(req.body?.filters || {}) },
      { actorId: req.auth.userId }
    );
    return ApiResponse.success(res, { statusCode: 202, message: 'Export queued', data });
  });
}

export default AnalyticsController;
