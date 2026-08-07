import AppointmentAnalyticsService from './AppointmentAnalyticsService.js';
import PatientAnalyticsService from './PatientAnalyticsService.js';
import DoctorAnalyticsService from './DoctorAnalyticsService.js';
import TreatmentAnalyticsService from './TreatmentAnalyticsService.js';
import BillingAnalyticsService from './BillingAnalyticsService.js';
import InventoryAnalyticsService from './InventoryAnalyticsService.js';
import CrmAnalyticsService from './CrmAnalyticsService.js';
import AiReportPlaceholderService from './AiReportPlaceholderService.js';
import AnalyticsExportService from './AnalyticsExportService.js';
import ExecutiveDashboardService from './ExecutiveDashboardService.js';
import AuditService from '../AuditService.js';
import ApiError from '../../libs/ApiError.js';
import { ANALYTICS_CATEGORY } from '../../enums/analytics.js';
import { AUDIT_ACTIONS } from '../../enums/auditAction.js';
import { enqueueAnalyticsExport } from '../../queues/analyticsJobs.js';

class AnalyticsFacadeService {
  constructor() {
    this.executive = new ExecutiveDashboardService();
    this.exportService = new AnalyticsExportService();
    this.audit = new AuditService();
    this.handlers = {
      [ANALYTICS_CATEGORY.APPOINTMENTS]: new AppointmentAnalyticsService(),
      [ANALYTICS_CATEGORY.PATIENTS]: new PatientAnalyticsService(),
      [ANALYTICS_CATEGORY.DOCTORS]: new DoctorAnalyticsService(),
      [ANALYTICS_CATEGORY.TREATMENTS]: new TreatmentAnalyticsService(),
      [ANALYTICS_CATEGORY.BILLING]: new BillingAnalyticsService(),
      [ANALYTICS_CATEGORY.INVENTORY]: new InventoryAnalyticsService(),
      [ANALYTICS_CATEGORY.CRM]: new CrmAnalyticsService(),
      [ANALYTICS_CATEGORY.AI]: new AiReportPlaceholderService(),
    };
  }

  async dashboard(query, ctx) {
    return this.executive.getDashboard(query, ctx);
  }

  async getReport(category, query = {}, { actorId, req } = {}) {
    const handler = this.handlers[category];
    if (!handler) throw ApiError.badRequest('Unknown analytics category');
    const data = await handler.report(query);
    await this.audit.record(AUDIT_ACTIONS.REPORT_VIEWED, {
      actorId,
      metadata: { category, module: 'analytics' },
      req,
    });
    return data;
  }

  async exportReport(category, format, query = {}, { actorId, req } = {}) {
    const report = await this.getReport(category, query, { actorId, req });
    const exported = await this.exportService.export({
      format,
      columns: report.columns || [],
      rows: report.rows || [],
      meta: {
        title: category,
        filename: `${category}-${Date.now()}`,
        sheetName: category,
      },
    });

    await this.audit.record(AUDIT_ACTIONS.REPORT_EXPORTED, {
      actorId,
      metadata: { category, format, module: 'analytics', placeholder: Boolean(exported.placeholder) },
      req,
    });

    return exported;
  }

  async queueHeavyExport(category, format, query = {}, { actorId } = {}) {
    return enqueueAnalyticsExport({ category, format, query, actorId });
  }
}

export default AnalyticsFacadeService;
