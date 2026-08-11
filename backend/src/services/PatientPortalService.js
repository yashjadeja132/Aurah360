import mongoose from 'mongoose';
import Patient from '../models/Patient.model.js';
import PatientFeedback from '../models/PatientFeedback.model.js';
import Notification from '../models/Notification.model.js';
import Invoice from '../models/Invoice.model.js';
import Appointment from '../models/Appointment.model.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import PatientService from './PatientService.js';
import PatientDocumentService from './PatientDocumentService.js';
import PatientTimelineService from './PatientTimelineService.js';
import AppointmentService from './AppointmentService.js';
import AppointmentLifecycleService from './AppointmentLifecycleService.js';
import ConsultationService from './ConsultationService.js';
import PrescriptionService from './PrescriptionService.js';
import TreatmentPlanService from './TreatmentPlanService.js';
import TreatmentSessionService from './TreatmentSessionService.js';
import BillingService from './BillingService.js';
import LoyaltyLedgerService from './LoyaltyLedgerService.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import ReferralService from './ReferralService.js';
import config from '../config/index.js';
import AuditService from './AuditService.js';
import ApiError from '../libs/ApiError.js';
import { assertOwnPatient } from '../middlewares/patientAuth.middleware.js';
import { APPOINTMENT_CHANGE_MIN_HOURS, PATIENT_PORTAL_EVENTS } from '../enums/patientPortal.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { eventBus } from '../events/eventBus.js';
import { NOTIFICATION_CHANNEL } from '../enums/notification.js';
import PrivacyRequest from '../models/PrivacyRequest.model.js';
import { PRIVACY_REQUEST_STATUS } from '../enums/privacy.js';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function appointmentDateTime(appointment) {
  const date = new Date(appointment.appointmentDate || appointment.date);
  const time = appointment.startTime || '00:00';
  const [h, m] = String(time).split(':').map(Number);
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

class PatientPortalService {
  constructor() {
    this.patientService = new PatientService();
    this.documentService = new PatientDocumentService();
    this.timelineService = new PatientTimelineService();
    this.appointmentService = new AppointmentService();
    this.lifecycleService = new AppointmentLifecycleService();
    this.consultationService = new ConsultationService();
    this.prescriptionService = new PrescriptionService();
    this.planService = new TreatmentPlanService();
    this.sessionService = new TreatmentSessionService();
    this.billingService = new BillingService();
    this.loyaltyLedgerService = new LoyaltyLedgerService();
    this.referralService = new ReferralService();
    this.audit = new AuditService();
  }

  #assertId(id) {
    if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest('Invalid id');
  }

  async #ownedAppointment(patientId, appointmentId) {
    this.#assertId(appointmentId);
    const apt = await this.appointmentService.getById(appointmentId);
    assertOwnPatient(apt.patientId?.id || apt.patientId, patientId);
    return apt;
  }

  #assertChangePolicy(appointment) {
    const when = appointmentDateTime(appointment);
    const hours = (when.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hours < APPOINTMENT_CHANGE_MIN_HOURS) {
      throw ApiError.badRequest(
        `Appointments can only be changed at least ${APPOINTMENT_CHANGE_MIN_HOURS} hours in advance`
      );
    }
    const allowed = ['SCHEDULED', 'CONFIRMED'];
    if (!allowed.includes(appointment.status)) {
      throw ApiError.badRequest(`Cannot change appointment in status ${appointment.status}`);
    }
  }

  // ─── Dashboard ─────────────────────────────────────────────────────

  async dashboard(patientId) {
    const todayStart = startOfDay();
    const todayEnd = endOfDay();

    const [
      upcoming,
      todayTreatments,
      pendingInvoices,
      prescriptions,
      consultations,
      notifications,
      documents,
      plans,
    ] = await Promise.all([
      Appointment.find({
        patientId,
        deletedAt: null,
        appointmentDate: { $gte: todayStart },
        status: { $nin: ['CANCELLED', 'NO_SHOW', 'COMPLETED'] },
      })
        .sort({ appointmentDate: 1, startTime: 1 })
        .limit(5)
        .lean(),
      TreatmentSession.find({
        patientId,
        deletedAt: null,
        scheduledDate: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ scheduledDate: 1 })
        .limit(10)
        .lean(),
      Invoice.find({
        patientId,
        deletedAt: null,
        paymentStatus: { $in: ['PENDING', 'PARTIALLY_PAID'] },
        status: { $ne: 'VOID' },
      })
        .sort({ invoiceDate: -1 })
        .limit(5)
        .lean(),
      this.prescriptionService.listByPatient(patientId),
      this.consultationService.listByPatient(patientId),
      Notification.find({
        patientId,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        archivedAt: null,
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      this.documentService.listPatientVisible(patientId),
      this.planService.listByPatient(patientId),
    ]);

    const progress = [];
    for (const plan of (plans || []).slice(0, 3)) {
      try {
        const p = await this.sessionService.getProgress(plan.id || plan._id);
        // Carry the human-readable identity through: the portal showed patients a truncated
        // ObjectId ("Plan a3f9e2") because the title never reached it. A patient recognises the
        // treatment by name, never by id.
        progress.push({
          planId: plan.id || plan._id?.toString(),
          planTitle: plan.title || null,
          planNumber: plan.planNumber || null,
          ...p,
        });
      } catch {
        /* ignore */
      }
    }

    const outstanding = pendingInvoices.reduce(
      (s, i) => s + (Number(i.balanceAmount) || 0),
      0
    );

    return {
      upcomingAppointment: upcoming[0]
        ? {
            id: upcoming[0]._id.toString(),
            appointmentNumber: upcoming[0].appointmentNumber,
            appointmentDate: upcoming[0].appointmentDate,
            startTime: upcoming[0].startTime,
            status: upcoming[0].status,
          }
        : null,
      upcomingAppointments: upcoming.map((a) => ({
        id: a._id.toString(),
        appointmentNumber: a.appointmentNumber,
        appointmentDate: a.appointmentDate,
        startTime: a.startTime,
        status: a.status,
      })),
      todaysTreatments: todayTreatments.map((t) => ({
        id: t._id.toString(),
        sessionNumber: t.sessionNumber,
        status: t.status,
        scheduledDate: t.scheduledDate,
      })),
      pendingInvoices: pendingInvoices.map((i) => ({
        id: i._id.toString(),
        invoiceNumber: i.invoiceNumber,
        total: i.total,
        balanceAmount: i.balanceAmount,
        paymentStatus: i.paymentStatus,
      })),
      outstandingBalance: Math.round(outstanding * 100) / 100,
      prescriptionSummary: (Array.isArray(prescriptions) ? prescriptions : prescriptions?.items || [])
        .slice(0, 5)
        .map((p) => ({
          id: p.id || p._id?.toString(),
          prescriptionNumber: p.prescriptionNumber,
          status: p.status,
          finalizedAt: p.finalizedAt,
        })),
      recentConsultation: (Array.isArray(consultations)
        ? consultations
        : consultations?.items || [])[0] || null,
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        subject: n.subject,
        message: n.message,
        isRead: Boolean(n.readAt),
        createdAt: n.createdAt,
      })),
      documents: (documents || []).slice(0, 5),
      treatmentProgress: progress,
    };
  }

  // ─── Dependents (APP-006) ────────────────────────────────────────────
  // Dependent-scoped variants below (dependentAppointments/dependentInvoices/
  // dependentDocuments/dependentTreatmentPlans/bookDependentAppointment) let a
  // guardian act on a dependent's data; each re-verifies guardianship via
  // #assertGuardianOf before delegating to the corresponding own-patient method.

  /** Patients this guardian is registered to manage (Patient.guardianPatientId). */
  async listDependents(guardianPatientId) {
    this.#assertId(guardianPatientId);
    const dependents = await Patient.find({
      guardianPatientId,
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .lean();

    return dependents.map((d) => ({
      id: d._id.toString(),
      mrn: d.mrn,
      fullName: [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' '),
      firstName: d.firstName,
      lastName: d.lastName,
      gender: d.gender,
      dateOfBirth: d.dateOfBirth,
      photo: d.photo,
      relationship: d.guardianRelationship,
      guardianVerified: Boolean(d.guardianVerified),
    }));
  }

  /** Dashboard for a dependent, scoped after verifying the requester is their guardian. */
  async dependentDashboard(guardianPatientId, dependentId) {
    const dependent = await this.#assertGuardianOf(guardianPatientId, dependentId);

    const data = await this.dashboard(dependentId);
    return {
      ...data,
      dependent: {
        id: dependent._id.toString(),
        fullName: [dependent.firstName, dependent.middleName, dependent.lastName]
          .filter(Boolean)
          .join(' '),
        relationship: dependent.guardianRelationship,
      },
    };
  }

  /**
   * Verifies guardianPatientId is the guardian of dependentId; returns the dependent doc.
   *
   * TWO checks, both required (PAT-005):
   *  1. the link exists — this record names that guardian; and
   *  2. `guardianVerified` — a staff member actually confirmed the relationship at the desk.
   *
   * (1) alone is not an authorisation: the guardian fields are populated at registration from
   * whatever the person at the counter said, so without (2) anyone who got themselves recorded as
   * a guardian would read that dependent's entire clinical record through the portal. Verification
   * is set only by staff via PatientService.setGuardianVerified() and is stripped from every
   * client-writable payload, so it cannot be self-asserted.
   */
  async #assertGuardianOf(guardianPatientId, dependentId) {
    this.#assertId(dependentId);
    const dependent = await Patient.findOne({ _id: dependentId, deletedAt: null }).lean();
    if (!dependent) throw ApiError.notFound('Dependent not found');
    assertOwnPatient(dependent.guardianPatientId, guardianPatientId);
    if (!dependent.guardianVerified) {
      throw ApiError.forbidden(
        'This guardian relationship has not been verified by the clinic yet. Please visit or call '
          + 'the clinic with proof of guardianship to have it verified before accessing these records.',
        'GUARDIAN_NOT_VERIFIED'
      );
    }
    return dependent;
  }

  /** Appointments for a dependent, scoped after verifying guardian ownership. */
  async dependentAppointments(guardianPatientId, dependentId, query = {}) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.listAppointments(dependentId, query);
  }

  /** Invoices for a dependent, scoped after verifying guardian ownership. */
  async dependentInvoices(guardianPatientId, dependentId, query = {}) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.listInvoices(dependentId, query);
  }

  /** Documents for a dependent, scoped after verifying guardian ownership. */
  async dependentDocuments(guardianPatientId, dependentId) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.listDocuments(dependentId);
  }

  /** Treatment plans for a dependent, scoped after verifying guardian ownership. */
  async dependentTreatmentPlans(guardianPatientId, dependentId) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.listTreatmentPlans(dependentId);
  }

  /** Books an appointment on behalf of a dependent, scoped after verifying guardian ownership. */
  async bookDependentAppointment(guardianPatientId, dependentId, payload, req = null) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.bookAppointment(dependentId, payload, req);
  }

  /** Health timeline for a dependent, scoped after verifying guardian ownership. */
  async dependentTimeline(guardianPatientId, dependentId, query = {}) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.timeline(dependentId, query);
  }

  /** Prescriptions for a dependent, scoped after verifying guardian ownership. */
  async dependentPrescriptions(guardianPatientId, dependentId) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.listPrescriptions(dependentId);
  }

  // ─── Profile ───────────────────────────────────────────────────────

  async getProfile(patientId) {
    return this.patientService.getById(patientId);
  }

  async updateProfile(patientId, payload, req = null) {
    const allowed = {
      firstName: payload.firstName,
      middleName: payload.middleName,
      lastName: payload.lastName,
      alternateMobile: payload.alternateMobile,
      email: payload.email,
      preferredLanguage: payload.preferredLanguage,
      occupation: payload.occupation,
      photo: payload.photo,
      address: payload.address,
      emergencyContact: payload.emergencyContact,
      medical: payload.medical,
    };
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

    const updated = await this.patientService.update(patientId, allowed, null, req);

    await this.audit.record(AUDIT_ACTIONS.PATIENT_PROFILE_UPDATED, {
      metadata: { patientId, fields: Object.keys(allowed) },
      req,
    });

    return updated;
  }

  // ─── Appointments (reuse AppointmentService / Lifecycle) ───────────

  async listAppointments(patientId, query = {}) {
    const history = await this.appointmentService.patientHistory(patientId, {
      limit: Number(query.limit) || 50,
    });
    return history;
  }

  async getAppointment(patientId, id) {
    return this.#ownedAppointment(patientId, id);
  }

  async bookAppointment(patientId, payload, req = null) {
    const patient = await Patient.findById(patientId).lean();
    if (!patient) throw ApiError.notFound('Patient not found');

    const created = await this.appointmentService.create(
      {
        ...payload,
        patientId,
        branchId: payload.branchId || patient.primaryBranchId,
        source: payload.source || 'PATIENT_PORTAL',
      },
      null,
      req
    );
    return created;
  }

  async cancelAppointment(patientId, id, { reason } = {}, req = null) {
    const apt = await this.#ownedAppointment(patientId, id);
    this.#assertChangePolicy(apt);
    return this.lifecycleService.cancel(id, { reason: reason || 'Cancelled by patient' }, null, req);
  }

  async rescheduleAppointment(patientId, id, payload, req = null) {
    const apt = await this.#ownedAppointment(patientId, id);
    this.#assertChangePolicy(apt);
    return this.lifecycleService.reschedule(id, payload, null, req);
  }

  async appointmentCalendar(patientId, { from, to } = {}) {
    const history = await this.appointmentService.patientHistory(patientId, { limit: 200 });
    const items = Array.isArray(history) ? history : history?.items || history?.appointments || [];
    const fromD = from ? startOfDay(new Date(from)) : null;
    const toD = to ? endOfDay(new Date(to)) : null;
    return items.filter((a) => {
      const d = new Date(a.appointmentDate || a.date);
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
      return true;
    });
  }

  async availableSlots(doctorId, date, branchId) {
    return this.appointmentService.getAvailableSlots(doctorId, date, branchId);
  }

  // ─── Consultations (read-only) ─────────────────────────────────────
  // SECURITY (PHI): the patient portal may only ever surface a consultation
  // once a doctor has explicitly released it via
  // ConsultationService#releasePatientSummary (patientFacingReleasedAt set).
  // Raw clinical fields (soap/vitals/diagnosis/examination/photos) must
  // never reach this call path — only the doctor-authored patientFacingSummary.
  // Staff/EMR call paths (ConsultationService.listByPatient/getWorkspace used
  // directly by doctor-facing controllers, and ConsultationService#patientSummary
  // for EMR-008) are untouched and continue to return full clinical data.

  #isReleasedToPatient(consultation) {
    return !!consultation?.patientFacingReleasedAt;
  }

  /** Patient-safe projection of a consultation — no raw clinical fields. */
  #toPatientSafeConsultation(consultation) {
    return {
      id: consultation.id,
      consultationNumber: consultation.consultationNumber,
      status: consultation.status,
      startedAt: consultation.startedAt,
      endedAt: consultation.endedAt,
      doctor: consultation.doctor || null,
      branch: consultation.branch || null,
      appointment: consultation.appointment || null,
      followUp: consultation.followUp || null,
      patientFacingSummary: consultation.patientFacingSummary || null,
      patientFacingReleasedAt: consultation.patientFacingReleasedAt,
    };
  }

  async listConsultations(patientId) {
    const all = await this.consultationService.listByPatient(patientId);
    return all
      .filter((c) => this.#isReleasedToPatient(c))
      .map((c) => this.#toPatientSafeConsultation(c));
  }

  async getConsultation(patientId, id) {
    this.#assertId(id);
    const workspace = await this.consultationService.getWorkspace(id);
    const consultation = workspace.consultation || workspace;
    assertOwnPatient(
      consultation.patientId?.id || consultation.patientId || workspace.patientId,
      patientId
    );

    if (!this.#isReleasedToPatient(consultation)) {
      throw ApiError.notFound('Consultation summary is not yet available');
    }

    // Only the doctor-approved patient-facing summary is exposed — never the
    // raw soap/diagnosis/examination/photos clinical records.
    return {
      consultation: this.#toPatientSafeConsultation(consultation),
      summary: consultation.patientFacingSummary || null,
    };
  }

  async consultationSummaryDownload(patientId, id) {
    const data = await this.getConsultation(patientId, id);
    await this.#logDownload(patientId, 'consultation', id);
    return {
      format: 'json',
      placeholderPdf: true,
      message: 'Use print view; server PDF renderer is a placeholder.',
      data,
    };
  }

  // ─── Prescriptions ─────────────────────────────────────────────────

  async listPrescriptions(patientId) {
    return this.prescriptionService.listByPatient(patientId);
  }

  async getPrescription(patientId, id) {
    this.#assertId(id);
    const rx = await this.prescriptionService.getById(id);
    assertOwnPatient(rx.patientId?.id || rx.patientId, patientId);
    return rx;
  }

  async prescriptionPrint(patientId, id, req = null) {
    await this.getPrescription(patientId, id);
    const data = await this.prescriptionService.getPrintData(id, null, req);
    await this.#logDownload(patientId, 'prescription', id, req);
    return data;
  }

  async prescriptionRefillPlaceholder() {
    return {
      placeholder: true,
      message: 'Prescription refill requests are not enabled yet.',
    };
  }

  // ─── Treatment plans & sessions ────────────────────────────────────

  async listTreatmentPlans(patientId) {
    return this.planService.listByPatient(patientId);
  }

  async getTreatmentPlan(patientId, id) {
    this.#assertId(id);
    const plan = await this.planService.getById(id);
    assertOwnPatient(plan.patientId?.id || plan.patientId, patientId);
    const [progress, consents] = await Promise.all([
      this.sessionService.getProgress(id).catch(() => null),
      this.planService.listConsents(id).catch(() => []),
    ]);
    return { plan, progress, consents };
  }

  async treatmentSummaryDownload(patientId, id) {
    const data = await this.getTreatmentPlan(patientId, id);
    await this.#logDownload(patientId, 'treatment-plan', id);
    return {
      format: 'json',
      placeholderPdf: true,
      message: 'Treatment summary PDF placeholder.',
      data,
    };
  }

  async listTreatmentSessions(patientId, query = {}) {
    return this.sessionService.list({ ...query, patientId });
  }

  async getTreatmentSession(patientId, id) {
    this.#assertId(id);
    const session = await this.sessionService.getById(id);
    assertOwnPatient(session.patientId?.id || session.patientId, patientId);
    return session;
  }

  // ─── Billing ───────────────────────────────────────────────────────

  async listInvoices(patientId, query = {}) {
    return this.billingService.list({ ...query, patientId });
  }

  async getInvoice(patientId, id) {
    this.#assertId(id);
    const invoice = await this.billingService.getById(id);
    assertOwnPatient(invoice.patientId?.id || invoice.patientId, patientId);
    const payments = await this.billingService.listPayments(id);
    return { invoice, payments };
  }

  async invoicePrint(patientId, id, req = null) {
    await this.getInvoice(patientId, id);
    const data = await this.billingService.getPrintData(id, null, req);
    await this.#logDownload(patientId, 'invoice', id, req);
    return data;
  }

  async outstandingBalance(patientId) {
    const result = await this.billingService.list({
      patientId,
      paymentStatus: 'PENDING',
      limit: 100,
    });
    const items = result.items || result || [];
    const partial = await this.billingService.list({
      patientId,
      paymentStatus: 'PARTIALLY_PAID',
      limit: 100,
    });
    const all = [...items, ...(partial.items || partial || [])];
    const balance = all.reduce((s, i) => s + (Number(i.balanceAmount) || 0), 0);
    return { outstandingBalance: Math.round(balance * 100) / 100, invoices: all };
  }

  async paymentReceipt(patientId, paymentId, req = null) {
    this.#assertId(paymentId);
    const receipt = await this.billingService.getPaymentReceipt(paymentId, null, req);
    const invoiceId = receipt.invoiceId || receipt.invoice?.id || receipt.payment?.invoiceId;
    if (invoiceId) {
      await this.getInvoice(patientId, invoiceId);
    }
    return receipt;
  }

  // ─── Documents ─────────────────────────────────────────────────────

  async listDocuments(patientId) {
    return this.documentService.listPatientVisible(patientId);
  }

  async downloadDocument(patientId, documentId, req = null) {
    // Resolved from the same visibility-filtered set as the listing, so an unreleased document is
    // "not found" here rather than downloadable by direct id.
    const docs = await this.documentService.listPatientVisible(patientId);
    const doc = (docs || []).find((d) => (d.id || d._id?.toString()) === documentId);
    if (!doc) throw ApiError.notFound('Document not found');
    await this.#logDownload(patientId, 'document', documentId, req);
    return doc;
  }

  // ─── Notifications (patient-scoped, reuse Notification model) ──────

  async notificationsInbox(patientId, query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const filter = {
      patientId,
      channel: NOTIFICATION_CHANNEL.IN_APP,
    };
    if (query.archived === 'true') filter.archivedAt = { $ne: null };
    else filter.archivedAt = null;

    const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return {
      items: items.map((n) => ({
        id: n._id.toString(),
        notificationId: n.notificationId,
        subject: n.subject,
        message: n.message,
        eventName: n.eventName,
        status: n.status,
        isRead: Boolean(n.readAt),
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    };
  }

  async unreadNotificationCount(patientId) {
    const count = await Notification.countDocuments({
      patientId,
      channel: NOTIFICATION_CHANNEL.IN_APP,
      archivedAt: null,
      readAt: null,
    });
    return { count };
  }

  async markNotificationRead(patientId, id) {
    this.#assertId(id);
    const n = await Notification.findOne({ _id: id, patientId });
    if (!n) throw ApiError.notFound('Notification not found');
    n.readAt = new Date();
    await n.save();
    return { id: n._id.toString(), isRead: true };
  }

  async archiveNotification(patientId, id) {
    this.#assertId(id);
    const n = await Notification.findOne({ _id: id, patientId });
    if (!n) throw ApiError.notFound('Notification not found');
    n.archivedAt = new Date();
    n.readAt = n.readAt || new Date();
    await n.save();
    return { id: n._id.toString(), archived: true };
  }

  // ─── Feedback ──────────────────────────────────────────────────────

  async submitFeedback(patientId, body, req = null) {
    if (!body.clinicRating) throw ApiError.badRequest('Clinic rating is required');
    const isComplaint = Boolean(body.isComplaint) || body.clinicRating <= 2;
    const doc = await PatientFeedback.create({
      patientId,
      doctorId: body.doctorId || null,
      appointmentId: body.appointmentId || null,
      doctorRating: body.doctorRating || null,
      clinicRating: body.clinicRating,
      npsScore: body.npsScore ?? null,
      comments: body.comments || null,
      suggestions: body.suggestions || null,
      isComplaint,
    });

    await this.audit.record(AUDIT_ACTIONS.PATIENT_FEEDBACK_SUBMITTED, {
      metadata: {
        patientId,
        feedbackId: doc._id.toString(),
        clinicRating: doc.clinicRating,
      },
      req,
    });

    eventBus.emitDomain(PATIENT_PORTAL_EVENTS.FEEDBACK_SUBMITTED, {
      patientId,
      feedbackId: doc._id.toString(),
      clinicRating: doc.clinicRating,
      doctorRating: doc.doctorRating,
    });

    return {
      id: doc._id.toString(),
      clinicRating: doc.clinicRating,
      doctorRating: doc.doctorRating,
      comments: doc.comments,
      suggestions: doc.suggestions,
      createdAt: doc.createdAt,
    };
  }

  async listFeedback(patientId) {
    const items = await PatientFeedback.find({ patientId, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return {
      items: items.map((f) => ({
        id: f._id.toString(),
        clinicRating: f.clinicRating,
        doctorRating: f.doctorRating,
        comments: f.comments,
        suggestions: f.suggestions,
        createdAt: f.createdAt,
      })),
    };
  }

  // ─── Privacy / data-subject rights (patient-submitted, §16.5, PRV-002) ──
  // Patient-facing submission for the staff-side workflow already handled by
  // PrivacyGovernanceService (open/verify-identity/resolve). A patient may only
  // create requests scoped to themselves and only ever see their own.

  async submitPrivacyRequest(patientId, { requestType, details } = {}, req = null) {
    this.#assertId(patientId);
    const dueDate = new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30-day SLA, mirrors staff-side default
    const request = await PrivacyRequest.create({
      patientId,
      type: requestType,
      status: PRIVACY_REQUEST_STATUS.OPEN,
      description: details || null,
      dueDate,
      createdBy: null,
    });

    await this.audit.record(AUDIT_ACTIONS.PRIVACY_REQUEST_OPENED, {
      metadata: { privacyRequestId: request._id.toString(), type: requestType, patientId, source: 'PATIENT_PORTAL' },
      req,
    });
    eventBus.emitDomain('PrivacyRequestOpened', {
      privacyRequestId: request._id.toString(),
      patientId,
      type: requestType,
    });

    return request.toSafeObject();
  }

  async listPrivacyRequests(patientId) {
    this.#assertId(patientId);
    const rows = await PrivacyRequest.find({ patientId }).sort({ createdAt: -1 }).limit(100).exec();
    return { items: rows.map((r) => r.toSafeObject()) };
  }

  // ─── Loyalty & Rewards (LOY) ────────────────────────────────────────
  // Thin delegation to LoyaltyLedgerService — the single gate for every loyalty read/write
  // (see LoyaltyLedgerService.js). This portal service only adds the patient-auth/
  // guardian-of-dependent scoping that every other read endpoint in this file applies.

  async loyaltyBalance(patientId) {
    this.#assertId(patientId);
    const [balance, settings] = await Promise.all([
      this.loyaltyLedgerService.getBalance(patientId),
      this.loyaltyLedgerService.getSettings().catch(() => null),
    ]);
    return {
      ...balance,
      programEnabled: Boolean(settings?.programEnabled),
      tiersEnabled: Boolean(settings?.tiersEnabled),
      pointsExpiryMonths: settings?.pointsExpiryMonths ?? null,
      minimumPointsToRedeem: settings?.minimumPointsToRedeem ?? null,
    };
  }

  async loyaltyLedger(patientId, { limit, before } = {}) {
    this.#assertId(patientId);
    return this.loyaltyLedgerService.listLedger(patientId, {
      limit: Number(limit) || 50,
      before: before || null,
    });
  }

  /**
   * LOY-010 — "how to earn" list for the patient app, generated live from the currently-active
   * earning rules instead of hard-coded text (mobile/src/screens/RewardsScreen.js). Only fields
   * safe for a patient to see are returned: rule identity/name and the plain earn formula. No
   * caps, branch overrides, eligibility internals, or approval metadata — those are clinic-
   * internal configuration, not patient-facing content.
   */
  async activeEarnRules() {
    const now = new Date();
    const rules = await LoyaltyEarningRule.find({ isActive: true, deletedAt: null }).lean();

    return rules
      .map((rule) => {
        const version = (rule.versions || [])
          .filter((v) => v.effectiveFrom <= now && (!v.effectiveTo || v.effectiveTo > now))
          .sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0];
        if (!version) return null;
        // E9/E11-style consented-only rules are omitted here rather than shown with a caveat —
        // the portal has no per-patient consent context at this call site, so "requires marketing
        // consent" copy would be misleading to a patient who hasn't opted in.
        if (version.requiresMarketingConsent) return null;

        return {
          ruleCode: rule.ruleCode,
          eventType: rule.eventType,
          name: rule.name,
          formulaType: version.formulaType,
          pointValue: version.pointValue,
          perAmountInr: version.perAmountInr || null,
        };
      })
      .filter(Boolean);
  }

  /**
   * LOY Flow C — "my referrals" for the patient portal. Returns the patient's own code/link and
   * a generic status list for people they referred: first-name-or-null + status only, NEVER any
   * clinical or financial detail about the referee (ReferralService.myReferrals already strips
   * this at the query level).
   */
  async referralSummary(patientId) {
    this.#assertId(patientId);
    const { referralCode, referrals } = await this.referralService.myReferrals(patientId);
    const shareUrl = referralCode ? `${config.patientApp.url}/refer/${referralCode}` : null;
    return { referralCode, shareUrl, referrals };
  }

  /** Loyalty balance for a dependent, scoped after verifying guardian ownership. */
  async dependentLoyaltyBalance(guardianPatientId, dependentId) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.loyaltyBalance(dependentId);
  }

  /** Loyalty ledger for a dependent, scoped after verifying guardian ownership. */
  async dependentLoyaltyLedger(guardianPatientId, dependentId, query = {}) {
    await this.#assertGuardianOf(guardianPatientId, dependentId);
    return this.loyaltyLedger(dependentId, query);
  }

  // ─── Timeline ──────────────────────────────────────────────────────

  async timeline(patientId, query = {}) {
    return this.timelineService.getTimeline(patientId, {
      limit: Number(query.limit) || 100,
    });
  }

  // ─── helpers ───────────────────────────────────────────────────────

  async #logDownload(patientId, kind, resourceId, req = null) {
    await this.audit.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      metadata: { patientId, kind, resourceId: resourceId?.toString?.() || resourceId },
      req,
    });
    eventBus.emitDomain(PATIENT_PORTAL_EVENTS.DOCUMENT_DOWNLOADED, {
      patientId,
      kind,
      resourceId: resourceId?.toString?.() || resourceId,
    });
  }
}

export default PatientPortalService;
