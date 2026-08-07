import ConsentRepository from '../repositories/ConsentRepository.js';
import PatientRepository from '../repositories/PatientRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { CONSENT_PURPOSE, CONSENT_STATE } from '../enums/privacy.js';
import ApiError from '../libs/ApiError.js';

/** Legacy boolean flags on Patient.consent that some purposes still mirror for UI compat. */
const LEGACY_FLAG_BY_PURPOSE = {
  [CONSENT_PURPOSE.PRIVACY_NOTICE]: 'privacyPolicy',
  [CONSENT_PURPOSE.CARE_RECORD_PROCESSING]: 'treatmentConsent',
  [CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY]: 'photographyConsent',
  [CONSENT_PURPOSE.MARKETING_MESSAGES]: 'marketingConsent',
};

/**
 * Purpose-specific, versioned consent with full withdrawal history (PRV-001, §16.3).
 * Replaces the single boolean-only model — the append-only ConsentGrant log is the
 * source of truth; Patient.consent booleans are kept in sync only for legacy UI reads.
 */
class ConsentService {
  constructor() {
    this.consentRepository = new ConsentRepository();
    this.patientRepository = new PatientRepository();
    this.auditService = new AuditService();
  }

  async seedDefaultDefinitions(actorId = null) {
    const purposes = Object.values(CONSENT_PURPOSE);
    for (const purpose of purposes) {
      const existing = await this.consentRepository.getActiveDefinition(purpose, 'en');
      if (!existing) {
        await this.consentRepository.createDefinition({
          purpose,
          version: 1,
          language: 'en',
          title: purpose.replace(/_/g, ' '),
          bodyText: `Standard ${purpose.replace(/_/g, ' ').toLowerCase()} notice — replace with clinic/legal-approved text before production.`,
          isActive: true,
          createdBy: actorId,
        });
      }
    }
  }

  async publishNewVersion({ purpose, language = 'en', title, bodyText }, actorId) {
    const nextVersion = (await this.consentRepository.getLatestVersion(purpose, language)) + 1;
    const definition = await this.consentRepository.createDefinition({
      purpose,
      language,
      version: nextVersion,
      title,
      bodyText,
      isActive: true,
      createdBy: actorId,
    });
    return definition.toSafeObject();
  }

  async #syncLegacyFlag(patientId, purpose, granted) {
    const flag = LEGACY_FLAG_BY_PURPOSE[purpose];
    if (!flag) return;
    const patient = await this.patientRepository.findByIdNotDeleted(patientId);
    if (!patient) return;
    patient.consent = patient.consent || {};
    patient.consent[flag] = granted;
    if (granted) patient.consent.acceptedAt = new Date();
    await patient.save();
  }

  async grant({ patientId, purpose, language = 'en', method = 'STAFF_ENTERED' }, actorId, req = null) {
    const definition = await this.consentRepository.getActiveDefinition(purpose, language);
    const grant = await this.consentRepository.appendGrant({
      patientId,
      purpose,
      definitionId: definition?._id || null,
      definitionVersion: definition?.version || null,
      language,
      state: CONSENT_STATE.GRANTED,
      method,
      actorId,
      ipAddress: req?.ip || null,
      deviceInfo: req?.headers?.['user-agent'] || null,
    });

    await this.#syncLegacyFlag(patientId, purpose, true);
    await this.auditService.record(AUDIT_ACTIONS.CONSENT_GRANTED, {
      actorId,
      metadata: { patientId, purpose, definitionVersion: definition?.version },
      req,
    });
    return grant.toSafeObject();
  }

  async withdraw({ patientId, purpose, reason = null }, actorId, req = null) {
    const grant = await this.consentRepository.appendGrant({
      patientId,
      purpose,
      state: CONSENT_STATE.WITHDRAWN,
      method: 'STAFF_ENTERED',
      actorId,
      reason,
      ipAddress: req?.ip || null,
      deviceInfo: req?.headers?.['user-agent'] || null,
    });

    await this.#syncLegacyFlag(patientId, purpose, false);
    await this.auditService.record(AUDIT_ACTIONS.CONSENT_WITHDRAWN, {
      actorId,
      metadata: { patientId, purpose, reason },
      req,
    });
    return grant.toSafeObject();
  }

  async currentStates(patientId) {
    const rows = await this.consentRepository.currentStatesForPatient(patientId);
    return rows.map((r) => ({
      purpose: r.purpose,
      state: r.state,
      recordedAt: r.recordedAt,
      definitionVersion: r.definitionVersion,
      method: r.method,
    }));
  }

  async history(patientId, purpose = null) {
    const rows = await this.consentRepository.historyForPatient(patientId, purpose);
    return rows.map((r) => r.toSafeObject());
  }

  /** Used by the notification engine — marketing must never ride on a service consent. */
  async isGranted(patientId, purpose) {
    const states = await this.currentStates(patientId);
    const row = states.find((s) => s.purpose === purpose);
    return row ? row.state === CONSENT_STATE.GRANTED : false;
  }

  async listDefinitions() {
    const rows = await this.consentRepository.listDefinitions();
    return rows.map((r) => r.toSafeObject());
  }
}

export default ConsentService;
