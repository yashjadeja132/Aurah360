import ApiError from '../libs/ApiError.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import {
  ConsultationSoapRepository,
  ConsultationVitalsRepository,
  ConsultationDiagnosisRepository,
  ConsultationExaminationRepository,
  ClinicalPhotoRepository,
} from '../repositories/ConsultationClinicalRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import AuditService from './AuditService.js';
import ConsultationAiInterface from './ai/ConsultationAiInterface.js';
import PrescriptionRepository from '../repositories/PrescriptionRepository.js';
import TreatmentPlanRepository from '../repositories/TreatmentPlanRepository.js';
import LabOrder from '../models/LabOrder.model.js';
import { generateConsultationNumber } from '../helpers/consultationNumber.helper.js';
import {
  CONSULTATION_STATUS,
  EDITABLE_CONSULTATION_STATUSES,
} from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT } from '../enums/patient.js';
import { emitQueueEvent, SOCKET_EVENTS } from '../socket/index.js';
import { ROLES } from '../constants/roles.js';

/**
 * Consultation / EMR session service.
 * Does NOT modify Appointment records — queue/appointment stay separate.
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
    this.photoRepository = new ClinicalPhotoRepository();
    this.timelineService = new PatientTimelineService();
    this.auditService = new AuditService();
    this.ai = new ConsultationAiInterface();
    this.prescriptionRepository = new PrescriptionRepository();
    this.treatmentPlanRepository = new TreatmentPlanRepository();
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
    if (
      existing &&
      ![CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.LOCKED, CONSULTATION_STATUS.COMPLETED].includes(
        existing.status
      )
    ) {
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
    const photos = await this.photoRepository.findByConsultation(id);

    return {
      consultation,
      soap: soap ? soap.toSafeObject() : null,
      vitals: vitals ? vitals.toSafeObject() : null,
      diagnosis: diagnosis ? diagnosis.toSafeObject() : null,
      examination: examination ? examination.toSafeObject() : null,
      photos: photos.map((p) => p.toSafeObject()),
    };
  }

  async listByPatient(patientId) {
    const rows = await this.consultationRepository.findByPatient(patientId);
    return Promise.all(
      rows.map(async (r) => this.#map(await this.consultationRepository.findByIdPopulated(r._id)))
    );
  }

  async listByDoctor(doctorId, { status = null, limit = 50 } = {}) {
    const filter = { doctorId, deletedAt: null };
    if (status) filter.status = status;
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

    emitQueueEvent(SOCKET_EVENTS.CONSULTATION_COMPLETED, {
      branchId: consultation.branchId.toString(),
      doctorId: consultation.doctorId.toString(),
      consultationId: id,
    });

    return this.getWorkspace(id);
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

  async unlock(id, actorId, actorRole, req = null) {
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

  /** EMR-006 — explicit doctor-approved release of a patient-facing summary; internal note stays internal. */
  async releasePatientSummary(id, { summary }, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(id);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (![CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.LOCKED].includes(consultation.status)) {
      throw ApiError.badRequest('Only a signed consultation can be released to the patient');
    }

    await this.consultationRepository.updateById(id, {
      patientFacingSummary: summary,
      patientFacingReleasedAt: new Date(),
      patientFacingReleasedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCUMENT_RELEASED, {
      actorId,
      metadata: { consultationId: id, type: 'CONSULTATION_SUMMARY' },
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
  async createLabOrder(consultationId, payload, actorId, req = null) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');

    const order = await LabOrder.create({
      ...payload,
      consultationId,
      patientId: consultation.patientId,
      orderedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.LAB_ORDER_CREATED, {
      actorId,
      metadata: { consultationId, labOrderId: order._id.toString(), testName: payload.testName },
      req,
    });

    return order.toSafeObject();
  }

  async listLabOrders(consultationId) {
    const rows = await LabOrder.find({ consultationId }).sort({ createdAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async updateLabOrder(labOrderId, payload, actorId, req = null) {
    const order = await LabOrder.findById(labOrderId);
    if (!order) throw ApiError.notFound('Lab order not found');
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

  getAiInterface() {
    return this.ai;
  }
}

export default ConsultationService;
