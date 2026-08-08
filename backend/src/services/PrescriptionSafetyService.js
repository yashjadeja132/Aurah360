import ApiError from '../libs/ApiError.js';
import PatientRepository from '../repositories/PatientRepository.js';
import MedicineRepository from '../repositories/MedicineRepository.js';
import PrescriptionRepository from '../repositories/PrescriptionRepository.js';
import DrugInteractionRuleRepository from '../repositories/DrugInteractionRuleRepository.js';
import AuditService from './AuditService.js';
import { getInteractionSource } from './safety/InteractionSource.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import {
  INTERACTION_SCOPE,
  INTERACTION_SEVERITY,
  RX_SAFETY_ALERT,
  RX_SAFETY_STATUS,
} from '../enums/prescription.js';

/**
 * RX-SAFETY — allergy contraindication + drug-interaction checking for prescribing.
 *
 * ============================ WHAT THIS DOES AND DOES NOT CATCH ============================
 * DATA REALITY (established by reading the schema, not assumed):
 *   • A patient's allergy history is ONE FREE-TEXT FIELD: `Patient.medical.allergies` (String).
 *     There is no structured allergen list, no allergen coding (RxNorm/ATC/SNOMED), no reaction
 *     type, no severity, no verification status. Seed data looks like "Penicillin".
 *   • The medicine master (`Medicine`) carries name, genericName, brand, free-text category,
 *     strength, dosageForm. There is NO drug class taxonomy and NO composition/ingredient list.
 *   • A prescribed item may be FREE TEXT (medicineId is nullable), so a typed-in drug is matched
 *     only on the words the prescriber typed.
 *
 * THEREFORE the allergy check is a WORD-LEVEL TEXT MATCH between the parsed allergy terms and the
 * drug's name / generic name / brand. It CATCHES the common real case ("Penicillin" recorded,
 * "Penicillin V 500mg" prescribed). It DOES NOT CATCH:
 *   • cross-reactivity or drug-class allergy — "Penicillin" recorded will NOT block Amoxicillin,
 *     Cefalexin, or any other beta-lactam, because no class data exists to reason with;
 *   • ingredient-level matches in combination products (no ingredient list exists);
 *   • misspellings or spelling variants ("Amoxycillin" vs "Amoxicillin");
 *   • non-drug or descriptive text the parser cannot resolve to a term (reported back as
 *     `unmatchableTerms` rather than silently dropped);
 *   • allergies documented anywhere OTHER than `medical.allergies` (e.g. buried in consultation
 *     notes) — those are invisible to this check.
 * An EMPTY allergy field is never treated as "safe": see ALLERGY_HISTORY_NOT_CONFIRMED.
 *
 * Interaction checking is delegated to a pluggable InteractionSource. The shipped source reads a
 * clinic-maintained rule set that is EMPTY by default; the response always states whether a source
 * was configured so an empty result cannot be read as "checked, all clear".
 * ==========================================================================================
 */

/** Field-level text that means "no allergies" rather than naming one. */
const NEGATION_FIELD = /^(nil|none|no|na|n\/a|nkda|nka|none known|not known|no known|no known allergies|no known drug allergies|denies|denies any|nil known)\.?$/i;

/**
 * Descriptive words that are never an allergen name. Kept deliberately small: anything not on this
 * list is surfaced (either as a matched term or as an unmatchable term) rather than dropped.
 */
const DESCRIPTOR_WORDS = new Set([
  'allergy',
  'allergies',
  'allergic',
  'history',
  'known',
  'none',
  'nil',
  'mild',
  'moderate',
  'severe',
  'unknown',
  'suspected',
  'patient',
  'reports',
  'reaction',
  'reactions',
  'rash',
  'rashes',
  'itching',
  'hives',
  'urticaria',
  'swelling',
  'anaphylaxis',
  'intolerance',
  'sensitivity',
  'drug',
  'drugs',
  'medicine',
  'medicines',
  'medication',
  'medications',
  'and',
  'with',
  'the',
  'other',
  'others',
]);

/** Minimum length for an allergy word to be matched — guards against "IV"/"NA"-style noise. */
const MIN_TERM_WORD_LENGTH = 4;

function words(...labels) {
  const out = new Set();
  for (const label of labels) {
    if (!label) continue;
    String(label)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .forEach((w) => out.add(w));
  }
  return out;
}

class PrescriptionSafetyService {
  constructor() {
    this.patientRepository = new PatientRepository();
    this.medicineRepository = new MedicineRepository();
    this.prescriptionRepository = new PrescriptionRepository();
    this.ruleRepository = new DrugInteractionRuleRepository();
    this.auditService = new AuditService();
  }

  /**
   * Parse the free-text allergy field into candidate terms.
   * Returns { raw, negated, terms, unmatchableTerms }.
   *  - terms: entries with at least one matchable word (length >= MIN_TERM_WORD_LENGTH)
   *  - unmatchableTerms: entries kept for display so nothing is silently ignored
   */
  static parseAllergyText(raw) {
    const text = (raw || '').trim();
    if (!text) return { raw: null, negated: false, terms: [], unmatchableTerms: [] };

    if (NEGATION_FIELD.test(text)) {
      return { raw: text, negated: true, terms: [], unmatchableTerms: [] };
    }

    const chunks = text
      .replace(/\([^)]*\)/g, ' ') // drop "(rash)" style reaction notes
      .split(/[,;/\n\r|+]|\band\b|\balso\b/i)
      .map((c) => c.replace(/\ballergic to\b|\ballergy to\b/gi, ' ').trim())
      .filter(Boolean);

    const terms = [];
    const unmatchableTerms = [];
    for (const chunk of chunks) {
      if (NEGATION_FIELD.test(chunk)) continue;
      const matchWords = [...words(chunk)].filter(
        (w) => w.length >= MIN_TERM_WORD_LENGTH && !DESCRIPTOR_WORDS.has(w) && !/^\d+$/.test(w)
      );
      if (matchWords.length) terms.push({ term: chunk, matchWords });
      else unmatchableTerms.push(chunk);
    }
    return { raw: text, negated: false, terms, unmatchableTerms };
  }

  /** Resolve the patient's allergy state, including the "was it even asked?" distinction. */
  async #resolveAllergyHistory(patientId) {
    const patient = patientId ? await this.patientRepository.findByIdNotDeleted(patientId) : null;
    if (!patient) {
      // The allergy history could not be read at all. Reported as UNREADABLE (an advisory alert,
      // the same treatment as "never asked") rather than throwing: a hard failure here would take
      // prescribing offline over a data problem, and rather than implying "clear" the response
      // states outright that nothing was checked.
      return {
        patient: null,
        source: 'Patient.medical.allergies (free text)',
        recorded: null,
        terms: [],
        unmatchableTerms: [],
        noKnownDrugAllergiesConfirmed: false,
        confirmedAt: null,
        confirmedBy: null,
        historyStatus: 'PATIENT_RECORD_UNREADABLE',
        structured: false,
      };
    }
    const medical = patient.medical?.toObject?.() || patient.medical || {};
    const parsed = PrescriptionSafetyService.parseAllergyText(medical.allergies);
    const confirmedNone = Boolean(medical.noKnownDrugAllergies);

    let historyStatus;
    if (parsed.terms.length || parsed.unmatchableTerms.length) historyStatus = 'ALLERGIES_RECORDED';
    else if (confirmedNone) historyStatus = 'CONFIRMED_NO_KNOWN_DRUG_ALLERGIES';
    else if (parsed.negated) historyStatus = 'FREETEXT_SAYS_NONE_NOT_FORMALLY_CONFIRMED';
    else historyStatus = 'NOT_ASKED';

    return {
      patient,
      source: 'Patient.medical.allergies (free text)',
      recorded: parsed.raw,
      terms: parsed.terms,
      unmatchableTerms: parsed.unmatchableTerms,
      noKnownDrugAllergiesConfirmed: confirmedNone,
      confirmedAt: medical.allergiesConfirmedAt || null,
      confirmedBy: medical.allergiesConfirmedBy ? String(medical.allergiesConfirmedBy) : null,
      historyStatus,
      structured: false,
    };
  }

  /** Expand a prescribed item into the label words available for matching. */
  async #describeItem(item, scopeTag) {
    let master = null;
    if (item.medicineId) {
      master = await this.medicineRepository.findByIdNotDeleted(item.medicineId);
    }
    return {
      key: item.medicineId ? `id:${item.medicineId}` : `name:${(item.medicineName || '').toLowerCase()}`,
      medicineId: item.medicineId ? String(item.medicineId) : null,
      medicineName: item.medicineName || master?.name || null,
      genericName: item.genericName || master?.genericName || null,
      brand: master?.brand || null,
      category: master?.category || null,
      scopeTag,
    };
  }

  /**
   * Evaluate every safety gate for a set of prescribed items.
   * Pure read — never mutates and never throws for a clinical reason (callers decide).
   */
  async evaluate({ patientId, items = [], excludePrescriptionId = null, req = null }) {
    const allergy = await this.#resolveAllergyHistory(patientId);
    const alerts = [];

    const described = [];
    for (const item of items) {
      described.push(await this.#describeItem(item, INTERACTION_SCOPE.WITHIN_PRESCRIPTION));
    }

    // ---- 1. Allergy contraindication (blocking) + class advisory (non-blocking) -------------
    for (const drug of described) {
      const haystack = words(drug.medicineName, drug.genericName, drug.brand);
      const categoryWords = words(drug.category);
      for (const term of allergy.terms) {
        const hitWord = term.matchWords.find((w) => haystack.has(w));
        if (hitWord) {
          alerts.push({
            type: RX_SAFETY_ALERT.ALLERGY_CONTRAINDICATION,
            severity: INTERACTION_SEVERITY.CONTRAINDICATED,
            blocking: true,
            overridable: true,
            medicineId: drug.medicineId,
            medicineName: drug.medicineName,
            matchedTerm: term.term,
            matchedOn: hitWord,
            detail: `"${drug.medicineName}" matches recorded allergy "${term.term}" (matched on "${hitWord}")`,
          });
          continue;
        }
        const categoryHit = term.matchWords.find((w) => categoryWords.has(w));
        if (categoryHit) {
          alerts.push({
            type: RX_SAFETY_ALERT.ALLERGY_CLASS_ADVISORY,
            severity: INTERACTION_SEVERITY.MODERATE,
            blocking: false,
            overridable: false,
            medicineId: drug.medicineId,
            medicineName: drug.medicineName,
            matchedTerm: term.term,
            matchedOn: categoryHit,
            detail: `Recorded allergy "${term.term}" matches the medicine's category "${drug.category}", not its name — review manually. Category text is not a drug-class taxonomy.`,
          });
        }
      }
    }

    // ---- 2. Allergy history not confirmed (advisory — empty must not read as "safe") --------
    const UNCONFIRMED_DETAIL = {
      NOT_ASKED:
        'No allergy history is recorded for this patient and "No Known Drug Allergies" has not been confirmed. The allergy check found nothing because there was nothing to check against.',
      FREETEXT_SAYS_NONE_NOT_FORMALLY_CONFIRMED:
        'The allergy field says "none" as free text but "No Known Drug Allergies" was never positively confirmed on the record.',
      PATIENT_RECORD_UNREADABLE:
        'The patient record could not be read, so NO allergy checking was performed. This is not a clearance.',
    };
    if (UNCONFIRMED_DETAIL[allergy.historyStatus]) {
      alerts.push({
        type: RX_SAFETY_ALERT.ALLERGY_HISTORY_NOT_CONFIRMED,
        severity: INTERACTION_SEVERITY.MINOR,
        blocking: false,
        overridable: false,
        medicineId: null,
        medicineName: null,
        detail: UNCONFIRMED_DETAIL[allergy.historyStatus],
      });
    }

    if (allergy.unmatchableTerms.length) {
      alerts.push({
        type: RX_SAFETY_ALERT.ALLERGY_HISTORY_NOT_CONFIRMED,
        severity: INTERACTION_SEVERITY.MINOR,
        blocking: false,
        overridable: false,
        medicineId: null,
        medicineName: null,
        detail: `Recorded allergy text could not be resolved to a drug term and was NOT matched: ${allergy.unmatchableTerms
          .map((t) => `"${t}"`)
          .join(', ')}. Review manually.`,
      });
    }

    // ---- 3. Drug interactions via the pluggable source -------------------------------------
    const source = getInteractionSource();
    const interaction = await source.describe();

    // Include the patient's other active (FINALIZED) medicines so cross-prescription pairs are
    // considered — same population the duplicate-medicine warning already uses.
    const activeDrugs = [];
    if (patientId) {
      const activeRx = await this.prescriptionRepository.findActiveByPatient(
        patientId,
        excludePrescriptionId
      );
      for (const rx of activeRx) {
        for (const item of rx.items || []) {
          activeDrugs.push({
            ...(await this.#describeItem(item, INTERACTION_SCOPE.ACTIVE_MEDICATION)),
            prescriptionId: rx._id.toString(),
          });
        }
      }
    }

    let interactionHits = [];
    if (interaction.configured) {
      const all = [...described, ...activeDrugs];
      interactionHits = await source.findInteractions(all);
      // Drop pairs where BOTH sides are pre-existing medication — not something this prescription
      // is introducing, and re-alerting on it would train prescribers to click through.
      interactionHits = interactionHits.filter(
        (hit) =>
          hit.left.scopeTag === INTERACTION_SCOPE.WITHIN_PRESCRIPTION ||
          hit.right.scopeTag === INTERACTION_SCOPE.WITHIN_PRESCRIPTION
      );
      for (const hit of interactionHits) {
        const crossPrescription =
          hit.left.scopeTag === INTERACTION_SCOPE.ACTIVE_MEDICATION ||
          hit.right.scopeTag === INTERACTION_SCOPE.ACTIVE_MEDICATION;
        alerts.push({
          type: RX_SAFETY_ALERT.DRUG_INTERACTION,
          severity: hit.severity,
          blocking: Boolean(hit.blocking),
          overridable: Boolean(hit.blocking),
          medicineId: hit.left.medicineId,
          medicineName: hit.left.medicineName,
          pairedMedicineName: hit.right.medicineName,
          scope: crossPrescription
            ? INTERACTION_SCOPE.ACTIVE_MEDICATION
            : INTERACTION_SCOPE.WITHIN_PRESCRIPTION,
          ruleId: hit.ruleId,
          ruleCode: hit.ruleCode,
          sourceReference: hit.sourceReference || null,
          matchedTerm: `${hit.matchedTermA} + ${hit.matchedTermB}`,
          detail: `${hit.severity} interaction: ${hit.left.medicineName} + ${hit.right.medicineName}${
            hit.clinicalEffect ? ` — ${hit.clinicalEffect}` : ''
          }${hit.management ? ` Management: ${hit.management}` : ''}${
            hit.sourceReference ? ` [source: ${hit.sourceReference}]` : ' [no source reference recorded]'
          }`,
        });
      }
    } else {
      alerts.push({
        type: RX_SAFETY_ALERT.INTERACTION_SOURCE_NOT_CONFIGURED,
        severity: INTERACTION_SEVERITY.MINOR,
        blocking: false,
        overridable: false,
        medicineId: null,
        medicineName: null,
        detail: interaction.note,
      });
    }

    const blocking = alerts.filter((a) => a.blocking);
    const canOverride = hasAnyPermission(req?.auth?.permissions || [], [
      PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE,
    ]);

    return {
      status: blocking.length
        ? RX_SAFETY_STATUS.BLOCKED
        : alerts.length
          ? RX_SAFETY_STATUS.WARN
          : RX_SAFETY_STATUS.CLEAR,
      allergy: {
        source: allergy.source,
        structured: allergy.structured,
        recorded: allergy.recorded,
        parsedTerms: allergy.terms.map((t) => t.term),
        unmatchableTerms: allergy.unmatchableTerms,
        noKnownDrugAllergiesConfirmed: allergy.noKnownDrugAllergiesConfirmed,
        confirmedAt: allergy.confirmedAt,
        confirmedBy: allergy.confirmedBy,
        historyStatus: allergy.historyStatus,
        checked: allergy.historyStatus !== 'PATIENT_RECORD_UNREADABLE',
        matching: 'WORD_MATCH_ON_NAME_GENERIC_BRAND',
        limits:
          'Text match only — no drug-class or cross-reactivity logic, no ingredient expansion for combination products, no spelling tolerance.',
      },
      interaction: {
        ...interaction,
        checked: interaction.configured,
        pairsConsidered: interaction.configured
          ? described.length + activeDrugs.length
          : 0,
      },
      alerts,
      blockingAlerts: blocking.map((a) => a.type),
      requiresOverride: blocking.length > 0,
      canOverride,
      canFinalize: blocking.length === 0,
      canFinalizeWithOverride: blocking.length > 0 && canOverride,
      override: {
        permission: PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE,
        reasonRequired: true,
        field: 'override.reason',
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Finalize gate. Mirrors TreatmentSessionService.#assertHardStops: blocking alerts refuse the
   * action with a 409 carrying the per-item breakdown, unless the caller holds the override
   * permission AND supplies a reason — which is then recorded on the prescription and audited.
   * Returns the override rows to persist (empty when nothing was blocking).
   */
  async assertSafeToFinalize(prescription, override, actorId, req = null) {
    const evaluation = await this.evaluate({
      patientId: prescription.patientId,
      items: prescription.items || [],
      excludePrescriptionId: prescription._id,
      req,
    });

    const blocking = evaluation.alerts.filter((a) => a.blocking);
    if (!blocking.length) return { evaluation, overrides: [] };

    const reason = typeof override?.reason === 'string' ? override.reason.trim() : '';
    if (!reason || !evaluation.canOverride) {
      await this.auditService.record(AUDIT_ACTIONS.PRESCRIPTION_SAFETY_BLOCKED, {
        actorId,
        metadata: {
          prescriptionId: prescription._id.toString(),
          patientId: String(prescription.patientId),
          alerts: blocking.map((a) => ({
            type: a.type,
            medicineName: a.medicineName,
            matchedTerm: a.matchedTerm || null,
          })),
          reasonProvided: Boolean(reason),
          hadOverridePermission: evaluation.canOverride,
        },
        resourceType: 'Prescription',
        resourceId: prescription._id.toString(),
        req,
      });

      throw new ApiError(
        409,
        `Prescription cannot be finalized: ${blocking.map((a) => a.detail).join('; ')}`,
        {
          code: 'PRESCRIPTION_SAFETY_BLOCKED',
          // The error middleware only serialises `errors`, so the whole safety envelope rides
          // inside it — the UI needs `safety.interaction.configured` to say honestly whether
          // interactions were checked, even on the blocked path.
          errors: { alerts: blocking, safety: evaluation },
        }
      );
    }

    const overrides = blocking.map((a) => ({
      type: a.type,
      severity: a.severity,
      medicineName: a.medicineName,
      medicineId: a.medicineId,
      detail: a.detail,
      matchedTerm: a.matchedTerm || null,
      reason,
      overriddenBy: actorId,
      overriddenAt: new Date(),
    }));

    await this.auditService.record(AUDIT_ACTIONS.PRESCRIPTION_SAFETY_OVERRIDDEN, {
      actorId,
      metadata: {
        prescriptionId: prescription._id.toString(),
        patientId: String(prescription.patientId),
        alerts: blocking.map((a) => ({
          type: a.type,
          severity: a.severity,
          medicineName: a.medicineName,
          matchedTerm: a.matchedTerm || null,
          ruleCode: a.ruleCode || null,
        })),
        reason,
      },
      resourceType: 'Prescription',
      resourceId: prescription._id.toString(),
      req,
    });

    return { evaluation, overrides };
  }

  // ------------------------------------------------------------------------------------------
  // Interaction rule administration. The rule set ships EMPTY (no fabricated clinical pairs);
  // these endpoints are how a clinic populates pairs it can cite, or how a migration would load
  // a licensed export. Guarded by PRESCRIPTION_SAFETY_RULES_* permissions at the route.
  // ------------------------------------------------------------------------------------------

  async describeSource() {
    const source = getInteractionSource();
    return source.describe();
  }

  async listInteractionRules() {
    const rows = await this.ruleRepository.findAll();
    const description = await this.describeSource();
    return { source: description, rules: rows.map((r) => r.toSafeObject()) };
  }

  async createInteractionRule(payload, actorId, req = null) {
    const termA = (payload.termA || '').trim().toLowerCase();
    const termB = (payload.termB || '').trim().toLowerCase();
    if (!termA || !termB) throw ApiError.badRequest('termA and termB are required');
    if (termA === termB) throw ApiError.badRequest('termA and termB must differ');

    const existing = await this.ruleRepository.findByTerms(termA, termB);
    if (existing) throw ApiError.badRequest(`A rule already exists for ${termA} + ${termB}`);

    const ruleCode =
      (payload.ruleCode || '').trim().toUpperCase() ||
      `IX-${termA.replace(/[^a-z0-9]/g, '').slice(0, 10)}-${termB
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10)}`.toUpperCase();

    const row = await this.ruleRepository.create({
      ruleCode,
      termA,
      termB,
      matchOnA: payload.matchOnA || undefined,
      matchOnB: payload.matchOnB || undefined,
      severity: payload.severity || undefined,
      blocking: payload.blocking === undefined ? undefined : Boolean(payload.blocking),
      clinicalEffect: payload.clinicalEffect || null,
      management: payload.management || null,
      sourceReference: payload.sourceReference || null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DRUG_INTERACTION_RULE_CREATED, {
      actorId,
      metadata: {
        ruleId: row._id.toString(),
        ruleCode: row.ruleCode,
        termA,
        termB,
        severity: row.severity,
        blocking: row.blocking,
        sourceReference: row.sourceReference,
      },
      resourceType: 'DrugInteractionRule',
      resourceId: row._id.toString(),
      req,
    });

    return row.toSafeObject();
  }

  async setInteractionRuleActive(id, isActive, actorId, req = null) {
    const row = await this.ruleRepository.findByIdNotDeleted(id);
    if (!row) throw ApiError.notFound('Interaction rule not found');
    await this.ruleRepository.updateById(id, { isActive: Boolean(isActive), updatedBy: actorId });

    await this.auditService.record(AUDIT_ACTIONS.DRUG_INTERACTION_RULE_UPDATED, {
      actorId,
      metadata: { ruleId: id, ruleCode: row.ruleCode, isActive: Boolean(isActive) },
      resourceType: 'DrugInteractionRule',
      resourceId: id,
      req,
    });

    const fresh = await this.ruleRepository.findByIdNotDeleted(id);
    return fresh.toSafeObject();
  }
}

export default PrescriptionSafetyService;
