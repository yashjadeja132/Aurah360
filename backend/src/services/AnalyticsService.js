import Appointment from '../models/Appointment.model.js';
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import Patient from '../models/Patient.model.js';
import Lead from '../models/Lead.model.js';
import Consultation from '../models/Consultation.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import QueueEntry from '../models/QueueEntry.model.js';
import StockTransaction from '../models/StockTransaction.model.js';
import { CHART_TYPE } from '../enums/report.js';
import {
  parseReportFilters,
  applyCommonMatch,
  pct,
  roundMoney,
  eachDayKey,
  startOfDay,
} from '../helpers/reportFilters.helper.js';
// Shared with the analytics/report services — see the helper's own docs for why the clinic
// timezone is mandatory here. Previously a local copy lived in this file.
import { dayBucket } from '../utils/date.util.js';

class AnalyticsService {
  async kpis(query = {}) {
    const filters = parseReportFilters(query);
    const aptMatch = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });
    const payMatch = applyCommonMatch(
      { status: 'RECORDED' },
      filters,
      { dateField: 'paidAt', includeDoctor: false }
    );
    const leadMatch = applyCommonMatch({}, filters, { dateField: 'createdAt', includeDoctor: false });
    const consultMatch = applyCommonMatch({}, filters, { dateField: 'startedAt' });
    const planMatch = applyCommonMatch({}, filters, { dateField: 'createdAt' });
    const queueMatch = applyCommonMatch({}, filters, { dateField: 'queueDate', includeDoctor: true });

    const [
      appointments,
      noShows,
      payments,
      distinctPatients,
      leads,
      wonLeads,
      consultations,
      plans,
      completedPlans,
      waitAgg,
    ] = await Promise.all([
      Appointment.countDocuments(aptMatch),
      Appointment.countDocuments({ ...aptMatch, status: 'NO_SHOW' }),
      Payment.aggregate([
        { $match: payMatch },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.distinct('patientId', payMatch),
      Lead.countDocuments(leadMatch),
      Lead.countDocuments({ ...leadMatch, status: 'WON' }),
      Consultation.aggregate([
        { $match: { ...consultMatch, duration: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$duration' }, count: { $sum: 1 } } },
      ]),
      TreatmentPlan.countDocuments(planMatch),
      TreatmentPlan.countDocuments({ ...planMatch, status: 'COMPLETED' }),
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
            waitMins: {
              $divide: [{ $subtract: ['$calledTime', '$arrivalTime'] }, 60000],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$waitMins' }, count: { $sum: 1 } } },
      ]),
    ]);

    const revenue = roundMoney(payments[0]?.total || 0);
    const patientCount = (distinctPatients || []).filter(Boolean).length;

    return {
      filters,
      kpis: {
        averageConsultationTime: Math.round(consultations[0]?.avg || 0),
        averageWaitTime: Math.round((waitAgg[0]?.avg || 0) * 10) / 10,
        averageRevenuePerPatient: patientCount ? roundMoney(revenue / patientCount) : 0,
        treatmentCompletionPercent: pct(completedPlans, plans),
        conversionPercent: pct(wonLeads, leads),
        noShowPercent: pct(noShows, appointments),
      },
      counts: {
        appointments,
        noShows,
        leads,
        wonLeads,
        plans,
        completedPlans,
        consultations: consultations[0]?.count || 0,
        payingPatients: patientCount,
        revenue,
      },
    };
  }

  async chart(type, query = {}) {
    const filters = parseReportFilters(query);
    switch (type) {
      case CHART_TYPE.REVENUE_TREND:
        return this.#revenueTrend(filters);
      case CHART_TYPE.APPOINTMENTS_TREND:
        return this.#appointmentsTrend(filters);
      case CHART_TYPE.LEAD_FUNNEL:
        return this.#leadFunnel(filters);
      case CHART_TYPE.PATIENT_GROWTH:
        return this.#patientGrowth(filters);
      case CHART_TYPE.INVENTORY_TREND:
        return this.#inventoryTrend(filters);
      case CHART_TYPE.TREATMENT_COMPLETION:
        return this.#treatmentCompletion(filters);
      default:
        return { type, series: [] };
    }
  }

  async analyticsDashboard(query = {}) {
    const filters = parseReportFilters(query);
    const [kpis, ...charts] = await Promise.all([
      this.kpis(query),
      this.chart(CHART_TYPE.REVENUE_TREND, query),
      this.chart(CHART_TYPE.APPOINTMENTS_TREND, query),
      this.chart(CHART_TYPE.LEAD_FUNNEL, query),
      this.chart(CHART_TYPE.PATIENT_GROWTH, query),
      this.chart(CHART_TYPE.INVENTORY_TREND, query),
      this.chart(CHART_TYPE.TREATMENT_COMPLETION, query),
    ]);

    return {
      filters,
      kpis: kpis.kpis,
      counts: kpis.counts,
      charts: {
        revenueTrend: charts[0],
        appointmentsTrend: charts[1],
        leadFunnel: charts[2],
        patientGrowth: charts[3],
        inventoryTrend: charts[4],
        treatmentCompletion: charts[5],
      },
    };
  }

  async #revenueTrend(filters) {
    const match = applyCommonMatch(
      { status: 'RECORDED' },
      filters,
      { dateField: 'paidAt', includeDoctor: false }
    );
    const rows = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: dayBucket('$paidAt'),
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const map = Object.fromEntries(rows.map((r) => [r._id, roundMoney(r.amount)]));
    const days = eachDayKey(filters.dateFrom, filters.dateTo);
    return {
      type: CHART_TYPE.REVENUE_TREND,
      series: days.map((d) => ({ date: d, value: map[d] || 0 })),
    };
  }

  async #appointmentsTrend(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });
    const rows = await Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: dayBucket('$appointmentDate'),
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const days = eachDayKey(filters.dateFrom, filters.dateTo);
    return {
      type: CHART_TYPE.APPOINTMENTS_TREND,
      series: days.map((d) => ({ date: d, value: map[d] || 0 })),
    };
  }

  async #leadFunnel(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'createdAt', includeDoctor: false });
    const rows = await Lead.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return {
      type: CHART_TYPE.LEAD_FUNNEL,
      series: rows.map((r) => ({ status: r._id, value: r.count })),
    };
  }

  async #patientGrowth(filters) {
    const match = { deletedAt: null };
    if (filters.branchId) match.primaryBranchId = filters.branchId;
    if (filters.dateFrom || filters.dateTo) {
      match.registrationDate = {};
      if (filters.dateFrom) match.registrationDate.$gte = filters.dateFrom;
      if (filters.dateTo) match.registrationDate.$lte = filters.dateTo;
    }
    const rows = await Patient.aggregate([
      { $match: match },
      {
        $group: {
          _id: dayBucket({ $ifNull: ['$registrationDate', '$createdAt'] }),
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const days = eachDayKey(filters.dateFrom, filters.dateTo);
    let cumulative = 0;
    return {
      type: CHART_TYPE.PATIENT_GROWTH,
      series: days.map((d) => {
        cumulative += map[d] || 0;
        return { date: d, value: map[d] || 0, cumulative };
      }),
    };
  }

  async #inventoryTrend(filters) {
    const match = { deletedAt: null };
    if (filters.branchId) match.branchId = filters.branchId;
    if (filters.dateFrom || filters.dateTo) {
      match.createdAt = {};
      if (filters.dateFrom) match.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) match.createdAt.$lte = filters.dateTo;
    }
    const rows = await StockTransaction.aggregate([
      { $match: match },
      {
        $group: {
          // `createdAt` is a true instant, but this series is a CALENDAR-DAY chart read by clinic
          // staff, so it must bucket on the clinic's day. Without a timezone Mongo used the UTC
          // day, so stock movements recorded between 00:00 and 05:30 IST were charted on the
          // previous day — and the labels then disagreed with every other trend on the dashboard.
          _id: dayBucket('$createdAt'),
          quantity: { $sum: '$quantity' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return {
      type: CHART_TYPE.INVENTORY_TREND,
      series: rows.map((r) => ({ date: r._id, value: r.quantity, transactions: r.count })),
    };
  }

  async #treatmentCompletion(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'scheduledDate' });
    const rows = await TreatmentSession.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            // `scheduledDate` is a CALENDAR DAY stored as local start-of-day, so the UTC day is the
            // previous one — this series was labelled a day early. Group on the clinic calendar.
            day: dayBucket('$scheduledDate'),
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const byDay = {};
    for (const r of rows) {
      const day = r._id.day;
      if (!byDay[day]) byDay[day] = { date: day, completed: 0, total: 0 };
      byDay[day].total += r.count;
      if (r._id.status === 'COMPLETED') byDay[day].completed += r.count;
    }
    const series = Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        completed: d.completed,
        total: d.total,
        value: pct(d.completed, d.total),
      }));
    return { type: CHART_TYPE.TREATMENT_COMPLETION, series };
  }
}

export default AnalyticsService;
