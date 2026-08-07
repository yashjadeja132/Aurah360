/**
 * Module 16 seed — scheduled reports + saved filters so dashboards/reports have UI fixtures.
 * Metrics themselves come from Modules 1–15 sample data (no duplication).
 */
import ScheduledReport from '../models/ScheduledReport.model.js';
import SavedReportFilter from '../models/SavedReportFilter.model.js';
import User from '../models/User.model.js';
import { REPORT_TYPE, SCHEDULE_FREQUENCY, EXPORT_FORMAT } from '../enums/report.js';
import logger from '../libs/logger.js';

export default async function seedModule16() {
  const admin =
    (await User.findOne({ email: 'admin@aurah360.local', deletedAt: null }).lean()) ||
    (await User.findOne({ email: 'owner@aurah360.local', deletedAt: null }).lean());

  if (!admin) {
    logger.warn('Module 16 seed skipped — no admin/owner user');
    return;
  }

  const existingSchedules = await ScheduledReport.countDocuments({ deletedAt: null });
  if (existingSchedules === 0) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);

    await ScheduledReport.insertMany([
      {
        name: 'Daily Revenue Summary',
        reportType: REPORT_TYPE.REVENUE,
        frequency: SCHEDULE_FREQUENCY.DAILY,
        format: EXPORT_FORMAT.CSV,
        filters: {},
        recipients: [admin.email],
        createdBy: admin._id,
        isActive: true,
        nextRunAt: tomorrow,
      },
      {
        name: 'Weekly Appointments',
        reportType: REPORT_TYPE.APPOINTMENTS,
        frequency: SCHEDULE_FREQUENCY.WEEKLY,
        format: EXPORT_FORMAT.EXCEL,
        filters: {},
        recipients: [admin.email],
        createdBy: admin._id,
        isActive: true,
        nextRunAt: tomorrow,
      },
      {
        name: 'Monthly Leads',
        reportType: REPORT_TYPE.LEADS,
        frequency: SCHEDULE_FREQUENCY.MONTHLY,
        format: EXPORT_FORMAT.CSV,
        filters: {},
        recipients: [admin.email],
        createdBy: admin._id,
        isActive: true,
        nextRunAt: tomorrow,
      },
    ]);
    logger.info('Module 16 scheduled reports seeded', { count: 3 });
  } else {
    logger.info('Module 16 scheduled reports already seeded', { existing: existingSchedules });
  }

  const existingFilters = await SavedReportFilter.countDocuments({
    deletedAt: null,
    userId: admin._id,
  });
  if (existingFilters === 0) {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    await SavedReportFilter.insertMany([
      {
        name: 'Last 30 days',
        userId: admin._id,
        scope: 'analytics',
        filters: {
          dateFrom: from.toISOString().slice(0, 10),
          dateTo: new Date().toISOString().slice(0, 10),
        },
        isDefault: true,
      },
      {
        name: 'This month revenue',
        userId: admin._id,
        scope: REPORT_TYPE.REVENUE,
        filters: {
          dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString()
            .slice(0, 10),
        },
        isDefault: false,
      },
    ]);
    logger.info('Module 16 saved filters seeded', { count: 2 });
  } else {
    logger.info('Module 16 saved filters already present', { existing: existingFilters });
  }
}
