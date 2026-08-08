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
import ClinicalPhotoPolicyService from './ClinicalPhotoPolicyService.js';
import StorageFactory from '../storage/StorageFactory.js';
import { CONSULTATION_STATUS, EDITABLE_CONSULTATION_STATUSES } from '../enums/consultation.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT } from '../enums/patient.js';

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
    // IMG-003/PRV-001 — capture policy (consent + restricted body area + image type) lives in one
    // shared service that the treatment-session capture path calls too, so the two cannot drift.
    this.photoPolicy = new ClinicalPhotoPolicyService();
    this.storage = StorageFactory.create();
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

    // IMG-003/PRV-001 (P0) — the whole capture policy in one call (shared with the
    // treatment-session capture path): image-type screen, restricted-body-area hard stop, and a
    // cross-check of the real ConsentGrant log for CLINICAL_PHOTOGRAPHY. A client-supplied
    // `consentVerified` boolean is never trusted at face value and is intentionally ignored —
    // the verified flags below come from the grant log, not from the caller.
    const verified = await this.photoPolicy.assertCaptureAllowed({
      patientId: consultation.patientId,
      bodyRegion,
      file,
      actorId,
      req,
      metadata: { consultationId },
    });

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
      // Real grant already confirmed above — these reflect the verified ConsentGrant, not the
      // caller-supplied `consentVerified` argument (which is intentionally ignored here).
      ...verified,
      uploadedBy: actorId,
    });

    /**
     * Make the before/after pairing symmetric.
     *
     * `pairedPhotoId` was written on the new photo only, so the pairing was visible from the AFTER
     * photo and invisible from the BEFORE one — a half-link that no comparison view could rely on.
     * Both photos must point at each other, and the counterpart must belong to the SAME PATIENT:
     * accepting an arbitrary id here would let a caller link one patient's photo to another's and
     * surface it in their comparison view.
     */
    if (pairedPhotoId) {
      const counterpart = await this.photoRepository.findByIdNotDeleted(pairedPhotoId);
      if (counterpart && counterpart.patientId.toString() === consultation.patientId.toString()) {
        await this.photoRepository.updateById(counterpart._id, { pairedPhotoId: photo._id });
      } else {
        // Never leave a dangling or cross-patient link on the new photo either.
        await this.photoRepository.updateById(photo._id, { pairedPhotoId: null });
        photo.pairedPhotoId = null;
      }
    }

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
    await this.photoPolicy.assertPhotographyConsent(photo.patientId, {
      actorId,
      req,
      metadata: { consultationId: photo.consultationId.toString(), photoId: photoId?.toString?.() || photoId },
    });
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
