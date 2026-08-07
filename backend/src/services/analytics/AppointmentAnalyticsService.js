import Appointment from '../../models/Appointment.model.js';
import Consultation from '../../models/Consultation.model.js';
import QueueEntry from '../../models/QueueEntry.model.js';
import {
  parseReportFilters,
  applyCommonMatch,
  pct,
  startOfDay,
  daysAgo,
} from '../../helpers/reportFilters.helper.js';
import { ANALYTICS_PERIOD } from '../../enums/analytics.js';

class AppointmentAnalyticsService {
  async report(query = {}) {
    const filters = this.#periodFilters(query);
    const match = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });

    const [byStatus, byDoctor, byBranch, byService, timing] = await Promise.all([
      Appointment.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $match: match },
        { $group: { _id: '$doctorId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      Appointment.aggregate([
        { $match: match },
        { $group: { _id: '$branchId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $match: { ...match, serviceId: { $ne: null } } },
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      this.#timingMetrics(filters),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
    const total = Object.values(statusMap).reduce((s, n) => s + n, 0);

    const trend = await Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      category: 'appointments',
      filters,
      summary: {
        appointments: total,
        completed: statusMap.COMPLETED || 0,
        cancelled: statusMap.CANCELLED || 0,
        noShow: statusMap.NO_SHOW || 0,
        rescheduled: statusMap.RESCHEDULED || 0,
        averageConsultationTime: timing.avgConsultation,
        averageWaitingTime: timing.avgWait,
        completionRate: pct(statusMap.COMPLETED || 0, total),
      },
      byStatus: byStatus.map((r) => ({ status: r._id, count: r.count })),
      byDoctor: byDoctor.map((r) => ({ doctorId: r._id?.toString(), count: r.count })),
      byBranch: byBranch.map((r) => ({ branchId: r._id?.toString(), count: r.count })),
      byService: byService.map((r) => ({ serviceId: r._id?.toString(), count: r.count })),
      trend: trend.map((r) => ({
        date: r._id,
        count: r.count,
        completed: r.completed,
        cancelled: r.cancelled,
        noShow: r.noShow,
      })),
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'count', label: 'Appointments' },
        { key: 'completed', label: 'Completed' },
        { key: 'cancelled', label: 'Cancelled' },
        { key: 'noShow', label: 'No Show' },
      ],
      rows: trend.map((r) => ({
        date: r._id,
        count: r.count,
        completed: r.completed,
        cancelled: r.cancelled,
        noShow: r.noShow,
      })),
    };
  }

  #periodFilters(query) {
    const filters = parseReportFilters(query);
    const period = query.period || ANALYTICS_PERIOD.CUSTOM;
    if (period === ANALYTICS_PERIOD.DAILY) {
      filters.dateFrom = startOfDay();
      filters.dateTo = new Date();
    } else if (period === ANALYTICS_PERIOD.WEEKLY) {
      filters.dateFrom = daysAgo(7);
      filters.dateTo = new Date();
    } else if (period === ANALYTICS_PERIOD.MONTHLY) {
      filters.dateFrom = daysAgo(30);
      filters.dateTo = new Date();
    }
    return filters;
  }

  async #timingMetrics(filters) {
    const consultMatch = applyCommonMatch({}, filters, { dateField: 'startedAt' });
    const queueMatch = applyCommonMatch({}, filters, { dateField: 'queueDate' });

    const [consult, wait] = await Promise.all([
      Consultation.aggregate([
        { $match: { ...consultMatch, duration: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$duration' } } },
      ]),
      QueueEntry.aggregate([
        {
          $match: {
            ...queueMatch,
            arrivalTime: { $ne: null },
            calledTime: { $ne: null },
          },
        },
        {
          $project: {
            mins: { $divide: [{ $subtract: ['$calledTime', '$arrivalTime'] }, 60000] },
          },
        },
        { $group: { _id: null, avg: { $avg: '$mins' } } },
      ]),
    ]);

    return {
      avgConsultation: Math.round(consult[0]?.avg || 0),
      avgWait: Math.round((wait[0]?.avg || 0) * 10) / 10,
    };
  }
}

export default AppointmentAnalyticsService;
