import Appointment from '../../models/Appointment.model.js';
import Payment from '../../models/Payment.model.js';
import Invoice from '../../models/Invoice.model.js';
import Patient from '../../models/Patient.model.js';
import TreatmentPlan from '../../models/TreatmentPlan.model.js';
import TreatmentSession from '../../models/TreatmentSession.model.js';
import QueueEntry from '../../models/QueueEntry.model.js';
import Doctor from '../../models/Doctor.model.js';
import PatientFeedback from '../../models/PatientFeedback.model.js';
import DoctorSchedule from '../../models/DoctorSchedule.model.js';
import {
  parseReportFilters,
  startOfDay,
  endOfDay,
  roundMoney,
} from '../../helpers/reportFilters.helper.js';
import {
  getCached,
  setCached,
  cacheKeyFromFilters,
} from '../../helpers/dashboardCache.helper.js';
import AuditService from '../AuditService.js';
import { AUDIT_ACTIONS } from '../../enums/auditAction.js';

class ExecutiveDashboardService {
  constructor() {
    this.audit = new AuditService();
  }

  async getDashboard(query = {}, { actorId, req } = {}) {
    const filters = parseReportFilters(query);
    const cacheKey = cacheKeyFromFilters('executive', filters);
    const cached = await getCached(cacheKey);
    if (cached) {
      await this.#auditView(actorId, req, true);
      return { ...cached, cached: true };
    }

    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const branch = filters.branchId ? { branchId: filters.branchId } : {};
    const aptToday = {
      deletedAt: null,
      ...branch,
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
    };

    const [
      todaysAppointments,
      cancelledToday,
      noShowsToday,
      revenueToday,
      collectionsToday,
      pendingPayments,
      registeredToday,
      newPatients,
      returningPatients,
      activeTreatments,
      completedTreatments,
      waitingQueue,
      doctorsAvailable,
      feedbackAgg,
    ] = await Promise.all([
      Appointment.countDocuments(aptToday),
      Appointment.countDocuments({ ...aptToday, status: 'CANCELLED' }),
      Appointment.countDocuments({ ...aptToday, status: 'NO_SHOW' }),
      Payment.aggregate([
        {
          $match: {
            deletedAt: null,
            status: 'RECORDED',
            ...branch,
            paidAt: { $gte: todayStart, $lte: todayEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            deletedAt: null,
            status: 'RECORDED',
            ...branch,
            paidAt: { $gte: todayStart, $lte: todayEnd },
            isAdvance: { $ne: true },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            deletedAt: null,
            ...branch,
            paymentStatus: { $in: ['PENDING', 'PARTIALLY_PAID'] },
            status: { $ne: 'VOID' },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
      ]),
      Patient.countDocuments({
        deletedAt: null,
        ...(filters.branchId ? { primaryBranchId: filters.branchId } : {}),
        registrationDate: { $gte: todayStart, $lte: todayEnd },
      }),
      this.#newPatientsCount(filters, todayStart, todayEnd),
      this.#returningPatientsCount(filters, todayStart, todayEnd),
      TreatmentPlan.countDocuments({
        deletedAt: null,
        ...branch,
        status: { $in: ['ACCEPTED', 'APPROVED', 'RECOMMENDED'] },
      }),
      TreatmentSession.countDocuments({
        deletedAt: null,
        ...branch,
        status: 'COMPLETED',
        completedAt: { $gte: todayStart, $lte: todayEnd },
      }),
      QueueEntry.countDocuments({
        deletedAt: null,
        ...branch,
        queueDate: { $gte: todayStart, $lte: todayEnd },
        queueStatus: { $in: ['WAITING', 'CALLED'] },
      }),
      this.#doctorsAvailableToday(filters, todayStart),
      PatientFeedback.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: null,
            avgClinic: { $avg: '$clinicRating' },
            avgDoctor: { $avg: '$doctorRating' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const data = {
      widgets: {
        todaysAppointments,
        todaysRevenue: roundMoney(revenueToday[0]?.total || 0),
        todaysCollections: roundMoney(collectionsToday[0]?.total || 0),
        pendingPayments: roundMoney(pendingPayments[0]?.total || 0),
        pendingInvoices: pendingPayments[0]?.count || 0,
        patientsRegisteredToday: registeredToday,
        newPatients,
        returningPatients,
        activeTreatments,
        completedTreatments,
        doctorsAvailableToday: doctorsAvailable,
        waitingQueue,
        cancelledAppointments: cancelledToday,
        noShows: noShowsToday,
        feedbackRating: Math.round((feedbackAgg[0]?.avgClinic || 0) * 10) / 10,
        feedbackCount: feedbackAgg[0]?.count || 0,
        doctorFeedbackRating: Math.round((feedbackAgg[0]?.avgDoctor || 0) * 10) / 10,
      },
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    await setCached(cacheKey, data, 300);
    await this.#auditView(actorId, req, false);
    return data;
  }

  async #newPatientsCount(filters, from, to) {
    return Patient.countDocuments({
      deletedAt: null,
      ...(filters.branchId ? { primaryBranchId: filters.branchId } : {}),
      registrationDate: { $gte: from, $lte: to },
    });
  }

  async #returningPatientsCount(filters, from, to) {
    const rows = await Appointment.aggregate([
      {
        $match: {
          deletedAt: null,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          appointmentDate: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: '$patientId', count: { $sum: 1 } } },
      { $match: { count: { $gte: 1 } } },
      {
        $lookup: {
          from: 'patients',
          localField: '_id',
          foreignField: '_id',
          as: 'p',
        },
      },
      { $unwind: '$p' },
      {
        $match: {
          'p.registrationDate': { $lt: from },
          'p.deletedAt': null,
        },
      },
      { $count: 'n' },
    ]);
    return rows[0]?.n || 0;
  }

  async #doctorsAvailableToday(filters, todayStart) {
    const dayOfWeek = todayStart.getDay(); // 0=Sun … 6=Sat
    const scheduleFilter = {
      dayOfWeek,
      isWorking: true,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    };

    const scheduleCount = await DoctorSchedule.countDocuments(scheduleFilter).catch(() => 0);
    if (scheduleCount > 0) {
      const distinct = await DoctorSchedule.distinct('doctorId', scheduleFilter).catch(() => []);
      return distinct.length || scheduleCount;
    }

    return Doctor.countDocuments({
      deletedAt: null,
      isActive: true,
      ...(filters.branchId ? { branches: filters.branchId } : {}),
    });
  }

  async #auditView(actorId, req, fromCache) {
    await this.audit.record(AUDIT_ACTIONS.DASHBOARD_VIEWED, {
      actorId,
      metadata: { dashboard: 'executive', fromCache },
      req,
    });
  }
}

export default ExecutiveDashboardService;
