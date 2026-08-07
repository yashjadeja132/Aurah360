import ApiError from '../libs/ApiError.js';
import ConsultationRepository from '../repositories/ConsultationRepository.js';
import {
  ConsultationSoapRepository,
  ConsultationVitalsRepository,
  ConsultationDiagnosisRepository,
  ConsultationExaminationRepository,
  ClinicalPhotoRepository,
  ConsultationTemplateRepository,
} from '../repositories/ConsultationClinicalRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import AuditService from './AuditService.js';
import ConsentService from './ConsentService.js';
import StorageFactory from '../storage/StorageFactory.js';
import { CONSULTATION_STATUS, EDITABLE_CONSULTATION_STATUSES } from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT, RESTRICTED_BODY_REGIONS } from '../enums/patient.js';
import { CONSENT_PURPOSE } from '../enums/privacy.js';

/**
 * Clinical sub-records for a consultation (SOAP, vitals, diagnosis, exam, photos, templates).
 */
class ConsultationClinicalService {
  constructor() {
    this.consultationRepository = new ConsultationRepository();
    this.soapRepository = new ConsultationSoapRepository();
    this.vitalsRepository = new ConsultationVitalsRepository();
    this.diagnosisRepository = new ConsultationDiagnosisRepository();
    this.examinationRepository = new ConsultationExaminationRepository();
    this.photoRepository = new ClinicalPhotoRepository();
    this.templateRepository = new ConsultationTemplateRepository();
    this.timelineService = new PatientTimelineService();
    this.auditService = new AuditService();
    this.consentService = new ConsentService();
    this.storage = StorageFactory.create();
  }

  /**
   * IMG-003/PRV-001 — never trust a client-supplied consent flag. Cross-check the real,
   * append-only ConsentGrant log for the patient before persisting any consentVerified flag.
   */
  async #assertPhotographyConsent(patientId, consultationId, actorId, req) {
    const granted = await this.consentService.isGranted(patientId, CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY);
    if (!granted) {
      await this.auditService.record(AUDIT_ACTIONS.CLINICAL_PHOTO_CONSENT_MISSING, {
        actorId,
        metadata: { consultationId, patientId: patientId?.toString?.() || patientId },
        req,
      });
      throw ApiError.forbidden(
        'Clinical photography consent has not been granted for this patient. Capture cannot proceed until consent is recorded.',
        'PHOTOGRAPHY_CONSENT_NOT_GRANTED'
      );
    }
    return granted;
  }

  async #getEditable(consultationId) {
    const consultation = await this.consultationRepository.findByIdNotDeleted(consultationId);
    if (!consultation) throw ApiError.notFound('Consultation not found');
    if (consultation.locked || consultation.status === CONSULTATION_STATUS.LOCKED) {
      throw ApiError.forbidden('Consultation is locked');
    }
    if (consultation.status === CONSULTATION_STATUS.SIGNED) {
      throw ApiError.forbidden('Signed consultation cannot be edited');
    }
    if (!EDITABLE_CONSULTATION_STATUSES.includes(consultation.status)) {
      throw ApiError.badRequest('Consultation is not editable');
    }
    return consultation;
  }

  async autosaveSoap(consultationId, payload, actorId, req = null) {
    await this.#getEditable(consultationId);
    let soap = await this.soapRepository.findByConsultation(consultationId);
    if (!soap) {
      soap = await this.soapRepository.create({
        consultationId,
        currentVersion: 1,
        versions: [],
        updatedBy: actorId,
      });
    }

    const nextVersion = (soap.currentVersion || 0) + 1;
    const snapshot = {
      version: nextVersion,
      subjective: payload.subjective ?? soap.subjective,
      objective: payload.objective ?? soap.objective,
      assessment: payload.assessment ?? soap.assessment,
      plan: payload.plan ?? soap.plan,
      savedAt: new Date(),
      savedBy: actorId,
    };

    const versions = [...(soap.versions || []), snapshot].slice(-50);

    const updated = await this.soapRepository.updateById(soap._id, {
      subjective: snapshot.subjective,
      objective: snapshot.objective,
      assessment: snapshot.assessment,
      plan: snapshot.plan,
      currentVersion: nextVersion,
      isDraft: true,
      lastAutosavedAt: new Date(),
      versions,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.CONSULTATION_SAVED, {
      actorId,
      metadata: { consultationId, soapVersion: nextVersion, autosave: true },
      req,
    });

    return updated.toSafeObject();
  }

  async getSoapVersions(consultationId) {
    const soap = await this.soapRepository.findByConsultation(consultationId);
    if (!soap) throw ApiError.notFound('SOAP notes not found');
    return {
      currentVersion: soap.currentVersion,
      lastAutosavedAt: soap.lastAutosavedAt,
      isDraft: soap.isDraft,
      versions: soap.toSafeObject().versions,
    };
  }

  async saveVitals(consultationId, payload, actorId) {
    await this.#getEditable(consultationId);
    let vitals = await this.vitalsRepository.findByConsultation(consultationId);
    const heightCm = payload.heightCm ?? vitals?.heightCm;
    const weightKg = payload.weightKg ?? vitals?.weightKg;
    let bmi = payload.bmi;
    if (bmi == null && heightCm && weightKg) {
      const m = heightCm / 100;
      bmi = Math.round((weightKg / (m * m)) * 10) / 10;
    }

    const data = {
      ...payload,
      bmi: bmi ?? null,
      recordedAt: new Date(),
      updatedBy: actorId,
    };

    if (!vitals) {
      vitals = await this.vitalsRepository.create({ consultationId, ...data });
    } else {
      vitals = await this.vitalsRepository.updateById(vitals._id, data);
    }
    return vitals.toSafeObject();
  }

  async saveDiagnosis(consultationId, payload, actorId, req = null) {
    await this.#getEditable(consultationId);
    let diagnosis = await this.diagnosisRepository.findByConsultation(consultationId);
    const data = { ...payload, updatedBy: actorId };

    if (!diagnosis) {
      diagnosis = await this.diagnosisRepository.create({ consultationId, ...data });
    } else {
      diagnosis = await this.diagnosisRepository.updateById(diagnosis._id, data);
    }

    await this.auditService.record(AUDIT_ACTIONS.DIAGNOSIS_ADDED, {
      actorId,
      metadata: {
        consultationId,
        primaryDiagnosis: diagnosis.primaryDiagnosis,
      },
      req,
    });

    return diagnosis.toSafeObject();
  }

  async saveExamination(consultationId, payload, actorId) {
    await this.#getEditable(consultationId);
    let exam = await this.examinationRepository.findByConsultation(consultationId);
    const data = { ...payload, updatedBy: actorId };
    if (!exam) {
      exam = await this.examinationRepository.create({ consultationId, ...data });
    } else {
      exam = await this.examinationRepository.updateById(exam._id, data);
    }
    return exam.toSafeObject();
  }

  async uploadPhoto(
    consultationId,
    { file, photoType, title, bodyRegion, consentVerified, laterality, angle, lighting, captureDevice, pairedPhotoId },
    actorId,
    req = null
  ) {
    const consultation = await this.#getEditable(consultationId);
    if (!file?.buffer) throw ApiError.badRequest('File is required');

    // IMG-003 (P0) — clinic policy blocks privacy-sensitive/intimate-area capture server-side.
    // This cannot be bypassed from the API regardless of what the UI allows through.
    const normalizedRegion = (bodyRegion || '').toLowerCase().replace(/[\s_-]+/g, '_');
    if (RESTRICTED_BODY_REGIONS.some((r) => normalizedRegion.includes(r))) {
      await this.auditService.record(AUDIT_ACTIONS.RESTRICTED_PHOTO_BLOCKED, {
        actorId,
        metadata: { consultationId, bodyRegion },
        req,
      });
      throw ApiError.forbidden(
        'This body area is blocked by clinic policy for routine capture. A doctor-authorized exception workflow is required.',
        'RESTRICTED_BODY_AREA'
      );
    }

    // IMG-003/PRV-001 (P0) — a client-supplied `consentVerified` boolean is never trusted at
    // face value. Cross-check the real ConsentGrant log for CLINICAL_PHOTOGRAPHY; no valid,
    // currently-active grant means the capture is hard-stopped regardless of what the caller sent.
    await this.#assertPhotographyConsent(consultation.patientId, consultationId, actorId, req);

    // Marketing/before-after image use is a distinct, separate consent purpose (PRV-001, §16.3) —
    // it must never be conflated with (or inferred from) clinical photography consent.
    const marketingGranted = await this.consentService.isGranted(
      consultation.patientId,
      CONSENT_PURPOSE.MARKETING_IMAGE_USE
    );

    const saved = await this.storage.save(file.buffer, {
      folder: `consultations/${consultationId}/photos`,
      filename: `${Date.now()}-${file.originalname.replace(/[^\w.\-]+/g, '_')}`,
      mimeType: file.mimetype,
    });

    const photo = await this.photoRepository.create({
      consultationId,
      patientId: consultation.patientId,
      photoType: photoType || 'BEFORE',
      title: title || file.originalname,
      bodyRegion: bodyRegion || null,
      laterality: laterality || 'NOT_APPLICABLE',
      angle: angle || null,
      lighting: lighting || null,
      captureDevice: captureDevice || null,
      photographerId: actorId,
      pairedPhotoId: pairedPhotoId || null,
      storageKey: saved.key,
      originalName: file.originalname,
      mimeType: saved.mimeType,
      size: saved.size,
      // Real grant already confirmed above — this reflects the verified ConsentGrant, not the
      // caller-supplied `consentVerified` argument (which is intentionally ignored here).
      consentVerified: true,
      consentVerifiedAt: new Date(),
      consentVerifiedBy: actorId,
      marketingConsentVerified: marketingGranted,
      uploadedBy: actorId,
    });

    await this.timelineService.addEvent(consultation.patientId, {
      eventType: TIMELINE_EVENT.CLINICAL_PHOTO_UPLOADED,
      title: 'Clinical photo uploaded',
      description: photo.title,
      metadata: { consultationId, photoId: photo._id.toString(), photoType: photo.photoType },
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PHOTO_UPLOADED, {
      actorId,
      metadata: { consultationId, photoId: photo._id.toString() },
      req,
    });

    return photo.toSafeObject();
  }

  async listPhotos(consultationId) {
    const rows = await this.photoRepository.findByConsultation(consultationId);
    return rows.map((r) => r.toSafeObject());
  }

  async verifyPhotoConsent(photoId, actorId, req = null) {
    const photo = await this.photoRepository.findByIdNotDeleted(photoId);
    if (!photo) throw ApiError.notFound('Photo not found');
    await this.#getEditable(photo.consultationId.toString());
    // Same hard-stop as uploadPhoto — re-verify against the real ConsentGrant log rather than
    // blindly flipping consentVerified to true on request.
    await this.#assertPhotographyConsent(photo.patientId, photo.consultationId.toString(), actorId, req);
    const updated = await this.photoRepository.updateById(photoId, {
      consentVerified: true,
      consentVerifiedAt: new Date(),
      consentVerifiedBy: actorId,
    });
    return updated.toSafeObject();
  }

  async listTemplates(doctorId, templateType = null) {
    const rows = await this.templateRepository.findForDoctor(doctorId, templateType);
    return rows.map((r) => r.toSafeObject());
  }

  async createTemplate(payload, actorId) {
    const row = await this.templateRepository.create({
      ...payload,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return row.toSafeObject();
  }

  async deleteTemplate(id, actorId) {
    const row = await this.templateRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Template not found');
    await this.templateRepository.updateById(id, {
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    return { id };
  }
}

export default ConsultationClinicalService;
