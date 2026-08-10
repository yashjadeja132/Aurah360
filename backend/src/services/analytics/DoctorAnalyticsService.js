import Appointment from '../../models/Appointment.model.js';
import Consultation from '../../models/Consultation.model.js';
import TreatmentSession from '../../models/TreatmentSession.model.js';
import Payment from '../../models/Payment.model.js';
import PatientFeedback from '../../models/PatientFeedback.model.js';
import Doctor from '../../models/Doctor.model.js';
import {
  parseReportFilters,
  applyCommonMatch,
  pct,
  roundMoney,
} from '../../helpers/reportFilters.helper.js';

class DoctorAnalyticsService {
  async report(query = {}) {
    const filters = parseReportFilters(query);
    const aptMatch = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });

    const [appointments, consultations, treatments, revenue, feedback] = await Promise.all([
      Appointment.aggregate([
        { $match: aptMatch },
        {
          $group: {
            _id: '$doctorId',
            appointments: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          },
        },
      ]),
      Consultation.aggregate([
        { $match: applyCommonMatch({}, filters, { dateField: 'startedAt' }) },
        {
          $group: {
            _id: '$doctorId',
            consultations: { $sum: 1 },
            avgDuration: { $avg: '$duration' },
          },
        },
      ]),
      TreatmentSession.aggregate([
        { $match: applyCommonMatch({}, filters, { dateField: 'scheduledDate' }) },
        { $group: { _id: '$doctorId', treatments: { $sum: 1 } } },
      ]),
      this.#revenueByDoctor(filters),
      PatientFeedback.aggregate([
        { $match: { deletedAt: null, doctorId: { $ne: null } } },
        {
          $group: {
            _id: '$doctorId',
            avgRating: { $avg: '$doctorRating' },
            feedbackCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const map = new Map();
    const touch = (id, patch) => {
      if (!id) return;
      const key = id.toString();
      map.set(key, { doctorId: key, ...(map.get(key) || {}), ...patch });
    };

    for (const r of appointments) {
      touch(r._id, {
        appointments: r.appointments,
        completed: r.completed,
        cancelled: r.cancelled,
        cancellationRate: pct(r.cancelled, r.appointments),
      });
    }
    for (const r of consultations) {
      touch(r._id, {
        consultations: r.consultations,
        averageConsultationDuration: Math.round(r.avgDuration || 0),
      });
    }
    for (const r of treatments) touch(r._id, { treatments: r.treatments });
    for (const r of revenue) touch(r._id, { revenue: roundMoney(r.revenue) });
    for (const r of feedback) {
      touch(r._id, {
        patientSatisfaction: Math.round((r.avgRating || 0) * 10) / 10,
        feedbackCount: r.feedbackCount,
      });
    }

    const doctorIds = [...map.keys()];
    const doctors = await Doctor.find({ _id: { $in: doctorIds } })
      .populate('userId', 'firstName lastName')
      .select('doctorCode userId')
      .lean();
    const nameMap = Object.fromEntries(
      doctors.map((d) => [
        d._id.toString(),
        {
          code: d.doctorCode,
          name: d.userId
            ? `${d.userId.firstName || ''} ${d.userId.lastName || ''}`.trim()
            : d.doctorCode,
        },
      ])
    );

    const rows = [...map.values()]
      .map((r) => ({
        ...r,
        doctor: nameMap[r.doctorId]?.name || 'Unknown',
        doctorCode: nameMap[r.doctorId]?.code || '',
        appointments: r.appointments || 0,
        consultations: r.consultations || 0,
        treatments: r.treatments || 0,
        revenue: r.revenue || 0,
        averageConsultationDuration: r.averageConsultationDuration || 0,
        cancellationRate: r.cancellationRate || 0,
        patientSatisfaction: r.patientSatisfaction || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments);

    return {
      category: 'doctors',
      filters,
      summary: {
        doctors: rows.length,
        appointments: rows.reduce((s, r) => s + r.appointments, 0),
        revenue: roundMoney(rows.reduce((s, r) => s + r.revenue, 0)),
      },
      performance: rows,
      columns: [
        { key: 'doctor', label: 'Doctor' },
        { key: 'doctorCode', label: 'Code' },
        { key: 'appointments', label: 'Appointments' },
        { key: 'consultations', label: 'Consultations' },
        { key: 'treatments', label: 'Treatments' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'averageConsultationDuration', label: 'Avg Duration' },
        { key: 'cancellationRate', label: 'Cancel %' },
        { key: 'patientSatisfaction', label: 'Satisfaction' },
      ],
      rows,
    };
  }

  async #revenueByDoctor(filters) {
    const payMatch = {
      deletedAt: null,
      status: 'RECORDED',
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    };
    if (filters.dateFrom || filters.dateTo) {
      payMatch.paidAt = {};
      if (filters.dateFrom) payMatch.paidAt.$gte = filters.dateFrom;
      if (filters.dateTo) payMatch.paidAt.$lte = filters.dateTo;
    }

    return Payment.aggregate([
      { $match: payMatch },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'inv',
        },
      },
      { $unwind: { path: '$inv', preserveNullAndEmptyArrays: true } },
      ...(filters.doctorId
        ? [{ $match: { 'inv.doctorId': filters.doctorId } }]
        : []),
      { $group: { _id: '$inv.doctorId', revenue: { $sum: '$amount' } } },
    ]);
  }
}

export default DoctorAnalyticsService;
