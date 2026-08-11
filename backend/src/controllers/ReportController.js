import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ReportService from '../services/ReportService.js';
import AnalyticsService from '../services/AnalyticsService.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-001 — the reporting stack used to FAIL OPEN.
 *
 * `parseReportFilters()` applies a branch match only IF the caller supplied `branchId`, and it
 * never saw `req.auth`. So *omitting* the parameter returned organisation-wide figures, and a
 * DOCTOR could read a colleague's book with `?doctorId=`. Reporting is the one surface that
 * aggregates everything — revenue, dues, patient volumes, PHI samples — so an unscoped default
 * there leaks more than any single list endpoint.
 *
 * Scope is therefore applied HERE, at the controller boundary, rather than inside
 * `parseReportFilters`: there are 13 call sites of that helper across the analytics services, and
 * a fix that each caller must remember to opt into is a fix that will be forgotten by the
 * fourteenth. Passing an already-scoped query means unscoped input cannot reach a service at all.
 *
 * `doctor: true` pins a DOCTOR to their own doctorId; `resolveDoctorScope` returns null for every
 * other role, so a receptionist filtering by doctor is unaffected. OWNER/ADMIN keep full reach,
 * including the deliberate org-wide view when they omit `branchId`.
 */
class ReportController {
  constructor() {
    this.service = new ReportService();
    this.analyticsService = new AnalyticsService();
  }

  /** Every report query passes through here — see the class docblock. */
  #scoped(req) {
    return scopedListQuery(req, { branch: true, doctor: true });
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(req.params.type, await this.#scoped(req), {
      userId: req.auth.userId,
      role: req.auth.role,
    });
    return ApiResponse.success(res, { data });
  });

  analytics = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.analyticsDashboard(await this.#scoped(req));
    return ApiResponse.success(res, { data });
  });

  kpis = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.kpis(await this.#scoped(req));
    return ApiResponse.success(res, { data });
  });

  chart = asyncHandler(async (req, res) => {
    const data = await this.analyticsService.chart(req.params.type, await this.#scoped(req));
    return ApiResponse.success(res, { data });
  });

  generate = asyncHandler(async (req, res) => {
    const data = await this.service.generateReport(req.params.type, await this.#scoped(req), {
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { message: 'Report generated', data });
  });

  exportReport = asyncHandler(async (req, res) => {
    const format = req.query.format || req.body?.format || 'csv';
    const result = await this.service.export(req.params.type, format, await this.#scoped(req), {
      actorId: req.auth.userId,
      req,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.body);
  });

  queueExport = asyncHandler(async (req, res) => {
    // Loyalty report types carry program liability/financial detail (see ReportService's
    // #assertLoyaltyReportPermission doc) — the route's generic REPORTS_EXPORT permission alone
    // isn't sufficient for those types, and the background worker that actually runs the job has
    // no request to check against. Enforce it here, once, before the job is ever queued.
    this.service.assertLoyaltyExportPermission(req.params.type, req);
    const data = await this.service.queueHeavyReport(
      req.params.type,
      req.body?.format || req.query.format || 'csv',
      { ...(await this.#scoped(req)), ...req.body?.filters },
      { actorId: req.auth.userId }
    );
    return ApiResponse.success(res, { statusCode: 202, message: 'Report queued', data });
  });

  /** "My report runs" status list — scoped to the caller in the service (SEC-001). */
  listRuns = asyncHandler(async (req, res) => {
    const data = await this.service.listReportRuns(req.auth, { limit: req.query.limit });
    return ApiResponse.success(res, { data });
  });

  getRun = asyncHandler(async (req, res) => {
    const data = await this.service.getReportRun(req.params.id, req.auth);
    return ApiResponse.success(res, { data });
  });

  /** Spec: "large reports run async with expiry-limited download" — 410 once expiresAt passes. */
  downloadRun = asyncHandler(async (req, res) => {
    const result = await this.service.downloadReportRun(req.params.id, req.auth);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.body);
  });

  listScheduled = asyncHandler(async (req, res) => {
    const data = await this.service.listScheduled(await this.#scoped(req));
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
