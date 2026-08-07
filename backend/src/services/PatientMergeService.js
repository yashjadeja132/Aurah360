import ApiError from '../libs/ApiError.js';
import PatientRepository from '../repositories/PatientRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/** Collections carrying a direct patientId reference that a merge must reassign. */
const REASSIGN_MODEL_PATHS = [
  ['../models/Appointment.model.js', 'patientId'],
  ['../models/ClinicalPhoto.model.js', 'patientId'],
  ['../models/ConsentGrant.model.js', 'patientId'],
  ['../models/ConsentRecord.model.js', 'patientId'],
  ['../models/Consultation.model.js', 'patientId'],
  ['../models/Dispense.model.js', 'patientId'],
  ['../models/HandoffNote.model.js', 'patientId'],
  ['../models/Invoice.model.js', 'patientId'],
  ['../models/Notification.model.js', 'patientId'],
  ['../models/PatientDocument.model.js', 'patientId'],
  ['../models/PatientTimeline.model.js', 'patientId'],
  ['../models/Payment.model.js', 'patientId'],
  ['../models/Prescription.model.js', 'patientId'],
  ['../models/QueueEntry.model.js', 'patientId'],
  ['../models/TreatmentPlan.model.js', 'patientId'],
  ['../models/TreatmentSession.model.js', 'patientId'],
];

/**
 * Real merge workflow (PAT-001) — never automatic. A privileged user previews the record
 * counts that would move, then commits. The duplicate record is soft-deleted (not destroyed)
 * so historical documents remain reconcilable to a merge event.
 */
class PatientMergeService {
  constructor() {
    this.patientRepository = new PatientRepository();
    this.auditService = new AuditService();
  }

  async #loadPair(primaryId, duplicateId) {
    if (primaryId === duplicateId) {
      throw ApiError.badRequest('Primary and duplicate patient must differ');
    }
    const [primary, duplicate] = await Promise.all([
      this.patientRepository.findByIdNotDeleted(primaryId),
      this.patientRepository.findByIdNotDeleted(duplicateId),
    ]);
    if (!primary) throw ApiError.notFound('Primary patient not found');
    if (!duplicate) throw ApiError.notFound('Duplicate patient not found');
    return { primary, duplicate };
  }

  async previewMerge(primaryId, duplicateId) {
    const { primary, duplicate } = await this.#loadPair(primaryId, duplicateId);

    const counts = {};
    for (const [modelPath, field] of REASSIGN_MODEL_PATHS) {
      const Model = (await import(modelPath)).default;
      counts[Model.modelName] = await Model.countDocuments({ [field]: duplicate._id });
    }

    return {
      primary: primary.toSafeObject(),
      duplicate: duplicate.toSafeObject(),
      recordsToMove: counts,
      totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
    };
  }

  async merge(primaryId, duplicateId, actorId, req = null) {
    const { primary, duplicate } = await this.#loadPair(primaryId, duplicateId);

    const moved = {};
    for (const [modelPath, field] of REASSIGN_MODEL_PATHS) {
      const Model = (await import(modelPath)).default;
      const result = await Model.updateMany(
        { [field]: duplicate._id },
        { $set: { [field]: primary._id } }
      );
      moved[Model.modelName] = result.modifiedCount;
    }

    // Fold non-conflicting identity fields forward (do not overwrite primary's existing values).
    const fillable = ['email', 'alternateMobile', 'referredBy', 'guardianName', 'guardianPhone'];
    let primaryChanged = false;
    for (const field of fillable) {
      if (!primary[field] && duplicate[field]) {
        primary[field] = duplicate[field];
        primaryChanged = true;
      }
    }
    primary.tags = Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])]));
    primary.updatedBy = actorId;
    if (primaryChanged || primary.tags.length) await primary.save();

    duplicate.deletedAt = new Date();
    duplicate.deletedBy = actorId;
    duplicate.isActive = false;
    duplicate.mrn = `MERGED_${Date.now()}_${duplicate.mrn}`.slice(0, 40);
    duplicate.notes = `${duplicate.notes ? duplicate.notes + ' | ' : ''}Merged into ${primary.mrn} on ${new Date().toISOString()}`;
    await duplicate.save();

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_MERGED, {
      actorId,
      metadata: { primaryId, duplicateId, moved },
      req,
    });

    return { primary: primary.toSafeObject(), mergedRecordCounts: moved };
  }
}

export default PatientMergeService;
