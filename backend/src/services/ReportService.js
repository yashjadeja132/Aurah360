import Appointment from '../models/Appointment.model.js';
import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import Patient from '../models/Patient.model.js';
import Lead from '../models/Lead.model.js';
import Consultation from '../models/Consultation.model.js';
import Prescription from '../models/Prescription.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import QueueEntry from '../models/QueueEntry.model.js';
import Doctor from '../models/Doctor.model.js';
import Branch from '../models/Branch.model.js';
import { hasGlobalScope } from '../helpers/scope.helper.js';
import InventoryItem from '../models/InventoryItem.model.js';
import Dispense from '../models/Dispense.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import User from '../models/User.model.js';
import ScheduledReport from '../models/ScheduledReport.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyBalanceCache from '../models/LoyaltyBalanceCache.model.js';
import { LOYALTY_ENTRY_TYPE, LOYALTY_EARNING_EVENT } from '../enums/loyalty.js';
import SavedReportFilter from '../models/SavedReportFilter.model.js';
import ReportRun from '../models/ReportRun.model.js';
import AuditService from './AuditService.js';
import AnalyticsService from './AnalyticsService.js';
import { exportReport } from './ExportService.js';
import ApiError from '../libs/ApiError.js';
import {
  DASHBOARD_TYPE,
  REPORT_TYPE,
  REPORT_RUN_STATUS,
  SCHEDULE_FREQUENCY,
  EXPORT_FORMAT,
} from '../enums/report.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { dayBucket } from '../utils/date.util.js';
import {
  parseReportFilters,
  applyCommonMatch,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  pct,
  roundMoney,
} from '../helpers/reportFilters.helper.js';

function personName(doc) {
  if (!doc) return '';
  if (doc.fullName) return doc.fullName;
  return [doc.firstName, doc.middleName, doc.lastName].filter(Boolean).join(' ').trim();
}

async function doctorNameMap(doctorIds) {
  const ids = doctorIds.filter(Boolean);
  if (!ids.length) return {};
  const doctors = await Doctor.find({ _id: { $in: ids } })
    .populate('userId', 'firstName lastName')
    .select('doctorCode userId')
    .lean();
  const map = {};
  for (const d of doctors) {
    map[d._id.toString()] = {
      name: personName(d.userId) || d.doctorCode || 'Doctor',
      doctorCode: d.doctorCode,
    };
  }
  return map;
}

class ReportService {
  constructor() {
    this.audit = new AuditService();
    this.analytics = new AnalyticsService();
  }

  async dashboard(type, query = {}, auth = {}) {
    const filters = parseReportFilters(query);
    switch (type) {
      case DASHBOARD_TYPE.OWNER:
      case DASHBOARD_TYPE.BRANCH_MANAGER:
        return this.#ownerDashboard(filters, type);
      case DASHBOARD_TYPE.DOCTOR:
        return this.#doctorDashboard(filters, auth);
      case DASHBOARD_TYPE.RECEPTION:
        return this.#receptionDashboard(filters);
      case DASHBOARD_TYPE.CRM:
        return this.#crmDashboard(filters);
      case DASHBOARD_TYPE.PHARMACY:
        return this.#pharmacyDashboard(filters);
      default:
        throw ApiError.badRequest('Unknown dashboard type');
    }
  }

  async #ownerDashboard(filters, type) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const monthStart = startOfMonth();
    const monthEnd = endOfMonth();

    const branchMatch = filters.branchId ? { branchId: filters.branchId } : {};
    const base = { deletedAt: null, ...branchMatch };

    const payTodayMatch = {
      deletedAt: null,
      status: 'RECORDED',
      paidAt: { $gte: todayStart, $lte: todayEnd },
      ...branchMatch,
    };
    const payMonthMatch = {
      deletedAt: null,
      status: 'RECORDED',
      paidAt: { $gte: monthStart, $lte: monthEnd },
      ...branchMatch,
    };

    const [
      revenueToday,
      revenueMonth,
      outstanding,
      appointmentsToday,
      registrations,
      leadsTotal,
      leadsWon,
      treatmentPlans,
      completedTreatments,
      topDoctors,
      topServices,
      topBranches,
    ] = await Promise.all([
      Payment.aggregate([{ $match: payTodayMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: payMonthMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Invoice.aggregate([
        {
          $match: {
            ...base,
            paymentStatus: { $in: ['PENDING', 'PARTIALLY_PAID'] },
            status: { $ne: 'VOID' },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' }, count: { $sum: 1 } } },
      ]),
      Appointment.countDocuments({
        ...base,
        appointmentDate: { $gte: todayStart, $lte: todayEnd },
      }),
      Patient.countDocuments({
        deletedAt: null,
        ...(filters.branchId ? { primaryBranchId: filters.branchId } : {}),
        registrationDate: { $gte: todayStart, $lte: todayEnd },
      }),
      Lead.countDocuments({ ...base }),
      Lead.countDocuments({ ...base, status: 'WON' }),
      TreatmentPlan.countDocuments({ ...base }),
      TreatmentSession.countDocuments({ ...base, status: 'COMPLETED' }),
      Payment.aggregate([
        { $match: payMonthMatch },
        {
          $lookup: {
            from: 'invoices',
            localField: 'invoiceId',
            foreignField: '_id',
            as: 'inv',
          },
        },
        { $unwind: { path: '$inv', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$inv.doctorId',
            revenue: { $sum: '$amount' },
            payments: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Appointment.aggregate([
        {
          $match: {
            ...base,
            appointmentDate: { $gte: monthStart, $lte: monthEnd },
            serviceId: { $ne: null },
          },
        },
        { $group: { _id: '$serviceId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Payment.aggregate([
        { $match: { deletedAt: null, status: 'RECORDED', paidAt: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$branchId', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const doctorMap = await doctorNameMap(topDoctors.map((d) => d._id));

    const branchIds = topBranches.map((b) => b._id).filter(Boolean);
    const branches = await Branch.find({ _id: { $in: branchIds } }).select('name branchCode').lean();
    const branchMap = Object.fromEntries(branches.map((b) => [b._id.toString(), b]));

    return {
      type,
      summary: {
        revenueToday: roundMoney(revenueToday[0]?.total || 0),
        revenueThisMonth: roundMoney(revenueMonth[0]?.total || 0),
        outstandingPayments: roundMoney(outstanding[0]?.total || 0),
        outstandingInvoices: outstanding[0]?.count || 0,
        appointmentsToday,
        patientRegistrations: registrations,
        leadConversion: pct(leadsWon, leadsTotal),
        leadsTotal,
        leadsWon,
        treatmentPlans,
        completedTreatments,
      },
      topDoctors: topDoctors.map((d) => ({
        doctorId: d._id?.toString() || null,
        name: d._id ? doctorMap[d._id.toString()]?.name || 'Unknown' : 'Unassigned',
        doctorCode: d._id ? doctorMap[d._id.toString()]?.doctorCode : null,
        revenue: roundMoney(d.revenue),
        payments: d.payments,
      })),
      topServices: topServices.map((s) => ({
        serviceId: s._id?.toString(),
        count: s.count,
      })),
      topBranches: topBranches.map((b) => ({
        branchId: b._id?.toString(),
        name: b._id ? branchMap[b._id.toString()]?.name || 'Unknown' : 'Unknown',
        branchCode: b._id ? branchMap[b._id.toString()]?.branchCode : null,
        revenue: roundMoney(b.revenue),
        payments: b.count,
      })),
    };
  }

  async #doctorDashboard(filters, auth) {
    let doctorId = filters.doctorId;
    if (!doctorId && auth.userId) {
      const doc = await Doctor.findOne({ userId: auth.userId, deletedAt: null }).select('_id').lean();
      if (doc) doctorId = doc._id;
    }
    if (!doctorId) {
      return {
        type: DASHBOARD_TYPE.DOCTOR,
        summary: {
          todaysPatients: 0,
          consultations: 0,
          followUps: 0,
          prescriptions: 0,
          treatmentPlans: 0,
          pendingNotes: 0,
        },
        patients: [],
      };
    }

    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const match = {
      deletedAt: null,
      doctorId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    };

    const [
      todaysAppointments,
      consultations,
      followUps,
      prescriptions,
      treatmentPlans,
      pendingNotes,
    ] = await Promise.all([
      Appointment.find({
        ...match,
        appointmentDate: { $gte: todayStart, $lte: todayEnd },
      })
        .populate('patientId', 'firstName middleName lastName mrn')
        .sort({ startTime: 1 })
        .limit(50)
        .lean(),
      Consultation.countDocuments({
        ...match,
        startedAt: { $gte: todayStart, $lte: todayEnd },
      }),
      Appointment.countDocuments({
        ...match,
        appointmentDate: { $gte: todayStart, $lte: todayEnd },
        appointmentType: { $in: ['FOLLOW_UP', 'FOLLOWUP'] },
      }),
      Prescription.countDocuments({
        ...match,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      TreatmentPlan.countDocuments({
        ...match,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      Consultation.countDocuments({
        ...match,
        status: { $in: ['DRAFT', 'IN_PROGRESS'] },
      }),
    ]);

    const uniquePatients = new Set(
      todaysAppointments.map((a) => a.patientId?._id?.toString() || a.patientId?.toString()).filter(Boolean)
    );

    return {
      type: DASHBOARD_TYPE.DOCTOR,
      doctorId: doctorId.toString(),
      summary: {
        todaysPatients: uniquePatients.size,
        consultations,
        followUps,
        prescriptions,
        treatmentPlans,
        pendingNotes,
      },
      patients: todaysAppointments.map((a) => ({
        appointmentId: a._id.toString(),
        appointmentNumber: a.appointmentNumber,
        status: a.status,
        startTime: a.startTime,
        patientName: personName(a.patientId) || '—',
        mrn: a.patientId?.mrn || null,
      })),
    };
  }

  async #receptionDashboard(filters) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const base = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
    };
    const qBase = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      queueDate: { $gte: todayStart, $lte: todayEnd },
    };

    const [
      appointmentsToday,
      checkIns,
      walkIns,
      noShows,
      queueByStatus,
      waitAgg,
    ] = await Promise.all([
      Appointment.countDocuments(base),
      Appointment.countDocuments({ ...base, status: { $in: ['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'] } }),
      QueueEntry.countDocuments({ ...qBase, isWalkIn: true }),
      Appointment.countDocuments({ ...base, status: 'NO_SHOW' }),
      QueueEntry.aggregate([
        { $match: qBase },
        { $group: { _id: '$queueStatus', count: { $sum: 1 } } },
      ]),
      QueueEntry.aggregate([
        {
          $match: {
            ...qBase,
            arrivalTime: { $ne: null },
            calledTime: { $ne: null },
          },
        },
        {
          $project: {
            waitMins: { $divide: [{ $subtract: ['$calledTime', '$arrivalTime'] }, 60000] },
          },
        },
        { $group: { _id: null, avg: { $avg: '$waitMins' } } },
      ]),
    ]);

    const queueStatus = {};
    for (const row of queueByStatus) queueStatus[row._id] = row.count;

    return {
      type: DASHBOARD_TYPE.RECEPTION,
      summary: {
        todaysAppointments: appointmentsToday,
        checkIns,
        walkIns,
        noShows,
        averageWaitingTime: Math.round((waitAgg[0]?.avg || 0) * 10) / 10,
      },
      queueStatus,
    };
  }

  async #crmDashboard(filters) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const base = {
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    };
    if (filters.leadSource) base.source = filters.leadSource;
    if (filters.dateFrom || filters.dateTo) {
      base.createdAt = {};
      if (filters.dateFrom) base.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) base.createdAt.$lte = filters.dateTo;
    }

    const [
      newLeads,
      byStatus,
      followUpsDue,
      total,
      won,
      bySource,
      counsellors,
    ] = await Promise.all([
      Lead.countDocuments({
        ...base,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      }),
      Lead.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.countDocuments({
        deletedAt: null,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        nextFollowUp: { $lte: todayEnd },
        status: { $nin: ['WON', 'LOST', 'JUNK'] },
      }),
      Lead.countDocuments(base),
      Lead.countDocuments({ ...base, status: 'WON' }),
      Lead.aggregate([
        { $match: base },
        { $group: { _id: '$source', total: { $sum: 1 }, won: { $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] } } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      Lead.aggregate([
        { $match: { ...base, assignedTo: { $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] } },
          },
        },
        { $sort: { won: -1 } },
        { $limit: 10 },
      ]),
    ]);

    const funnel = {};
    for (const row of byStatus) funnel[row._id] = row.count;

    const userIds = counsellors.map((c) => c._id).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email').lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    return {
      type: DASHBOARD_TYPE.CRM,
      summary: {
        newLeads,
        followUpsDue,
        conversionRate: pct(won, total),
        total,
        won,
      },
      pipelineFunnel: funnel,
      leadSources: bySource.map((s) => ({
        source: s._id || 'Unknown',
        total: s.total,
        won: s.won,
        conversionPercent: pct(s.won, s.total),
      })),
      counsellorPerformance: counsellors.map((c) => ({
        userId: c._id?.toString(),
        name: personName(userMap[c._id?.toString()]) || 'Unknown',
        total: c.total,
        won: c.won,
        conversionPercent: pct(c.won, c.total),
      })),
    };
  }

  async #pharmacyDashboard(filters) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();
    const branchMatch = filters.branchId ? { branchId: filters.branchId } : {};
    const nearExpiryBefore = new Date();
    nearExpiryBefore.setDate(nearExpiryBefore.getDate() + 90);

    const [dispensedToday, lowStock, nearExpiry, purchaseSummary, topMedicines] = await Promise.all([
      Dispense.countDocuments({
        deletedAt: null,
        ...branchMatch,
        status: { $in: ['PARTIAL', 'COMPLETED'] },
        dispensedAt: { $gte: todayStart, $lte: todayEnd },
      }),
      InventoryItem.countDocuments({
        deletedAt: null,
        ...branchMatch,
        isActive: true,
        $expr: { $lte: ['$currentStock', '$reorderLevel'] },
      }),
      InventoryItem.countDocuments({
        deletedAt: null,
        ...branchMatch,
        'batches.expiryDate': { $lte: nearExpiryBefore, $gte: new Date() },
      }),
      PurchaseOrder.aggregate([
        {
          $match: {
            deletedAt: null,
            ...branchMatch,
            orderedAt: { $gte: startOfMonth(), $lte: endOfMonth() },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            value: {
              $sum: {
                $sum: {
                  $map: {
                    input: { $ifNull: ['$items', []] },
                    as: 'i',
                    in: { $multiply: ['$$i.quantityOrdered', '$$i.unitCost'] },
                  },
                },
              },
            },
          },
        },
      ]),
      Dispense.aggregate([
        {
          $match: {
            deletedAt: null,
            ...branchMatch,
            dispensedAt: { $gte: startOfMonth(), $lte: endOfMonth() },
          },
        },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $ifNull: ['$items.medicineName', '$items.itemName'] },
            quantity: { $sum: '$items.quantityDispensed' },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$items.quantityDispensed', 0] },
                  { $ifNull: ['$items.sellingPrice', 0] },
                ],
              },
            },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      type: DASHBOARD_TYPE.PHARMACY,
      summary: {
        dispensedToday,
        lowStock,
        nearExpiry,
        purchaseOrdersThisMonth: purchaseSummary.reduce((s, r) => s + r.count, 0),
        purchaseValueThisMonth: roundMoney(purchaseSummary.reduce((s, r) => s + (r.value || 0), 0)),
      },
      purchaseSummary: purchaseSummary.map((p) => ({
        status: p._id,
        count: p.count,
        value: roundMoney(p.value || 0),
      })),
      topMedicines: topMedicines.map((m) => ({
        name: m._id || 'Unknown',
        quantity: m.quantity,
        revenue: roundMoney(m.revenue),
      })),
    };
  }

  async generateReport(type, query = {}, { actorId, req, audit = true } = {}) {
    const filters = parseReportFilters(query);
    let columns;
    let rows;

    switch (type) {
      case REPORT_TYPE.APPOINTMENTS:
        ({ columns, rows } = await this.#reportAppointments(filters));
        break;
      case REPORT_TYPE.REVENUE:
        ({ columns, rows } = await this.#reportRevenue(filters));
        break;
      case REPORT_TYPE.PAYMENTS:
        ({ columns, rows } = await this.#reportPayments(filters));
        break;
      case REPORT_TYPE.INVOICES:
        ({ columns, rows } = await this.#reportInvoices(filters));
        break;
      case REPORT_TYPE.TREATMENTS:
        ({ columns, rows } = await this.#reportTreatments(filters));
        break;
      case REPORT_TYPE.CONSULTATIONS:
        ({ columns, rows } = await this.#reportConsultations(filters));
        break;
      case REPORT_TYPE.PATIENTS:
        ({ columns, rows } = await this.#reportPatients(filters));
        break;
      case REPORT_TYPE.DOCTORS:
        ({ columns, rows } = await this.#reportDoctors(filters));
        break;
      case REPORT_TYPE.LEADS:
        ({ columns, rows } = await this.#reportLeads(filters));
        break;
      case REPORT_TYPE.INVENTORY:
        ({ columns, rows } = await this.#reportInventory(filters));
        break;
      case REPORT_TYPE.PHARMACY:
        ({ columns, rows } = await this.#reportPharmacy(filters));
        break;
      case REPORT_TYPE.QUEUE:
        ({ columns, rows } = await this.#reportQueue(filters));
        break;
      case REPORT_TYPE.LOYALTY_LIABILITY:
        ({ columns, rows } = await this.#reportLoyaltyLiability(filters));
        break;
      case REPORT_TYPE.LOYALTY_ISSUANCE:
        ({ columns, rows } = await this.#reportLoyaltyIssuance(filters));
        break;
      case REPORT_TYPE.LOYALTY_REDEMPTION:
        ({ columns, rows } = await this.#reportLoyaltyRedemption(filters));
        break;
      case REPORT_TYPE.LOYALTY_EXPIRY:
        ({ columns, rows } = await this.#reportLoyaltyExpiry(filters));
        break;
      case REPORT_TYPE.LOYALTY_REFERRAL:
        ({ columns, rows } = await this.#reportLoyaltyReferral(filters));
        break;
      default:
        throw ApiError.badRequest('Unknown report type');
    }

    if (audit) {
      await this.audit.record(AUDIT_ACTIONS.REPORT_GENERATED, {
        actorId,
        metadata: { reportType: type, rowCount: rows.length, filters },
        req,
      });
    }

    return { reportType: type, filters, columns, rows, rowCount: rows.length };
  }

  async export(type, format, query = {}, { actorId, req } = {}) {
    const report = await this.generateReport(type, query, { actorId, req, audit: true });
    const exported = exportReport({
      format,
      columns: report.columns,
      rows: report.rows,
      meta: { title: type, filename: `${type}-${Date.now()}`, sheetName: type },
    });

    await this.audit.record(AUDIT_ACTIONS.REPORT_EXPORTED, {
      actorId,
      metadata: {
        reportType: type,
        format,
        rowCount: report.rowCount,
        placeholder: Boolean(exported.placeholder),
      },
      req,
    });

    return { ...exported, reportType: type, rowCount: report.rowCount };
  }

  async queueHeavyReport(type, format, query = {}, { actorId } = {}) {
    const run = await ReportRun.create({
      reportType: type,
      format: format || EXPORT_FORMAT.CSV,
      filters: query,
      status: REPORT_RUN_STATUS.QUEUED,
      requestedBy: actorId || null,
    });

    const { enqueueReportGeneration } = await import('../queues/reportJobs.js');
    await enqueueReportGeneration(run._id.toString());
    return { runId: run._id.toString(), status: run.status };
  }

  async processReportRun(runId) {
    const run = await ReportRun.findById(runId);
    if (!run || run.deletedAt) return { skipped: true };

    run.status = REPORT_RUN_STATUS.RUNNING;
    run.startedAt = new Date();
    await run.save();

    try {
      const report = await this.generateReport(run.reportType, run.filters || {}, { audit: false });
      const exported = exportReport({
        format: run.format,
        columns: report.columns,
        rows: report.rows,
        meta: { title: run.reportType, filename: run.reportType },
      });
      run.status = REPORT_RUN_STATUS.COMPLETED;
      run.rowCount = report.rowCount;
      run.resultSummary = { columns: report.columns.map((c) => c.key), sample: report.rows.slice(0, 5) };
      run.exportPayload = exported.body;
      run.completedAt = new Date();
      run.failedReason = null;
      await run.save();
      return { runId, status: run.status, rowCount: run.rowCount };
    } catch (err) {
      run.status = REPORT_RUN_STATUS.FAILED;
      run.failedReason = err.message;
      run.completedAt = new Date();
      await run.save();
      throw err;
    }
  }

  /**
   * SEC-001 — a report run is readable ONLY by the person who requested it, or by a global-scope
   * role (OWNER/ADMIN).
   *
   * This took no requester argument at all: any holder of `reports.view` could walk report-run ids
   * and read someone else's output, and `resultSummary` retains sample rows of real patient data.
   * A run is the residue of a query somebody else was authorised to make — inheriting their
   * results is inheriting their scope.
   *
   * Out-of-scope answers 404, not 403: a 403 would confirm the run exists.
   */
  async getReportRun(id, requester = null) {
    const run = await ReportRun.findOne({ _id: id, deletedAt: null }).lean();
    if (!run) throw ApiError.notFound('Report run not found');

    if (requester && !hasGlobalScope(requester)) {
      const owner = run.requestedBy ? run.requestedBy.toString() : null;
      if (!owner || owner !== String(requester.userId)) {
        throw ApiError.notFound('Report run not found');
      }
    }

    return {
      id: run._id.toString(),
      reportType: run.reportType,
      format: run.format,
      status: run.status,
      rowCount: run.rowCount,
      resultSummary: run.resultSummary,
      failedReason: run.failedReason,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
      hasExport: Boolean(run.exportPayload),
    };
  }

  // ─── Scheduled reports ─────────────────────────────────────────────

  async listScheduled(query = {}) {
    const filter = { deletedAt: null };
    if (query.isActive != null) filter.isActive = query.isActive === 'true' || query.isActive === true;
    const items = await ScheduledReport.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return { items: items.map((s) => this.#mapSchedule(s)) };
  }

  async createScheduled(body, { actorId, req } = {}) {
    const nextRunAt = this.#computeNextRun(body.frequency);
    const doc = await ScheduledReport.create({
      name: body.name,
      reportType: body.reportType,
      frequency: body.frequency,
      format: body.format || EXPORT_FORMAT.CSV,
      filters: body.filters || {},
      recipients: body.recipients || [],
      createdBy: actorId,
      isActive: true,
      nextRunAt,
    });

    await this.audit.record(AUDIT_ACTIONS.SCHEDULED_REPORT_CREATED, {
      actorId,
      metadata: {
        scheduledReportId: doc._id.toString(),
        reportType: doc.reportType,
        frequency: doc.frequency,
      },
      req,
    });

    const { ensureScheduledReportJobs } = await import('../queues/reportJobs.js');
    await ensureScheduledReportJobs().catch(() => {});

    return this.#mapSchedule(doc.toObject());
  }

  async updateScheduled(id, body, { actorId } = {}) {
    const doc = await ScheduledReport.findOne({ _id: id, deletedAt: null });
    if (!doc) throw ApiError.notFound('Scheduled report not found');
    if (body.name != null) doc.name = body.name;
    if (body.frequency != null) {
      doc.frequency = body.frequency;
      doc.nextRunAt = this.#computeNextRun(body.frequency);
    }
    if (body.format != null) doc.format = body.format;
    if (body.filters != null) doc.filters = body.filters;
    if (body.recipients != null) doc.recipients = body.recipients;
    if (body.isActive != null) doc.isActive = body.isActive;
    await doc.save();
    return this.#mapSchedule(doc.toObject());
  }

  async deleteScheduled(id) {
    const doc = await ScheduledReport.findOne({ _id: id, deletedAt: null });
    if (!doc) throw ApiError.notFound('Scheduled report not found');
    doc.deletedAt = new Date();
    doc.isActive = false;
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }

  async runDueScheduledReports() {
    const now = new Date();
    const due = await ScheduledReport.find({
      deletedAt: null,
      isActive: true,
      nextRunAt: { $lte: now },
    }).limit(20);

    let processed = 0;
    for (const schedule of due) {
      try {
        await this.generateReport(schedule.reportType, schedule.filters || {}, { audit: false });
        schedule.lastRunAt = now;
        schedule.lastRunStatus = 'COMPLETED';
        schedule.nextRunAt = this.#computeNextRun(schedule.frequency, now);
        await schedule.save();
        processed += 1;
      } catch (err) {
        schedule.lastRunAt = now;
        schedule.lastRunStatus = 'FAILED';
        schedule.nextRunAt = this.#computeNextRun(schedule.frequency, now);
        await schedule.save();
      }
    }
    return { processed };
  }

  // ─── Saved filters ─────────────────────────────────────────────────

  async listSavedFilters(userId, scope) {
    const filter = { deletedAt: null, userId };
    if (scope) filter.scope = scope;
    const items = await SavedReportFilter.find(filter).sort({ updatedAt: -1 }).lean();
    return {
      items: items.map((f) => ({
        id: f._id.toString(),
        name: f.name,
        scope: f.scope,
        filters: f.filters,
        isDefault: f.isDefault,
      })),
    };
  }

  async saveFilter(body, userId) {
    const doc = await SavedReportFilter.create({
      name: body.name,
      userId,
      scope: body.scope,
      filters: body.filters || {},
      isDefault: Boolean(body.isDefault),
    });
    return {
      id: doc._id.toString(),
      name: doc.name,
      scope: doc.scope,
      filters: doc.filters,
      isDefault: doc.isDefault,
    };
  }

  async deleteSavedFilter(id, userId) {
    const doc = await SavedReportFilter.findOne({ _id: id, userId, deletedAt: null });
    if (!doc) throw ApiError.notFound('Saved filter not found');
    doc.deletedAt = new Date();
    await doc.save();
    return { id: doc._id.toString(), deleted: true };
  }

  #computeNextRun(frequency, from = new Date()) {
    const next = new Date(from);
    if (frequency === SCHEDULE_FREQUENCY.WEEKLY) {
      next.setDate(next.getDate() + 7);
    } else if (frequency === SCHEDULE_FREQUENCY.MONTHLY) {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(7, 0, 0, 0);
    return next;
  }

  #mapSchedule(s) {
    return {
      id: s._id.toString(),
      name: s.name,
      reportType: s.reportType,
      frequency: s.frequency,
      format: s.format,
      filters: s.filters,
      recipients: s.recipients || [],
      isActive: s.isActive,
      lastRunAt: s.lastRunAt,
      nextRunAt: s.nextRunAt,
      lastRunStatus: s.lastRunStatus,
      createdAt: s.createdAt,
    };
  }

  // ─── Tabular report builders ───────────────────────────────────────

  async #reportAppointments(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });
    const rows = await Appointment.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ appointmentDate: -1 })
      .limit(2000)
      .lean();
    const dmap = await doctorNameMap(rows.map((a) => a.doctorId));
    return {
      columns: [
        { key: 'appointmentNumber', label: 'Appointment #' },
        { key: 'date', label: 'Date' },
        { key: 'patient', label: 'Patient' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'status', label: 'Status' },
        { key: 'type', label: 'Type' },
      ],
      rows: rows.map((a) => ({
        appointmentNumber: a.appointmentNumber,
        date: a.appointmentDate?.toISOString?.()?.slice(0, 10) || '',
        patient: personName(a.patientId),
        doctor: dmap[a.doctorId?.toString()]?.name || '',
        status: a.status,
        type: a.appointmentType,
      })),
    };
  }

  async #reportRevenue(filters) {
    const match = applyCommonMatch(
      { status: 'RECORDED' },
      filters,
      { dateField: 'paidAt', includeDoctor: false }
    );
    const rows = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          // Revenue rows are grouped by the clinic's day, not the UTC day.
          _id: dayBucket('$paidAt'),
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);
    return {
      columns: [
        { key: 'date', label: 'Date' },
        { key: 'amount', label: 'Amount' },
        { key: 'payments', label: 'Payments' },
      ],
      rows: rows.map((r) => ({ date: r._id, amount: roundMoney(r.amount), payments: r.count })),
    };
  }

  async #reportPayments(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'paidAt', includeDoctor: false });
    if (filters.paymentStatus) match.status = filters.paymentStatus;
    const rows = await Payment.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ paidAt: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'paymentNumber', label: 'Payment #' },
        { key: 'receiptNumber', label: 'Receipt #' },
        { key: 'patient', label: 'Patient' },
        { key: 'amount', label: 'Amount' },
        { key: 'method', label: 'Method' },
        { key: 'status', label: 'Status' },
        { key: 'paidAt', label: 'Paid At' },
      ],
      rows: rows.map((p) => ({
        paymentNumber: p.paymentNumber,
        receiptNumber: p.receiptNumber,
        patient: personName(p.patientId),
        amount: roundMoney(p.amount),
        method: p.method,
        status: p.status,
        paidAt: p.paidAt?.toISOString?.() || '',
      })),
    };
  }

  async #reportInvoices(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'invoiceDate' });
    if (filters.paymentStatus) match.paymentStatus = filters.paymentStatus;
    const rows = await Invoice.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ invoiceDate: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'patient', label: 'Patient' },
        { key: 'total', label: 'Total' },
        { key: 'paidAmount', label: 'Paid' },
        { key: 'balanceAmount', label: 'Balance' },
        { key: 'paymentStatus', label: 'Payment Status' },
        { key: 'status', label: 'Status' },
      ],
      rows: rows.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        patient: personName(i.patientId),
        total: roundMoney(i.total),
        paidAmount: roundMoney(i.paidAmount),
        balanceAmount: roundMoney(i.balanceAmount),
        paymentStatus: i.paymentStatus,
        status: i.status,
      })),
    };
  }

  async #reportTreatments(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'scheduledDate' });
    const rows = await TreatmentSession.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ scheduledDate: -1 })
      .limit(2000)
      .lean();
    const dmap = await doctorNameMap(rows.map((s) => s.doctorId));
    return {
      columns: [
        { key: 'sessionNumber', label: 'Session #' },
        { key: 'patient', label: 'Patient' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'status', label: 'Status' },
        { key: 'scheduledDate', label: 'Scheduled' },
        { key: 'duration', label: 'Duration' },
      ],
      rows: rows.map((s) => ({
        sessionNumber: s.sessionNumber,
        patient: personName(s.patientId),
        doctor: dmap[s.doctorId?.toString()]?.name || '',
        status: s.status,
        scheduledDate: s.scheduledDate?.toISOString?.()?.slice(0, 10) || '',
        duration: s.duration || 0,
      })),
    };
  }

  async #reportConsultations(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'startedAt' });
    const rows = await Consultation.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ startedAt: -1 })
      .limit(2000)
      .lean();
    const dmap = await doctorNameMap(rows.map((c) => c.doctorId));
    return {
      columns: [
        { key: 'consultationNumber', label: 'Consultation #' },
        { key: 'patient', label: 'Patient' },
        { key: 'doctor', label: 'Doctor' },
        { key: 'status', label: 'Status' },
        { key: 'duration', label: 'Duration' },
        { key: 'startedAt', label: 'Started' },
      ],
      rows: rows.map((c) => ({
        consultationNumber: c.consultationNumber,
        patient: personName(c.patientId),
        doctor: dmap[c.doctorId?.toString()]?.name || '',
        status: c.status,
        duration: c.duration || 0,
        startedAt: c.startedAt?.toISOString?.() || '',
      })),
    };
  }

  async #reportPatients(filters) {
    const match = { deletedAt: null };
    if (filters.branchId) match.primaryBranchId = filters.branchId;
    if (filters.doctorId) match.primaryDoctorId = filters.doctorId;
    if (filters.dateFrom || filters.dateTo) {
      match.registrationDate = {};
      if (filters.dateFrom) match.registrationDate.$gte = filters.dateFrom;
      if (filters.dateTo) match.registrationDate.$lte = filters.dateTo;
    }
    const rows = await Patient.find(match).sort({ registrationDate: -1 }).limit(2000).lean();
    return {
      columns: [
        { key: 'mrn', label: 'MRN' },
        { key: 'fullName', label: 'Name' },
        { key: 'gender', label: 'Gender' },
        { key: 'status', label: 'Status' },
        { key: 'registrationDate', label: 'Registered' },
      ],
      rows: rows.map((p) => ({
        mrn: p.mrn,
        fullName: personName(p),
        gender: p.gender,
        status: p.status,
        registrationDate: p.registrationDate?.toISOString?.()?.slice(0, 10) || '',
      })),
    };
  }

  async #reportDoctors(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'appointmentDate' });
    const rows = await Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$doctorId',
          appointments: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          noShows: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
        },
      },
      { $sort: { appointments: -1 } },
      { $limit: 100 },
    ]);
    const map = await doctorNameMap(rows.map((r) => r._id));
    return {
      columns: [
        { key: 'doctor', label: 'Doctor' },
        { key: 'code', label: 'Code' },
        { key: 'appointments', label: 'Appointments' },
        { key: 'completed', label: 'Completed' },
        { key: 'noShows', label: 'No Shows' },
      ],
      rows: rows.map((r) => ({
        doctor: r._id ? map[r._id.toString()]?.name || 'Unknown' : 'Unassigned',
        code: r._id ? map[r._id.toString()]?.doctorCode || '' : '',
        appointments: r.appointments,
        completed: r.completed,
        noShows: r.noShows,
      })),
    };
  }

  async #reportLeads(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'createdAt', includeDoctor: false });
    if (filters.leadSource) match.source = filters.leadSource;
    const rows = await Lead.find(match).sort({ createdAt: -1 }).limit(2000).lean();
    return {
      columns: [
        { key: 'leadNumber', label: 'Lead #' },
        { key: 'fullName', label: 'Name' },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Priority' },
        { key: 'createdAt', label: 'Created' },
      ],
      rows: rows.map((l) => ({
        leadNumber: l.leadNumber,
        fullName: personName(l),
        source: l.source,
        status: l.status,
        priority: l.priority,
        createdAt: l.createdAt?.toISOString?.()?.slice(0, 10) || '',
      })),
    };
  }

  async #reportInventory(filters) {
    const match = { deletedAt: null };
    if (filters.branchId) match.branchId = filters.branchId;
    const rows = await InventoryItem.find(match).sort({ currentStock: 1 }).limit(2000).lean();
    return {
      columns: [
        { key: 'name', label: 'Item' },
        { key: 'sku', label: 'SKU' },
        { key: 'currentStock', label: 'Stock' },
        { key: 'reorderLevel', label: 'Reorder' },
        { key: 'status', label: 'Status' },
      ],
      rows: rows.map((i) => ({
        name: i.name,
        sku: i.sku || i.itemCode || '',
        currentStock: i.currentStock,
        reorderLevel: i.reorderLevel,
        status: i.status,
      })),
    };
  }

  async #reportPharmacy(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'dispensedAt', includeDoctor: false });
    const rows = await Dispense.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ dispensedAt: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'dispenseNumber', label: 'Dispense #' },
        { key: 'patient', label: 'Patient' },
        { key: 'status', label: 'Status' },
        { key: 'items', label: 'Items' },
        { key: 'dispensedAt', label: 'Dispensed At' },
      ],
      rows: rows.map((d) => ({
        dispenseNumber: d.dispenseNumber,
        patient: personName(d.patientId),
        status: d.status,
        items: (d.items || []).length,
        dispensedAt: d.dispensedAt?.toISOString?.() || '',
      })),
    };
  }

  async #reportQueue(filters) {
    const match = applyCommonMatch({}, filters, { dateField: 'queueDate' });
    const rows = await QueueEntry.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ queueDate: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'tokenNumber', label: 'Token' },
        { key: 'patient', label: 'Patient' },
        { key: 'queueStatus', label: 'Status' },
        { key: 'isWalkIn', label: 'Walk-in' },
        { key: 'queueDate', label: 'Date' },
      ],
      rows: rows.map((q) => ({
        tokenNumber: q.tokenNumber,
        patient: personName(q.patientId),
        queueStatus: q.queueStatus,
        isWalkIn: q.isWalkIn ? 'Yes' : 'No',
        queueDate: q.queueDate?.toISOString?.()?.slice(0, 10) || '',
      })),
    };
  }

  // ─── Loyalty & Rewards (LOY) reports ────────────────────────────────
  // Read-only aggregations over LoyaltyLedgerEntry (source of truth, append-only) and
  // LoyaltyBalanceCache (fast-read liability snapshot) — never writes to either.

  /** Outstanding point-value owed to patients right now — sum of every patient's cached
   *  currentBalance, valued at the program's current conversion rate (₹1 = redemptionPointsPerRupee
   *  points), one row per patient with a non-zero balance. */
  async #reportLoyaltyLiability(filters) {
    const match = { currentBalance: { $gt: 0 } };
    const rows = await LoyaltyBalanceCache.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ currentBalance: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'patient', label: 'Patient' },
        { key: 'mrn', label: 'MRN' },
        { key: 'currentBalance', label: 'Points Balance' },
        { key: 'redeemableBalance', label: 'Redeemable Points' },
        { key: 'lifetimeEarned', label: 'Lifetime Earned' },
        { key: 'lifetimeRedeemed', label: 'Lifetime Redeemed' },
        { key: 'recalculatedAt', label: 'As Of' },
      ],
      rows: rows.map((c) => ({
        patient: personName(c.patientId),
        mrn: c.patientId?.mrn || '',
        currentBalance: c.currentBalance,
        redeemableBalance: c.redeemableBalance,
        lifetimeEarned: c.lifetimeEarned,
        lifetimeRedeemed: c.lifetimeRedeemed,
        recalculatedAt: c.recalculatedAt?.toISOString?.() || '',
      })),
    };
  }

  #loyaltyDateMatch(filters) {
    const match = {};
    if (filters.branchId) match.branchId = filters.branchId;
    if (filters.dateFrom || filters.dateTo) {
      match.createdAt = {};
      if (filters.dateFrom) match.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) match.createdAt.$lte = filters.dateTo;
    }
    return match;
  }

  /** Points credited over the date range, grouped by ruleCode/event type (E1–E12, CUSTOM). */
  async #reportLoyaltyIssuance(filters) {
    const match = {
      ...this.#loyaltyDateMatch(filters),
      entryType: { $in: [LOYALTY_ENTRY_TYPE.CREDIT, LOYALTY_ENTRY_TYPE.MANUAL_CREDIT] },
    };
    const rows = await LoyaltyLedgerEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: { ruleCode: '$ruleCode', entryType: '$entryType' },
          points: { $sum: '$points' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { points: -1 } },
      { $limit: 500 },
    ]);
    return {
      columns: [
        { key: 'ruleCode', label: 'Rule / Event Code' },
        { key: 'entryType', label: 'Entry Type' },
        { key: 'points', label: 'Points Issued' },
        { key: 'transactions', label: 'Transactions' },
      ],
      rows: rows.map((r) => ({
        ruleCode: r._id.ruleCode || (r._id.entryType === LOYALTY_ENTRY_TYPE.MANUAL_CREDIT ? LOYALTY_EARNING_EVENT.MANUAL_GOODWILL : 'UNSPECIFIED'),
        entryType: r._id.entryType,
        points: r.points,
        transactions: r.transactions,
      })),
    };
  }

  /** Points redeemed over the date range, with the INR value redeemed against. */
  async #reportLoyaltyRedemption(filters) {
    const match = {
      ...this.#loyaltyDateMatch(filters),
      entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
    };
    const rows = await LoyaltyLedgerEntry.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();
    const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
    const totalInr = rows.reduce((s, r) => s + (Number(r.redeemedValueInr) || 0), 0);
    return {
      columns: [
        { key: 'patient', label: 'Patient' },
        { key: 'mrn', label: 'MRN' },
        { key: 'points', label: 'Points Redeemed' },
        { key: 'redeemedValueInr', label: 'INR Value' },
        { key: 'invoiceId', label: 'Invoice' },
        { key: 'redeemedAt', label: 'Redeemed At' },
      ],
      rows: [
        ...rows.map((r) => ({
          patient: personName(r.patientId),
          mrn: r.patientId?.mrn || '',
          points: r.points,
          redeemedValueInr: roundMoney(r.redeemedValueInr),
          invoiceId: r.sourceRefId?.toString?.() || '',
          redeemedAt: r.createdAt?.toISOString?.() || '',
        })),
        { patient: 'TOTAL', mrn: '', points: totalPoints, redeemedValueInr: roundMoney(totalInr), invoiceId: '', redeemedAt: '' },
      ],
    };
  }

  /** Points expired over the date range (DEBIT_EXPIRY entries written by the expiry job). */
  async #reportLoyaltyExpiry(filters) {
    const match = {
      ...this.#loyaltyDateMatch(filters),
      entryType: LOYALTY_ENTRY_TYPE.DEBIT_EXPIRY,
    };
    const rows = await LoyaltyLedgerEntry.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'patient', label: 'Patient' },
        { key: 'mrn', label: 'MRN' },
        { key: 'points', label: 'Points Expired' },
        { key: 'expiredAt', label: 'Expired At' },
      ],
      rows: rows.map((r) => ({
        patient: personName(r.patientId),
        mrn: r.patientId?.mrn || '',
        points: r.points,
        expiredAt: r.createdAt?.toISOString?.() || '',
      })),
    };
  }

  /** REFERRAL_REFERRER/REFERRAL_REFEREE credits over the date range. */
  async #reportLoyaltyReferral(filters) {
    const match = {
      ...this.#loyaltyDateMatch(filters),
      ruleCode: { $in: [LOYALTY_EARNING_EVENT.REFERRAL_REFERRER, LOYALTY_EARNING_EVENT.REFERRAL_REFEREE] },
    };
    const rows = await LoyaltyLedgerEntry.find(match)
      .populate('patientId', 'firstName middleName lastName mrn')
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();
    return {
      columns: [
        { key: 'patient', label: 'Patient' },
        { key: 'mrn', label: 'MRN' },
        { key: 'side', label: 'Referral Side' },
        { key: 'points', label: 'Points' },
        { key: 'referralId', label: 'Referral' },
        { key: 'createdAt', label: 'Date' },
      ],
      rows: rows.map((r) => ({
        patient: personName(r.patientId),
        mrn: r.patientId?.mrn || '',
        side: r.ruleCode,
        points: r.points,
        referralId: r.sourceRefId?.toString?.() || '',
        createdAt: r.createdAt?.toISOString?.() || '',
      })),
    };
  }
}

export default ReportService;
