import fs from 'fs/promises';
import ApiError from '../../libs/ApiError.js';
import AiRun from '../../models/AiRun.model.js';
import Consultation from '../../models/Consultation.model.js';
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

/** Anthropic vision limits: keep well under the ~5MB/image base64 ceiling, max 4 images. */
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * CLINICAL_PRECHECK — runs when reception finishes intake (symptoms + optional photos),
 * BEFORE the doctor opens the file. The result is a fixed-shape analysis the workspace
 * bundle serves as `aiPrecheck`, so it is already waiting when the consultation opens.
 *
 * All provider traffic goes through AiGatewayService (PII redaction, budget, kill switch,
 * AiRun audit). Photo bytes are passed as `attachments` — they ride to the provider only,
 * never into the stored manifest.
 */
export class ClinicalPrecheckService {
  constructor() {
    this.gateway = new AiGatewayService();
    this.storage = StorageFactory.create();
  }

  async #loadImages(consultationId) {
    const photos = await ClinicalPhoto.find({ consultationId })
      .sort({ createdAt: -1 })
      .limit(MAX_IMAGES * 2)
      .exec();

    const images = [];
    const bodyRegions = new Set();
    for (const photo of photos) {
      if (photo.bodyRegion) bodyRegions.add(photo.bodyRegion);
      if (images.length >= MAX_IMAGES) continue;
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
    return { images, photoCount: photos.length, bodyRegions: [...bodyRegions] };
  }

  /** Run (or re-run) the precheck for a consultation. Resolves even when degraded. */
  async runForConsultation(consultationId, actorId) {
    const consultation = await Consultation.findOne({ _id: consultationId, deletedAt: null }).exec();
    if (!consultation) throw ApiError.notFound('Consultation not found');

    const patient = await Patient.findById(consultation.patientId).exec();
    const { images, photoCount, bodyRegions } = await this.#loadImages(consultation._id);

    const context = {
      ageBand: ageBand(patient?.computeAge?.()),
      sex: patient?.gender || 'unknown',
      symptomsText: consultation.chiefComplaint || 'not recorded',
      photosProvided: images.length > 0,
      photoCount,
      photoBodyRegions: bodyRegions,
    };

    const result = await this.gateway.run(
      {
        useCase: AI_USE_CASE.CLINICAL_PRECHECK,
        context,
        attachments: images,
        patientId: consultation.patientId,
        consultationId: consultation._id,
      },
      actorId
    );

    logger.info('Clinical precheck run finished', {
      consultationId: consultation._id.toString(),
      status: result.status,
      degraded: result.degraded,
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
