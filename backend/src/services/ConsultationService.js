import ApiError from '../libs/ApiError.js';
import logger from '../libs/logger.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import {
  ConsultationSoapRepository,
  ConsultationVitalsRepository,
  ConsultationDiagnosisRepository,
  ConsultationExaminationRepository,
  ConsultationIntakeRepository,
  ClinicalPhotoRepository,
} from '../repositories/ConsultationClinicalRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import AppointmentLifecycleService from './AppointmentLifecycleService.js';
import AuditService from './AuditService.js';
import PrescriptionRepository from '../repositories/PrescriptionRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import LabOrder, {
  LAB_ORDER_STATUS_TRANSITIONS,
  LAB_ORDER_TERMINAL_STATUSES,
} from '../models/LabOrder.model.js';
import Consultation from '../models/Consultation.model.js';
import { generateConsultationNumber } from '../helpers/consultationNumber.helper.js';
import {
  CONSULTATION_STATUS,
  EDITABLE_CONSULTATION_STATUSES,
  CONTENT_CLASSIFICATION,
} from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT } from '../enums/patient.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import { ROLES } from '../constants/roles.js';

/**
 * Consultation / EMR session service.
 *
 * This service used to hold the line "does NOT modify Appointment records — queue/appointment stay
 * separate". That separation broke the visit lifecycle at exactly one point: SIGNING. Signing is
 * the clinical end of the visit, and with nothing closing the appointment it stayed CHECKED_IN
 * forever — so the doctor's "Start from appointment" list never emptied, the reception dashboard's
 * completed count stayed at zero, and the loyalty engine's VISIT_COMPLETED (which subscribes to
 * appointment completion) never fired for any consulted patient.
 *
 * So sign() — and only sign() — now completes the appointment, and it does so by delegating to
 * AppointmentLifecycleService.complete() rather than writing the status directly, to keep the audit
 * entry, the completedAt stamp and the domain event identical to a front-desk completion. Every
 * other method still leaves appointments alone.
 */
class ConsultationService {
  constructor() {
    this.consultationRepository = new ConsultationRepository();
    this.appointmentRepository = new AppointmentRepository();
    this.doctorRepository = new DoctorRepository();
    this.patientRepository = new PatientRepository();
    this.soapRepository = new ConsultationSoapRepository();
    this.vitalsRepository = new ConsultationVitalsRepository();
    this.diagnosisRepository = new ConsultationDiagnosisRepository();
    this.examinationRepository = new ConsultationExaminationRepository();
    this.intakeRepository = new ConsultationIntakeRepository();
    this.photoRepository = new ClinicalPhotoRepository();
    this.timelineService = new PatientTimelineService();
    this.auditService = new AuditService();
    this.prescriptionRepository = new PrescriptionRepository();
    this.treatmentPlanRepository = new TreatmentPlanRepository();
    this.appointmentLifecycleService = new AppointmentLifecycleService();
  }

  #map(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.patientId?.firstName) {
      extra.patient = {
        id: doc.patientId._id.toString(),
        mrn: doc.patientId.mrn,
        fullName: [doc.patientId.firstName, doc.patientId.lastName].filter(Boolean).join(' '),
        mobile: doc.patientId.mobile,
        dateOfBirth: doc.patientId.dateOfBirth,
        gender: doc.patientId.gender,
        allergies: doc.patientId.allergies,
        medicalHistory: doc.patientId.medicalHistory,
        isVip: doc.patientId.isVip,
        photo: doc.patientId.photo,
      };
      extra.patientId = doc.patientId._id.toString();
    }
    if (doc.doctorId?.doctorCode) {
      const u = doc.doctorId.userId;
      extra.doctor = {
        id: doc.doctorId._id.toString(),
        doctorCode: doc.doctorId.doctorCode,
        name: u ? `${u.firstName} ${u.lastName}`.trim() : null,
      };
      extra.doctorId = doc.doctorId._id.toString();
    }
    if (doc.branchId?.name || doc.branchId?.displayName) {
      extra.branch = {
        id: doc.branchId._id.toString(),
        name: doc.branchId.displayName || doc.branchId.name,
      };
      extra.branchId = doc.branchId._id.toString();
    }
    if (doc.appointmentId?.appointmentNumber) {
      extra.appointment = {
        id: doc.appointmentId._id.toString(),
        appointmentNumber: doc.appointmentId.appointmentNumber,
        startTime: doc.appointmentId.startTime,
        endTime: doc.appointmentId.endTime,
        appointmentDate: doc.appointmentId.appointmentDate,
        status: doc.appointmentId.status,
      };
      extra.appointmentId = doc.appointmentId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  #assertEditable(consultation) {
    if (consultation.locked || consultation.status === CONSULTATION_STATUS.LOCKED) {
      throw ApiError.forbidden('Consultation is locked and cannot be edited');
    }
    if (consultation.status === CONSULTATION_STATUS.SIGNED) {
      throw ApiError.forbidden('Signed consultation cannot be edited');
    }
    if (!EDITABLE_CONSULTATION_STATUSES.includes(consultation.status)) {
      throw ApiError.badRequest('Consultation is not editable in current status');
    }
  }

  /**
   * EMR-004 — lab order status is a state machine, not a free-form field. Mirrors the
   * `Cannot transition ... from X to Y` shape used by CrmService for lead stages.
   */
  #assertLabOrderTransition(from, to) {
    if (LAB_ORDER_TERMINAL_STATUSES.includes(from)) {
      throw ApiError.badRequest(`Lab order is ${from} and can no longer be modified`);
    }
    if (from === to) return;
    const allowed = LAB_ORDER_STATUS_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw ApiError.badRequest(`Cannot transition lab order from ${from} to ${to}`);
    }
  }

  async #ensureChildren(consultationId, actorId) {
    const existingSoap = await this.soapRepository.findByConsultation(consultationId);
    if (!existingSoap) {
      await this.soapRepository.create({
        consultationId,
        versions: [{
          version: 1,
          subjective: '',
          objective: '',
          assessment: '',
          plan: '',
          savedAt: new Date(),
          savedBy: actorId,
        }],
        updatedBy: actorId,
      });
    }
    if (!(await this.vitalsRepository.findByConsultation(consultationId))) {
      await this.vitalsRepository.create({ consultationId, updatedBy: actorId });
    }
    if (!(await this.diagnosisRepository.findByConsultation(consultationId))) {
      await this.diagnosisRepository.create({ consultationId, updatedBy: actorId });
    }
    if (!(await this.examinationRepository.findByConsultation(consultationId))) {
      await this.examinationRepository.create({ consultationId, updatedBy: actorId });
    }
  }

  async start({ appointmentId, chiefComplaint = null }, actorId, req = null) {
    const appointment = await this.appointmentRepository.findByIdNotDeleted(appointmentId);
    if (!appointment) throw ApiError.notFound('Appointment not found');

    const existing = await this.consultationRepository.findLatestByAppointment(appointmentId);
    if (existing) {
      // An in-progress consultation is simply resumed.
      //
      // A FINISHED one (signed/locked/completed) is also returned rather than superseded. The old
      // code fell through and created a second consultation for the same appointment, so a doctor
      // who signed and then clicked "Open EMR" again silently forked a duplicate clinical record
      // for one visit — with the vitals, diagnosis and photos split across the two. Amending a
      // signed record is what unlock() is for (OWNER-only, audited); it is not something that
      // should happen by mis-click.
      return this.getWorkspace(existing._id.toString());
    }

    const consultation = await this.consultationRepository.create({
      consultationNumber: await generateConsultationNumber(),
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      branchId: appointment.branchId,
      status: CONSULTATION_STATUS.IN_PROGRESS,
      startedAt: new Date(),
      chiefComplaint,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.#ensureChildren(consultation._id, actorId);

    await this.timelineService.addEvent(appointment.patientId, {
      eventType: TIMELINE_EVENT.CONSULTATION_STARTED,
      title: 'Consultation started',
      description: consultation.consultationNumber,
      metadata: { consultationId: consultation._id.toString() },
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_STARTED, {
      actorId,
      metadata: {
        consultationId: consultation._id.toString(),
        appointmentId,
        consultationNumber: consultation.consultationNumber,
      },
      req,
    });

    emitQueueEvent(SOCKET_EVENTS.CONSULTATION_STARTED, {
      branchId: appointment.branchId.toString(),
      doctorId: appointment.doctorId.toString(),
      consultationId: consultation._id.toString(),
      appointmentId,
      patientId: appointment.patientId.toString(),
    });

    return this.getWorkspace(consultation._id.toString());
  }

  async getById(id) {
    const doc = await this.consultationRepository.findByIdPopulated(id);
    if (!doc) throw ApiError.notFound('Consultation not found');
    return this.#map(doc);
  }

  async getWorkspace(id) {
    const consultation = await this.getById(id);
    const soap = await this.soapRepository.findByConsultation(id);
    const vitals = await this.vitalsRepository.findByConsultation(id);
    const diagnosis = await this.diagnosisRepository.findByConsultation(id);
    const examination = await this.examinationRepository.findByConsultation(id);
    const intake = await this.intakeRepository.findByConsultation(id);
    const photos = await this.photoRepository.findByConsultation(id);

    return {
      consultation,
      soap: soap ? soap.toSafeObject() : null,
      vitals: vitals ? vitals.toSafeObject() : null,
      diagnosis: diagnosis ? diagnosis.toSafeObject() : null,
      examination: examination ? examination.toSafeObject() : null,
      // §2 guard — surfaced on the workspace so the doctor's consultation view can show an
      // "intake incomplete" badge before/while opening the encounter, without a second fetch.
      intake: intake ? intake.toSafeObject() : null,
      photos: photos.map((p) => p.toSafeObject()),
    };
  }

  async listByPatient(patientId) {
    const rows = await this.consultationRepository.findByPatient(patientId);
    return Promise.all(
      rows.map(async (r) => this.#map(await this.consultationRepository.findByIdPopulated(r._id)))
    );
  }

  async listByDoctor(doctorId, { status = null, limit = 50, branchId = null } = {}) {
    const filter = { doctorId, deletedAt: null };
    if (status) filter.status = status;
    // SEC-030 — branchId is supplied by the caller's resolved scope, not raw client input.
    if (branchId) filter.branchId = branchId;
    const rows = await this.consultationRepository.findMany(filter, {
      sort: { startedAt: -1 },
      limit,
    });
    return Promise.all(
      rows.map(async (r) => this.#map(await this.consultationRepository.findByIdPopulated(r._id)))
    );
  }

  async updateMeta(id, payload, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    this.#assertEditable(consultation);

    const updates = { updatedBy: actorId };
    if (payload.chiefComplaint !== undefined) updates.chiefComplaint = payload.chiefComplaint;
    if (payload.followUp) updates.followUp = { ...consultation.followUp?.toObject?.() || consultation.followUp || {}, ...payload.followUp };
    if (payload.status === CONSULTATION_STATUS.COMPLETED) {
      updates.status = CONSULTATION_STATUS.COMPLETED;
      updates.endedAt = new Date();
      if (consultation.startedAt) {
        updates.duration = Math.round((updates.endedAt - new Date(consultation.startedAt)) / 60000);
      }
    }

    await this.consultationRepository.updateById(id, updates);
    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_SAVED, {
      actorId,
      metadata: { consultationId: id },
      req,
    });

    if (updates.status === CONSULTATION_STATUS.COMPLETED) {
      emitQueueEvent(SOCKET_EVENTS.CONSULTATION_COMPLETED, {
        branchId: consultation.branchId.toString(),
        doctorId: consultation.doctorId.toString(),
        consultationId: id,
      });
    }

    return this.getWorkspace(id);
  }

  async sign(id, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (consultation.locked) throw ApiError.badRequest('Consultation is already locked');
    if (consultation.status === CONSULTATION_STATUS.SIGNED) {
      throw ApiError.badRequest('Consultation is already signed');
    }

    // Doc §3.8 — signing must be blocked while mandatory clinical fields are still empty; a signed
    // note that never actually says what the assessment/plan was is a real clinical-record defect,
    // not a formality. Assessment and Plan come from the SOAP note; a diagnosis (favorites or free
    // text — either is acceptable per §3.1) must also be recorded. This mirrors the existing
    // guard style elsewhere in this codebase (name the exact missing field, one ApiError.badRequest).
    const [soapForGuard, diagnosisForGuard] = await Promise.all([
      this.soapRepository.findByConsultation(id),
      this.diagnosisRepository.findByConsultation(id),
    ]);
    const missing = [];
    if (!soapForGuard?.assessment?.trim()) missing.push('Assessment');
    if (!soapForGuard?.plan?.trim()) missing.push('Plan');
    if (!diagnosisForGuard?.primaryDiagnosis?.trim()) missing.push('Diagnosis');
    if (missing.length) {
      throw ApiError.badRequest(
        `Cannot sign — required field(s) missing: ${missing.join(', ')}`,
        null,
        'CONSULTATION_MANDATORY_FIELDS_MISSING'
      );
    }

    const endedAt = consultation.endedAt || new Date();
    const duration = consultation.startedAt
      ? Math.round((endedAt - new Date(consultation.startedAt)) / 60000)
      : consultation.duration;

    await this.consultationRepository.updateById(id, {
      status: CONSULTATION_STATUS.SIGNED,
      signedByDoctor: actorId,
      signedAt: new Date(),
      endedAt,
      duration,
      updatedBy: actorId,
    });

    const soap = await this.soapRepository.findByConsultation(id);
    if (soap) {
      await this.soapRepository.updateById(soap._id, { isDraft: false, updatedBy: actorId });
    }

    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_SIGNED, {
      actorId,
      metadata: { consultationId: id },
      req,
    });

    await this.timelineService.addEvent(consultation.patientId, {
      eventType: TIMELINE_EVENT.CONSULTATION_SIGNED,
      title: 'Consultation signed',
      description: consultation.consultationNumber,
      metadata: { consultationId: id },
      actorId,
    });

    await this.#completeAppointmentForSignedConsultation(consultation, actorId, req);

    emitQueueEvent(SOCKET_EVENTS.CONSULTATION_COMPLETED, {
      branchId: consultation.branchId.toString(),
      doctorId: consultation.doctorId.toString(),
      consultationId: id,
    });

    return this.getWorkspace(id);
  }

  /**
   * Closes out the appointment behind a just-signed consultation.
   *
   * Deliberately best-effort: the clinical record is already signed and persisted by this point,
   * and a signature must never be rejected because of a bookkeeping transition. The appointment may
   * also legitimately be in a state complete() refuses (already COMPLETED from the front desk, or
   * CANCELLED after the fact) — those are normal, not errors, so they are skipped quietly rather
   * than surfaced to the doctor. Anything genuinely unexpected is logged for follow-up.
   */
  async #completeAppointmentForSignedConsultation(consultation, actorId, req) {
    if (!consultation.appointmentId) return;
    const appointmentId = consultation.appointmentId.toString();
    try {
      const appointment = await this.appointmentRepository.findByIdNotDeleted(appointmentId);
      if (!appointment) return;
      const alreadyClosed = [
        APPOINTMENT_STATUS.COMPLETED,
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW,
      ].includes(appointment.status);
      if (alreadyClosed) return;

      await this.appointmentLifecycleService.complete(appointmentId, actorId, req);
    } catch (error) {
      logger.warn('Consultation signed but appointment could not be completed', {
        consultationId: consultation._id.toString(),
        appointmentId,
        message: error.message,
      });
    }
  }

  async lock(id, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (consultation.status !== CONSULTATION_STATUS.SIGNED) {
      throw ApiError.badRequest('Only signed consultations can be locked');
    }

    await this.consultationRepository.updateById(id, {
      status: CONSULTATION_STATUS.LOCKED,
      locked: true,
      lockedAt: new Date(),
      lockedBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_LOCKED, {
      actorId,
      metadata: { consultationId: id },
      req,
    });

    emitQueueEvent(SOCKET_EVENTS.CONSULTATION_LOCKED, {
      branchId: consultation.branchId.toString(),
      doctorId: consultation.doctorId.toString(),
      consultationId: id,
    });

    return this.getWorkspace(id);
  }

  async unlock(id, actorId, actorRole, _req = null) {
    if (actorRole !== ROLES.OWNER) {
      throw ApiError.forbidden('Only Owner can unlock a consultation');
    }
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (!consultation.locked && consultation.status !== CONSULTATION_STATUS.LOCKED) {
      throw ApiError.badRequest('Consultation is not locked');
    }

    await this.consultationRepository.updateById(id, {
      status: CONSULTATION_STATUS.SIGNED,
      locked: false,
      lockedAt: null,
      lockedBy: null,
      updatedBy: actorId,
    });

    return this.getWorkspace(id);
  }

  /** EMR-008 — one-page longitudinal medical summary. */
  async patientSummary(patientId) {
    const patient = await this.patientRepository.findByIdNotDeleted(patientId);
    if (!patient) throw ApiError.notFound('Patient not found');

    const [consultations, timeline, prescriptions, treatmentPlans] = await Promise.all([
      this.listByPatient(patientId),
      this.timelineService.getTimeline(patientId, { limit: 50 }),
      this.prescriptionRepository.findByPatient(patientId, { limit: 20 }),
      this.treatmentPlanRepository.findByPatient(patientId, { limit: 20 }),
    ]);
    const medical = patient.medical || {};

    return {
      patient: patient.toSafeObject ? patient.toSafeObject() : patient,
      allergies: medical.allergies || null,
      medicalHistory: medical.pastMedicalHistory || null,
      currentMedicines: medical.currentMedications || null,
      chronicDiseases: medical.chronicDiseases || null,
      previousConsultations: consultations,
      previousTreatments: treatmentPlans.map((t) => (t.toSafeObject ? t.toSafeObject() : t)),
      previousPrescriptions: prescriptions.map((p) => (p.toSafeObject ? p.toSafeObject() : p)),
      timeline,
    };
  }

  /**
   * EMR-006 / §3.7 — explicit doctor-approved release. Each note section is classified
   * STAFF_ONLY / INTERNAL_CLINICAL / PATIENT_FACING; only PATIENT_FACING sections are ever
   * surfaced to the patient app. `patientFacingSummary` (the field existing consumers read) is
   * derived here as the flattened text of just the PATIENT_FACING sections — legacy/back-compat
   * callers that still pass a single `summary` string are treated as one PATIENT_FACING section
   * (the old binary "release everything" behavior), so no existing caller breaks.
   */
  async releasePatientSummary(id, payload, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (![CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.LOCKED].includes(consultation.status)) {
      throw ApiError.badRequest('Only a signed consultation can be released to the patient');
    }

    const sections =
      Array.isArray(payload?.sections) && payload.sections.length
        ? payload.sections.map((s) => ({
            key: s.key,
            label: s.label ?? null,
            text: s.text || '',
            classification: s.classification || CONTENT_CLASSIFICATION.INTERNAL_CLINICAL,
          }))
        : // Back-compat shape: { summary } — treated as a single patient-facing section.
          [
            {
              key: 'summary',
              label: 'Summary',
              text: payload?.summary || '',
              classification: CONTENT_CLASSIFICATION.PATIENT_FACING,
            },
          ];

    const patientFacingSummary =
      sections
        .filter((s) => s.classification === CONTENT_CLASSIFICATION.PATIENT_FACING && s.text?.trim())
        .map((s) => s.text.trim())
        .join('\n\n') || null;

    await this.consultationRepository.updateById(id, {
      releaseSections: sections,
      patientFacingSummary,
      patientFacingReleasedAt: new Date(),
      patientFacingReleasedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCUMENT_RELEASED, {
      actorId,
      metadata: {
        consultationId: id,
        type: 'CONSULTATION_SUMMARY',
        patientFacingSectionCount: sections.filter(
          (s) => s.classification === CONTENT_CLASSIFICATION.PATIENT_FACING
        ).length,
      },
      req,
    });

    return this.getWorkspace(id);
  }

  /** EMR-005 — addendum preserves the original; author/reason/timestamp are always recorded. */
  async amend(id, { text, reason }, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (![CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.LOCKED].includes(consultation.status)) {
      throw ApiError.badRequest('Only a signed or locked consultation can receive an addendum');
    }

    await this.consultationRepository.updateById(id, {
      $push: { addenda: { text, reason, authorId: actorId, createdAt: new Date() } },
    });

    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_AMENDED, {
      actorId,
      metadata: { consultationId: id, reason },
      req,
    });

    return this.getWorkspace(id);
  }

  // --- Lab / report orders (EMR-004) -------------------------------------------------------------

  /**
   * SEC — lab orders were addressable by raw id with no row check, so any account holding plain
   * `consultation.view`/`consultation.edit` could read or mutate the lab orders of a patient in
   * another branch, or of another doctor, purely by guessing/enumerating ids (IDOR).
   *
   * LabOrder itself carries no branch/doctor, so scope is matched through the parent consultation
   * — the same join `listLabOrderReviewQueue` already uses. An out-of-scope id is answered as
   * NOT FOUND, never FORBIDDEN: a 403 would confirm that the id names a real record, which is
   * exactly the fact the scope is meant to hide.
   *
   * `scope` is `{ branchId, doctorId }` from `resolveRecordScope`; a null member means the caller
   * is unrestricted on that axis (OWNER/ADMIN across branches, non-doctor roles across doctors).
   */
  #assertConsultationInScope(consultation, scope = null, notFoundMessage = 'Consultation not found') {
    if (!scope) return;
    const { branchId, doctorId } = scope;
    if (branchId && String(consultation.branchId || '') !== String(branchId)) {
      throw ApiError.notFound(notFoundMessage);
    }
    if (doctorId && String(consultation.doctorId || '') !== String(doctorId)) {
      throw ApiError.notFound(notFoundMessage);
    }
  }

  async createLabOrder(consultationId, payload, actorId, req = null, scope = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    this.#assertConsultationInScope(consultation, scope);
    // A signed/locked consultation is a closed record — no new orders may be attached to it.
    this.#assertEditable(consultation);

    const order = await LabOrder.create({
      ...payload,
      consultationId,
      patientId: consultation.patientId,
      branchId: consultation.branchId,
      orderedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.LAB_ORDER_CREATED, {
      actorId,
      metadata: { consultationId, labOrderId: order._id.toString(), testName: payload.testName },
      req,
    });

    return order.toSafeObject();
  }

  async listLabOrders(consultationId, scope = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    this.#assertConsultationInScope(consultation, scope);
    const rows = await LabOrder.find({ consultationId }).sort({ createdAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  /**
   * A13 — cross-patient Report Review worklist. Lab orders are otherwise only listable per
   * consultation, so a doctor had to open every patient in turn to find results waiting on them.
   * Defaults to RESULT_RECEIVED (= awaiting doctor review). Patient/doctor are populated to names
   * so the row is renderable without a second round-trip per order.
   */
  async listLabOrderReviewQueue(query = {}) {
    const limit = Math.min(Number(query.limit) || 25, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const filter = { status: query.status || 'RESULT_RECEIVED' };
    if (query.patientId) filter.patientId = query.patientId;

    const [rows, total] = await Promise.all([
      LabOrder.find(filter)
        .sort({ resultReceivedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('patientId', 'mrn firstName lastName mobile')
        .populate({
          path: 'consultationId',
          select: 'consultationNumber status startedAt doctorId branchId',
          populate: [
            {
              path: 'doctorId',
              select: 'doctorCode userId',
              populate: { path: 'userId', select: 'firstName lastName' },
            },
            { path: 'branchId', select: 'name displayName' },
          ],
        })
        .exec(),
      LabOrder.countDocuments(filter).exec(),
    ]);

    const items = rows
      .filter((row) => {
        // SEC-030 — doctorId/branchId here arrive from the caller's resolved scope, so this
        // filter is a security boundary, not just a convenience filter. LabOrder itself carries
        // no branchId, so both are matched through the parent consultation.
        if (
          query.branchId
          && row.consultationId?.branchId?._id?.toString() !== String(query.branchId)
        ) {
          return false;
        }
        if (query.doctorId) {
          return row.consultationId?.doctorId?._id?.toString() === String(query.doctorId);
        }
        return true;
      })
      .map((row) => {
        const patient = row.patientId;
        const consultation = row.consultationId;
        const doctor = consultation?.doctorId;
        const doctorUser = doctor?.userId;
        // toSafeObject() would stringify the populated refs back to ids, so build the row off the
        // safe shape and re-attach the populated context.
        const safe = {
          id: row._id.toString(),
          testName: row.testName,
          reason: row.reason,
          dueDate: row.dueDate,
          provider: row.provider,
          status: row.status,
          resultDocumentId: row.resultDocumentId ? row.resultDocumentId.toString() : null,
          resultReceivedAt: row.resultReceivedAt,
          reviewComment: row.reviewComment,
          reviewedAt: row.reviewedAt,
          orderedAt: row.createdAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        return {
          ...safe,
          patientId: patient?._id ? patient._id.toString() : null,
          patient: patient?._id
            ? {
                id: patient._id.toString(),
                mrn: patient.mrn,
                fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
                mobile: patient.mobile,
              }
            : null,
          consultationId: consultation?._id ? consultation._id.toString() : null,
          consultation: consultation?._id
            ? {
                id: consultation._id.toString(),
                consultationNumber: consultation.consultationNumber,
                status: consultation.status,
                startedAt: consultation.startedAt,
              }
            : null,
          doctor: doctor?._id
            ? {
                id: doctor._id.toString(),
                doctorCode: doctor.doctorCode,
                name: doctorUser
                  ? `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
                  : null,
              }
            : null,
          branch: consultation?.branchId?._id
            ? {
                id: consultation.branchId._id.toString(),
                name: consultation.branchId.displayName || consultation.branchId.name,
              }
            : null,
        };
      });

    return {
      items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * §5 — cross-patient "Follow-ups due/overdue" worklist. Mirrors listLabOrderReviewQueue's
   * {items, meta} shape / query pattern so the frontend list page can reuse the same paging UI.
   * A follow-up only surfaces here once it has an explicit reminderDate (§3.6's minimal reminder
   * plan) — a bare value/unit recommendation with no date attached has nothing to be "due" by.
   * `scope: 'DUE'` (default) limits to reminderDate <= now + 7 days (due or approaching) and
   * excludes DONE; `scope: 'ALL'` returns every follow-up with a reminderDate regardless of when.
   */
  async listFollowUpQueue(query = {}) {
    const limit = Math.min(Number(query.limit) || 25, 100);
    const page = Math.max(Number(query.page) || 1, 1);

    const filter = {
      deletedAt: null,
      'followUp.reminderDate': { $ne: null },
    };
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) {
      filter['followUp.status'] = query.status;
    } else if (!query.scope || query.scope === 'DUE') {
      filter['followUp.status'] = { $ne: 'DONE' };
    }
    if (!query.scope || query.scope === 'DUE') {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      filter['followUp.reminderDate'] = { $ne: null, $lte: horizon };
    }

    const [rows, total] = await Promise.all([
      Consultation.find(filter)
        .sort({ 'followUp.reminderDate': 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('patientId', 'mrn firstName lastName mobile')
        .populate({ path: 'doctorId', select: 'doctorCode userId', populate: { path: 'userId', select: 'firstName lastName' } })
        .populate({ path: 'followUp.preferredDoctorId', select: 'doctorCode userId', populate: { path: 'userId', select: 'firstName lastName' } })
        .populate('followUp.preferredBranchId', 'name displayName')
        .populate('branchId', 'name displayName')
        .exec(),
      Consultation.countDocuments(filter).exec(),
    ]);

    const now = new Date();
    const items = rows.map((row) => {
      const patient = row.patientId;
      const doctor = row.doctorId;
      const doctorUser = doctor?.userId;
      const preferredDoctor = row.followUp?.preferredDoctorId;
      const preferredDoctorUser = preferredDoctor?.userId;
      const dueDate = row.followUp?.reminderDate || null;
      return {
        id: row._id.toString(),
        consultationId: row._id.toString(),
        consultationNumber: row.consultationNumber,
        patientId: patient?._id ? patient._id.toString() : null,
        patient: patient?._id
          ? {
              id: patient._id.toString(),
              mrn: patient.mrn,
              fullName: [patient.firstName, patient.lastName].filter(Boolean).join(' '),
              mobile: patient.mobile,
            }
          : null,
        doctor: doctor?._id
          ? {
              id: doctor._id.toString(),
              doctorCode: doctor.doctorCode,
              name: doctorUser ? `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : null,
            }
          : null,
        branch: row.branchId?._id
          ? { id: row.branchId._id.toString(), name: row.branchId.displayName || row.branchId.name }
          : null,
        dueDate,
        overdue: Boolean(dueDate && dueDate < now),
        reason: row.followUp?.reason || null,
        instructions: row.followUp?.instructions || null,
        priority: row.followUp?.priority || 'NORMAL',
        value: row.followUp?.value ?? null,
        unit: row.followUp?.unit || null,
        reminderNote: row.followUp?.reminderNote || null,
        status: row.followUp?.status || 'PENDING',
        preferredDoctor: preferredDoctor?._id
          ? {
              id: preferredDoctor._id.toString(),
              doctorCode: preferredDoctor.doctorCode,
              name: preferredDoctorUser
                ? `${preferredDoctorUser.firstName || ''} ${preferredDoctorUser.lastName || ''}`.trim()
                : null,
            }
          : null,
        preferredBranch: row.followUp?.preferredBranchId?._id
          ? {
              id: row.followUp.preferredBranchId._id.toString(),
              name: row.followUp.preferredBranchId.displayName || row.followUp.preferredBranchId.name,
            }
          : null,
      };
    });

    return {
      items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * §5 — "mark done / reschedule" action from the Follow-ups list. Deliberately narrow: it only
   * touches the follow-up subdocument's status/reminder fields, never the signed clinical record,
   * so it stays usable even on a SIGNED/LOCKED consultation (the note itself is not being edited).
   */
  async updateFollowUpStatus(id, payload, actorId, req = null, scope = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    this.#assertConsultationInScope(consultation, scope);

    const current = consultation.followUp?.toObject?.() || consultation.followUp || {};
    const next = { ...current, status: payload.status };
    if (payload.reminderDate !== undefined) next.reminderDate = payload.reminderDate;
    if (payload.reminderNote !== undefined) next.reminderNote = payload.reminderNote;

    await this.consultationRepository.updateById(id, { followUp: next, updatedBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_SAVED, {
      actorId,
      metadata: { consultationId: id, followUpStatus: payload.status },
      req,
    });
    return this.getWorkspace(id);
  }

  async updateLabOrder(labOrderId, payload, actorId, req = null, scope = null) {
    const order = await LabOrder.findById(labOrderId);
    if (!order) throw ApiError.notFound('Lab order not found');
    const parent = await this.consultationRepository.findByIdNotDeleted(order.consultationId);
    if (!parent) throw ApiError.notFound('Lab order not found');
    this.#assertConsultationInScope(parent, scope, 'Lab order not found');
    if (payload.status !== undefined && payload.status !== null) {
      this.#assertLabOrderTransition(order.status, payload.status);
    } else if (LAB_ORDER_TERMINAL_STATUSES.includes(order.status)) {
      // A terminal order is a closed record — even a comment/document edit must not resurrect it.
      throw ApiError.badRequest(`Lab order is ${order.status} and can no longer be modified`);
    }
    Object.assign(order, payload);
    if (payload.status === 'RESULT_RECEIVED' && !order.resultReceivedAt) order.resultReceivedAt = new Date();
    if (payload.status === 'REVIEWED') {
      order.reviewedBy = actorId;
      order.reviewedAt = new Date();
    }
    await order.save();

    await this.auditService.record(AUDIT_ACTIONS.LAB_ORDER_UPDATED, {
      actorId,
      metadata: { labOrderId, status: order.status },
      req,
    });

    return order.toSafeObject();
  }

}

export default ConsultationService;
