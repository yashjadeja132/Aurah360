import Patient from '../../models/Patient.model.js';
import Appointment from '../../models/Appointment.model.js';
import { parseReportFilters, pct, daysAgo } from '../../helpers/reportFilters.helper.js';

class PatientAnalyticsService {
  async report(query = {}) {
    const filters = parseReportFilters(query);
    const match = { deletedAt: null };
    if (filters.branchId) match.primaryBranchId = filters.branchId;
    if (filters.dateFrom || filters.dateTo) {
      match.registrationDate = {};
      if (filters.dateFrom) match.registrationDate.$gte = filters.dateFrom;
      if (filters.dateTo) match.registrationDate.$lte = filters.dateTo;
    }

    const ninetyDaysAgo = daysAgo(90);

    const [newPatients, gender, ageBuckets, leadSources, vip, inactive, growth] =
      await Promise.all([
        Patient.countDocuments(match),
        Patient.aggregate([
          { $match: match },
          { $group: { _id: '$gender', count: { $sum: 1 } } },
        ]),
        Patient.aggregate([
          { $match: { ...match, dateOfBirth: { $ne: null } } },
          {
            $project: {
              age: {
                $dateDiff: { startDate: '$dateOfBirth', endDate: '$$NOW', unit: 'year' },
              },
            },
          },
          {
            $bucket: {
              groupBy: '$age',
              boundaries: [0, 18, 30, 45, 60, 120],
              default: 'unknown',
              output: { count: { $sum: 1 } },
            },
          },
        ]),
        Patient.aggregate([
          { $match: match },
          { $group: { _id: '$leadSourceId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 15 },
        ]),
        Patient.countDocuments({ ...match, isVip: true }),
        Patient.countDocuments({
          deletedAt: null,
          ...(filters.branchId ? { primaryBranchId: filters.branchId } : {}),
          $or: [
            { isActive: false },
            { updatedAt: { $lt: ninetyDaysAgo } },
          ],
        }),
        Patient.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $ifNull: ['$registrationDate', '$createdAt'] },
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const returning = await Appointment.aggregate([
      {
        $match: {
          deletedAt: null,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                appointmentDate: {
                  ...(filters.dateFrom ? { $gte: filters.dateFrom } : {}),
                  ...(filters.dateTo ? { $lte: filters.dateTo } : {}),
                },
              }
            : {}),
        },
      },
      { $group: { _id: '$patientId', visits: { $sum: 1 } } },
      { $match: { visits: { $gte: 2 } } },
      { $count: 'n' },
    ]);

    const ageLabels = {
      0: '0-17',
      18: '18-29',
      30: '30-44',
      45: '45-59',
      60: '60+',
      unknown: 'Unknown',
    };

    return {
      category: 'patients',
      filters,
      summary: {
        newPatients,
        returningPatients: returning[0]?.n || 0,
        vipPatients: vip,
        inactivePatients: inactive,
        returningShare: pct(returning[0]?.n || 0, newPatients + (returning[0]?.n || 0)),
      },
      genderDistribution: gender.map((g) => ({ gender: g._id || 'Unknown', count: g.count })),
      ageGroups: ageBuckets.map((b) => ({
        group: ageLabels[b._id] || String(b._id),
        count: b.count,
      })),
      leadSources: leadSources.map((l) => ({
        sourceId: l._id?.toString() || 'Unknown',
        count: l.count,
      })),
      growth: growth.map((g) => ({ date: g._id, value: g.count })),
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'value', label: 'Registrations' },
      ],
      rows: growth.map((g) => ({ date: g._id, value: g.count })),
    };
  }
}

export default PatientAnalyticsService;
