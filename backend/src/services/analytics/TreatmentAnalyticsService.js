import TreatmentSession from '../../models/TreatmentSession.model.js';
import TreatmentPlan from '../../models/TreatmentPlan.model.js';
import Invoice from '../../models/Invoice.model.js';
import {
  parseReportFilters,
  applyCommonMatch,
  roundMoney,
} from '../../helpers/reportFilters.helper.js';

class TreatmentAnalyticsService {
  async report(query = {}) {
    const filters = parseReportFilters(query);
    const sessionMatch = applyCommonMatch({}, filters, { dateField: 'scheduledDate' });
    const planMatch = applyCommonMatch({}, filters, { dateField: 'createdAt' });

    const [byStatus, popular, revenue, packages] = await Promise.all([
      TreatmentSession.aggregate([
        { $match: sessionMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      TreatmentSession.aggregate([
        { $match: sessionMatch },
        { $group: { _id: '$treatmentPlanId', sessions: { $sum: 1 } } },
        { $sort: { sessions: -1 } },
        { $limit: 15 },
      ]),
      Invoice.aggregate([
        {
          $match: {
            deletedAt: null,
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            treatmentPlanId: { $ne: null },
            ...(filters.dateFrom || filters.dateTo
              ? {
                  invoiceDate: {
                    ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
                    ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
                  },
                }
              : {}),
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            invoices: { $sum: 1 },
          },
        },
      ]),
      TreatmentPlan.aggregate([
        {
          $match: {
            ...planMatch,
            'packageSnapshot.packagePrice': { $exists: true },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            value: { $sum: { $ifNull: ['$packageSnapshot.packagePrice', 0] } },
          },
        },
      ]),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
    const completed = statusMap.COMPLETED || 0;
    const pending =
      (statusMap.SCHEDULED || 0) +
      (statusMap.CHECKED_IN || 0) +
      (statusMap.IN_PROGRESS || 0);

    const planIds = popular.map((p) => p._id).filter(Boolean);
    const plans = await TreatmentPlan.find({ _id: { $in: planIds } })
      .select('planNumber status')
      .lean();
    const planMap = Object.fromEntries(plans.map((p) => [p._id.toString(), p]));

    const rows = popular.map((p) => ({
      planId: p._id?.toString(),
      planNumber: p._id ? planMap[p._id.toString()]?.planNumber || '—' : '—',
      sessions: p.sessions,
      status: p._id ? planMap[p._id.toString()]?.status : null,
    }));

    return {
      category: 'treatments',
      filters,
      summary: {
        completedSessions: completed,
        pendingSessions: pending,
        treatmentRevenue: roundMoney(revenue[0]?.revenue || 0),
        packagesSold: packages.reduce((s, p) => s + p.count, 0),
        packageValue: roundMoney(packages.reduce((s, p) => s + (p.value || 0), 0)),
      },
      byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
      popularTreatments: rows,
      packages: packages.map((p) => ({
        status: p._id,
        count: p.count,
        value: roundMoney(p.value || 0),
      })),
      columns: [
        { key: 'planNumber', label: 'Plan' },
        { key: 'sessions', label: 'Sessions' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  }
}

export default TreatmentAnalyticsService;
