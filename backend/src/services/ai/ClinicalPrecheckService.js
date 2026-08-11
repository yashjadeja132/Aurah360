import fs from 'fs/promises';
import crypto from 'crypto';
import ApiError from '../../libs/ApiError.js';
import AiRun from '../../models/AiRun.model.js';
import Consultation from '../../models/Consultation.model.js';
import ConsultationDiagnosis from '../../models/ConsultationDiagnosis.model.js';
import Prescription from '../../models/Prescription.model.js';
import ClinicalPhoto from '../../models/ClinicalPhoto.model.js';
import Patient from '../../models/Patient.model.js';
import StorageFactory from '../../storage/StorageFactory.js';
import AiGatewayService from './AiGatewayService.js';
import { AI_USE_CASE } from '../../enums/ai.js';
import logger from '../../libs/logger.js';

/** Coarse age band — mirrors ClinicalCopilotService: exact age is more identifying than useful. */
function ageBand(age) {
  if (age == null || Number.isNaN(age)) return 'unknown';
  if (age < 2) return 'infant';
  if (age < 12) return 'child';
  if (age < 18) return 'adolescent';
  if (age < 40) return 'adult (18-39)';
  if (age < 60) return 'adult (40-59)';
  return 'senior (60+)';
}

/** Anthropic vision limits. Budget: up to 2 previous-visit photos + up to 2 of today's. */
const MAX_IMAGES_PER_VISIT = 2;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * CLINICAL_PRECHECK — runs when reception finishes intake (symptoms + optional photos),
 * BEFORE the doctor opens the file. On a follow-up visit the previous consultation's
 * photos, diagnosis and medicines ride along so the model compares then-vs-now and
 * reports IMPROVED / WORSE / UNCHANGED.
 *
 * API-thrift: every run stores an input fingerprint (symptoms + photo ids + previous
 * visit); a re-run with identical inputs returns the stored result and never reaches
 * the provider. All provider traffic still goes through AiGatewayService (PII
 * redaction, budget, kill switch, AiRun audit). Photo bytes ride as `attachments`
 * — provider only, never into the stored manifest.
 */
export class ClinicalPrecheckService {
  constructor() {
    this.gateway = new AiGatewayService();
    this.storage = StorageFactory.create();
  }

  async #loadPhotos(consultationId, limit = MAX_IMAGES_PER_VISIT) {
    const photos = await ClinicalPhoto.find({ consultationId })
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .exec();

    const images = [];
    const bodyRegions = new Set();
    const photoIds = [];
    for (const photo of photos) {
      photoIds.push(photo._id.toString());
      if (photo.bodyRegion) bodyRegions.add(photo.bodyRegion);
      if (images.length >= limit) continue;
      if (!IMAGE_MIME.has(photo.mimeType)) continue;
      if (photo.size && photo.size > MAX_IMAGE_BYTES) continue;
      try {
        const absolutePath = await this.storage.getAbsolutePath(photo.storageKey);
        const bytes = await fs.readFile(absolutePath);
        if (bytes.length > MAX_IMAGE_BYTES) continue;
        images.push({ mediaType: photo.mimeType, dataBase64: bytes.toString('base64') });
      } catch (err) {
        logger.warn('Precheck photo unreadable — continuing without it', {
          photoId: photo._id.toString(),
          message: err.message,
        });
      }
    }
    return { images, photoCount: photos.length, bodyRegions: [...bodyRegions], photoIds };
  }

  /** Previous visit of the same patient — drives the follow-up comparison. */
  async #loadPreviousVisit(consultation) {
    const previous = await Consultation.findOne({
      patientId: consultation.patientId,
      _id: { $ne: consultation._id },
      createdAt: { $lt: consultation.createdAt },
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .exec();
    if (!previous) return null;

    const [diagnosis, prescriptions, prevPhotos] = await Promise.all([
      ConsultationDiagnosis.findOne({ consultationId: previous._id }).exec(),
      Prescription.find({ consultationId: previous._id }).limit(3).exec(),
      this.#loadPhotos(previous._id),
    ]);

    const medicines = prescriptions
      .flatMap((p) => p.items || [])
      .map((it) => it.medicineName || it.genericName)
      .filter(Boolean)
      .slice(0, 10);

    return {
      consultationId: previous._id.toString(),
      date: previous.createdAt?.toISOString?.().slice(0, 10) || 'unknown',
      chiefComplaint: previous.chiefComplaint || 'not recorded',
      primaryDiagnosis: diagnosis?.primaryDiagnosis || 'not recorded',
      medicinesGiven: medicines,
      images: prevPhotos.images,
      photoIds: prevPhotos.photoIds,
    };
  }

  /**
   * Run the precheck. Identical inputs (symptoms + photos + previous visit) return the
   * already-stored result without calling the provider — a re-click costs nothing.
   */
  async runForConsultation(consultationId, actorId, { force = false } = {}) {
    const consultation = await Consultation.findOne({ _id: consultationId, deletedAt: null }).exec();
    if (!consultation) throw ApiError.notFound('Consultation not found');

    const patient = await Patient.findById(consultation.patientId).exec();
    const [current, previousVisit] = await Promise.all([
      this.#loadPhotos(consultation._id),
      this.#loadPreviousVisit(consultation),
    ]);

    const inputFingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          symptoms: consultation.chiefComplaint || '',
          photoIds: current.photoIds,
          previous: previousVisit
            ? { id: previousVisit.consultationId, photoIds: previousVisit.photoIds }
            : null,
        })
      )
      .digest('hex')
      .slice(0, 16);

    if (!force) {
      const existing = await AiRun.findOne({
        consultationId,
        useCase: AI_USE_CASE.CLINICAL_PRECHECK,
        status: 'SUCCESS',
        'inputManifest.inputFingerprint': inputFingerprint,
      })
        .sort({ createdAt: -1 })
        .exec();
      if (existing) {
        logger.info('Clinical precheck skipped — inputs unchanged, reusing stored run', {
          consultationId: consultation._id.toString(),
          runId: existing._id.toString(),
        });
        return {
          runId: existing._id.toString(),
          status: existing.status,
          output: existing.output,
          model: existing.model,
          degraded: false,
          reason: 'REUSED_UNCHANGED_INPUTS',
        };
      }
    }

    const prevImages = previousVisit?.images || [];
    const attachments = [...prevImages, ...current.images];

    const context = {
      inputFingerprint,
      ageBand: ageBand(patient?.computeAge?.()),
      sex: patient?.gender || 'unknown',
      symptomsText: consultation.chiefComplaint || 'not recorded',
      photosProvided: current.images.length > 0,
      photoCount: current.photoCount,
      photoBodyRegions: current.bodyRegions,
      isFollowUp: Boolean(previousVisit),
      previousVisit: previousVisit
        ? {
            date: previousVisit.date,
            chiefComplaint: previousVisit.chiefComplaint,
            primaryDiagnosis: previousVisit.primaryDiagnosis,
            medicinesGiven: previousVisit.medicinesGiven,
          }
        : null,
      imageNote: attachments.length
        ? `${prevImages.length} attached image(s) are from the previous visit (${previousVisit?.date || '-'}) and come first; the remaining ${current.images.length} are from today.`
        : 'No images attached.',
    };

    const result = await this.gateway.run(
      {
        useCase: AI_USE_CASE.CLINICAL_PRECHECK,
        context,
        attachments,
        patientId: consultation.patientId,
        consultationId: consultation._id,
      },
      actorId
    );

    logger.info('Clinical precheck run finished', {
      consultationId: consultation._id.toString(),
      status: result.status,
      degraded: result.degraded,
      followUp: Boolean(previousVisit),
      images: attachments.length,
    });
    return result;
  }

  /** Latest run for the workspace bundle — prefers the newest SUCCESS, else newest anything. */
  async latestForConsultation(consultationId) {
    const success = await AiRun.findOne({
      consultationId,
      useCase: AI_USE_CASE.CLINICAL_PRECHECK,
      status: 'SUCCESS',
    })
      .sort({ createdAt: -1 })
      .exec();
    const run =
      success ||
      (await AiRun.findOne({ consultationId, useCase: AI_USE_CASE.CLINICAL_PRECHECK })
        .sort({ createdAt: -1 })
        .exec());
    if (!run) return null;
    return {
      runId: run._id.toString(),
      status: run.status,
      output: run.output,
      model: run.model,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt,
    };
  }
}

export default ClinicalPrecheckService;
