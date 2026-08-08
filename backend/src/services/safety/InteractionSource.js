import DrugInteractionRuleRepository from '../../repositories/DrugInteractionRuleRepository.js';
import { INTERACTION_MATCH_ON } from '../../enums/prescription.js';

/**
 * RX-SAFETY — pluggable drug-interaction source.
 *
 * WHY AN INTERFACE INSTEAD OF DATA: this repository has no licensed interaction database, and
 * writing clinical pairs from memory into a medical product would be worse than shipping none —
 * a fabricated table looks authoritative and would be trusted. So the MECHANISM ships (matching,
 * blocking, override, audit) and the DATA stays empty until a clinic enters pairs it can cite or a
 * real provider is wired in behind this same interface.
 *
 * A source must expose:
 *   name              — stable identifier reported in API responses
 *   describe()        — { source, configured, ruleCount, coverage, note } for the response envelope
 *   findInteractions(drugs) — drugs: [{ key, medicineId, medicineName, genericName, scopeTag }]
 *                             returns [{ severity, blocking, clinicalEffect, management,
 *                                        sourceReference, ruleId, ruleCode, left, right,
 *                                        matchedTermA, matchedTermB }]
 *
 * `configured === false` MUST make an empty result read as "not checked", never "all clear".
 */
export class InteractionSource {
  // eslint-disable-next-line class-methods-use-this
  get name() {
    return 'ABSTRACT';
  }

  // eslint-disable-next-line class-methods-use-this
  async describe() {
    throw new Error('describe() not implemented');
  }

  // eslint-disable-next-line class-methods-use-this
  async findInteractions() {
    throw new Error('findInteractions() not implemented');
  }
}

/** Normalised significant words of a drug label, used for term matching. */
export function drugWords(...labels) {
  const words = new Set();
  for (const label of labels) {
    if (!label) continue;
    String(label)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
      .forEach((w) => words.add(w));
  }
  return words;
}

/**
 * Does a rule term match a prescribed drug?
 * Term may be multi-word ("amoxicillin clavulanate") — every significant word of the term must be
 * present in the drug's label words. Single-word terms therefore behave as a plain word match.
 */
export function termMatchesDrug(term, drug, matchOn = INTERACTION_MATCH_ON.ANY) {
  const termWords = [...drugWords(term)];
  if (!termWords.length) return false;

  let haystack;
  if (matchOn === INTERACTION_MATCH_ON.NAME) haystack = drugWords(drug.medicineName);
  else if (matchOn === INTERACTION_MATCH_ON.GENERIC) haystack = drugWords(drug.genericName);
  else haystack = drugWords(drug.medicineName, drug.genericName);

  return termWords.every((w) => haystack.has(w));
}

/**
 * The shipped default: rules the clinic maintains itself in the `druginteractionrules` collection
 * (see DrugInteractionRule.model.js). Reports `configured: false` while the rule set is empty, so
 * "no interactions found" can never be mistaken for "checked and clear".
 */
export class LocalRuleInteractionSource extends InteractionSource {
  constructor(repository = new DrugInteractionRuleRepository()) {
    super();
    this.repository = repository;
  }

  get name() {
    return 'LOCAL_RULES';
  }

  async describe() {
    const ruleCount = await this.repository.countActive();
    return {
      source: this.name,
      configured: ruleCount > 0,
      ruleCount,
      coverage: ruleCount > 0 ? 'LOCAL_ADMIN_MAINTAINED_PAIRS_ONLY' : 'NONE',
      note:
        ruleCount > 0
          ? `Checked against ${ruleCount} clinic-maintained interaction rule(s) only. This is NOT a licensed interaction database — pairs absent from the rule set are NOT checked.`
          : 'NO INTERACTION SOURCE CONFIGURED — no drug-interaction checking was performed. An empty result here does NOT mean the combination is safe. Add rules via POST /api/v1/prescriptions/interaction-rules or wire a licensed provider.',
    };
  }

  async findInteractions(drugs = []) {
    const rules = await this.repository.findActive();
    if (!rules.length || drugs.length < 2) return [];

    const hits = [];
    for (const rule of rules) {
      for (let i = 0; i < drugs.length; i += 1) {
        for (let j = i + 1; j < drugs.length; j += 1) {
          const [x, y] = [drugs[i], drugs[j]];
          // Both orientations: a rule is symmetric unless matchOn narrows a side.
          const forward =
            termMatchesDrug(rule.termA, x, rule.matchOnA) &&
            termMatchesDrug(rule.termB, y, rule.matchOnB);
          const backward =
            termMatchesDrug(rule.termA, y, rule.matchOnA) &&
            termMatchesDrug(rule.termB, x, rule.matchOnB);
          if (!forward && !backward) continue;

          hits.push({
            ruleId: rule._id.toString(),
            ruleCode: rule.ruleCode,
            severity: rule.severity,
            blocking: Boolean(rule.blocking),
            clinicalEffect: rule.clinicalEffect,
            management: rule.management,
            sourceReference: rule.sourceReference,
            matchedTermA: rule.termA,
            matchedTermB: rule.termB,
            left: forward ? x : y,
            right: forward ? y : x,
          });
        }
      }
    }
    return hits;
  }
}

/** Explicit "nothing wired" source — used when interaction checking is deliberately disabled. */
export class NullInteractionSource extends InteractionSource {
  get name() {
    return 'NONE';
  }

  async describe() {
    return {
      source: this.name,
      configured: false,
      ruleCount: 0,
      coverage: 'NONE',
      note:
        'Drug-interaction checking is DISABLED — no source is registered. Nothing was checked; this is not a clearance.',
    };
  }

  async findInteractions() {
    return [];
  }
}

let activeSource = new LocalRuleInteractionSource();

/**
 * Swap in another source (a licensed provider adapter, or NullInteractionSource) at boot or in a
 * test. Kept as a registry rather than a constructor arg so a future provider can be wired in one
 * place without changing PrescriptionService.
 */
export function registerInteractionSource(source) {
  if (!source || typeof source.findInteractions !== 'function' || typeof source.describe !== 'function') {
    throw new Error('registerInteractionSource() requires an InteractionSource-shaped object');
  }
  activeSource = source;
  return activeSource;
}

export function getInteractionSource() {
  return activeSource;
}

export default {
  InteractionSource,
  LocalRuleInteractionSource,
  NullInteractionSource,
  registerInteractionSource,
  getInteractionSource,
  termMatchesDrug,
  drugWords,
};
