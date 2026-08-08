export const PRESCRIPTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
  CANCELLED: 'CANCELLED',
});

export const PRESCRIPTION_STATUS_LIST = Object.freeze(Object.values(PRESCRIPTION_STATUS));

export const MEDICINE_ROUTE = Object.freeze({
  ORAL: 'ORAL',
  TOPICAL: 'TOPICAL',
  INJECTION: 'INJECTION',
  IV: 'IV',
  OTHER: 'OTHER',
});

export const MEDICINE_ROUTE_LIST = Object.freeze(Object.values(MEDICINE_ROUTE));

export const DOSAGE_FORM = Object.freeze({
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  SYRUP: 'SYRUP',
  CREAM: 'CREAM',
  GEL: 'GEL',
  OINTMENT: 'OINTMENT',
  LOTION: 'LOTION',
  INJECTION: 'INJECTION',
  DROPS: 'DROPS',
  POWDER: 'POWDER',
  OTHER: 'OTHER',
});

export const DOSAGE_FORM_LIST = Object.freeze(Object.values(DOSAGE_FORM));

/**
 * RX-SAFETY — prescribing safety alerts (allergy contraindication + drug interaction).
 * BLOCKING alerts stop finalize() and require an audited override
 * (PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE + reason); the rest are advisory.
 */
export const RX_SAFETY_ALERT = Object.freeze({
  /** A prescribed item matched a term recorded in the patient's allergy history. */
  ALLERGY_CONTRAINDICATION: 'ALLERGY_CONTRAINDICATION',
  /** An allergy term matched the medicine master's free-text `category` only, not its name. */
  ALLERGY_CLASS_ADVISORY: 'ALLERGY_CLASS_ADVISORY',
  /** Allergy history is empty AND "no known drug allergies" was never positively confirmed. */
  ALLERGY_HISTORY_NOT_CONFIRMED: 'ALLERGY_HISTORY_NOT_CONFIRMED',
  /** An admin-maintained interaction rule matched a pair of drugs. */
  DRUG_INTERACTION: 'DRUG_INTERACTION',
  /** No interaction source has any active rules — nothing was checked. Never "all clear". */
  INTERACTION_SOURCE_NOT_CONFIGURED: 'INTERACTION_SOURCE_NOT_CONFIGURED',
});

export const RX_SAFETY_ALERT_LIST = Object.freeze(Object.values(RX_SAFETY_ALERT));

export const RX_SAFETY_STATUS = Object.freeze({
  /** At least one blocking alert — finalize refused without an override. */
  BLOCKED: 'BLOCKED',
  /** Advisory alerts only. */
  WARN: 'WARN',
  /** No alerts at all (note: "clear" is scoped to what was actually checked). */
  CLEAR: 'CLEAR',
});

export const INTERACTION_SEVERITY = Object.freeze({
  CONTRAINDICATED: 'CONTRAINDICATED',
  MAJOR: 'MAJOR',
  MODERATE: 'MODERATE',
  MINOR: 'MINOR',
});

export const INTERACTION_SEVERITY_LIST = Object.freeze(Object.values(INTERACTION_SEVERITY));

/** What a rule term is matched against on a prescribed item. */
export const INTERACTION_MATCH_ON = Object.freeze({
  ANY: 'ANY',
  NAME: 'NAME',
  GENERIC: 'GENERIC',
});

export const INTERACTION_MATCH_ON_LIST = Object.freeze(Object.values(INTERACTION_MATCH_ON));

/** Where the two sides of an interaction pair came from. */
export const INTERACTION_SCOPE = Object.freeze({
  WITHIN_PRESCRIPTION: 'WITHIN_PRESCRIPTION',
  ACTIVE_MEDICATION: 'ACTIVE_MEDICATION',
});

export const COMMON_FREQUENCIES = Object.freeze([
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'Four times daily',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (SOS)',
  'At bedtime',
  'Weekly',
]);

export default {
  PRESCRIPTION_STATUS,
  MEDICINE_ROUTE,
  DOSAGE_FORM,
  COMMON_FREQUENCIES,
  RX_SAFETY_ALERT,
  RX_SAFETY_STATUS,
  INTERACTION_SEVERITY,
  INTERACTION_MATCH_ON,
  INTERACTION_SCOPE,
};
