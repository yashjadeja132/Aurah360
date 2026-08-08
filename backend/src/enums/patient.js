export const BLOOD_GROUP = Object.freeze({
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
  O_POS: 'O+',
  O_NEG: 'O-',
  UNKNOWN: 'UNKNOWN',
});

export const BLOOD_GROUP_LIST = Object.freeze(Object.values(BLOOD_GROUP));

export const MARITAL_STATUS = Object.freeze({
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED',
  OTHER: 'OTHER',
});

export const MARITAL_STATUS_LIST = Object.freeze(Object.values(MARITAL_STATUS));

export const DOCUMENT_CATEGORY = Object.freeze({
  IDENTITY_PROOF: 'IDENTITY_PROOF',
  PRESCRIPTION: 'PRESCRIPTION',
  LAB_REPORT: 'LAB_REPORT',
  MEDICAL_REPORT: 'MEDICAL_REPORT',
  CONSENT_FORM: 'CONSENT_FORM',
  INSURANCE: 'INSURANCE',
  OTHER: 'OTHER',
});

export const DOCUMENT_CATEGORY_LIST = Object.freeze(Object.values(DOCUMENT_CATEGORY));

export const TIMELINE_EVENT = Object.freeze({
  PATIENT_REGISTERED: 'PATIENT_REGISTERED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  CONSENT_UPDATED: 'CONSENT_UPDATED',
  DOCTOR_ASSIGNED: 'DOCTOR_ASSIGNED',
  BRANCH_CHANGED: 'BRANCH_CHANGED',
  TAGS_UPDATED: 'TAGS_UPDATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  CONSULTATION_STARTED: 'CONSULTATION_STARTED',
  CONSULTATION_SIGNED: 'CONSULTATION_SIGNED',
  CLINICAL_PHOTO_UPLOADED: 'CLINICAL_PHOTO_UPLOADED',
});

export const TIMELINE_EVENT_LIST = Object.freeze(Object.values(TIMELINE_EVENT));

/** Document review workflow (DOC-001..003) */
export const DOCUMENT_REVIEW_STATE = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  REVIEWED: 'REVIEWED',
  CLARIFICATION_NEEDED: 'CLARIFICATION_NEEDED',
  SUPERSEDED: 'SUPERSEDED',
});

export const DOCUMENT_REVIEW_STATE_LIST = Object.freeze(Object.values(DOCUMENT_REVIEW_STATE));

export const DOCUMENT_SOURCE = Object.freeze({
  PATIENT: 'PATIENT',
  EXTERNAL_DOCTOR: 'EXTERNAL_DOCTOR',
  LABORATORY: 'LABORATORY',
  HOSPITAL: 'HOSPITAL',
  INTERNAL_BRANCH: 'INTERNAL_BRANCH',
});

export const DOCUMENT_SOURCE_LIST = Object.freeze(Object.values(DOCUMENT_SOURCE));

/**
 * Referral/acquisition taxonomy (PAT-003, §5.1, §12.5). Lifted out of Patient.model.js so the
 * Zod validator and the schema cannot drift — they drifted before, and the validator's silence
 * about these fields is what made them unsaveable.
 */
export const PATIENT_SOURCE_CATEGORY_LIST = Object.freeze([
  'GOOGLE',
  'WEBSITE',
  'FACEBOOK_AD',
  'INSTAGRAM_AD',
  'WHATSAPP',
  'WALK_IN',
  'PERSON_REFERRAL',
  'PATIENT_REFERRAL',
  'DOCTOR_REFERRAL',
  'EVENT',
  'OTHER',
]);

export const PATIENT_VISIBILITY = Object.freeze({
  HIDDEN: 'HIDDEN',
  RELEASED: 'RELEASED',
  RELEASE_ON_APPROVAL: 'RELEASE_ON_APPROVAL',
});

export const PATIENT_VISIBILITY_LIST = Object.freeze(Object.values(PATIENT_VISIBILITY));

export const SCAN_STATE = Object.freeze({
  PENDING: 'PENDING',
  CLEAN: 'CLEAN',
  QUARANTINED: 'QUARANTINED',
  REJECTED: 'REJECTED',
});

export const SCAN_STATE_LIST = Object.freeze(Object.values(SCAN_STATE));

/** Photo governance metadata (IMG-001..005) */
export const PHOTO_LATERALITY = Object.freeze({
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  BILATERAL: 'BILATERAL',
  CENTRAL: 'CENTRAL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const PHOTO_LATERALITY_LIST = Object.freeze(Object.values(PHOTO_LATERALITY));

/**
 * IMG-003 — the original restricted list. Kept verbatim and still applied as a substring test
 * by helpers/bodyRegion.helper.js, so nothing that was blocked before can start passing.
 */
export const RESTRICTED_BODY_REGIONS = Object.freeze([
  'genital',
  'perianal',
  'breast_areola',
  'buttock_cleft',
]);

/**
 * IMG-003 (hardened) — the same four policy concepts expressed as a controlled vocabulary of
 * clinical synonyms/variants, matched as normalised TOKEN SETS rather than raw substrings
 * (see helpers/bodyRegion.helper.js). An entry matches when every token in it is present in
 * the normalised region, in any order — so "Areola (left breast)" and "left_areola" are both
 * caught, where the old substring test only caught the literal string "breast_areola".
 *
 * Deliberately NOT listed: chest, abdomen, groin, inguinal, bikini line, bare "breast",
 * bare "buttock", thigh. Those are routine, non-intimate treatment areas in an aesthetic
 * clinic (hair removal, acne, scar review) and blocking them would stop real treatment.
 * This list only widens the coverage of the four concepts the clinic already restricted:
 * genital, perianal (incl. perineum), breast areola/nipple, and the gluteal/natal cleft.
 */
export const RESTRICTED_BODY_REGION_TERMS = Object.freeze([
  // 1. genital
  'genital',
  'genitals',
  'genitalia',
  'genital area',
  'genital region',
  'private parts',
  'intimate area',
  'penis',
  'penile',
  'foreskin',
  'prepuce',
  'scrotum',
  'scrotal',
  'testicle',
  'testicles',
  'testis',
  'testes',
  'testicular',
  'vulva',
  'vulval',
  'vulvar',
  'vagina',
  'vaginal',
  'introitus',
  'labia',
  'labial',
  'labium',
  'clitoris',
  'clitoral',
  'mons pubis',
  'pubis',
  'pubic',
  // 2. perianal / perineum
  'perianal',
  'peri anal',
  'perineum',
  'perineal',
  'anus',
  'anal',
  'anorectal',
  'rectum',
  'rectal',
  // 3. breast areola / nipple
  'breast areola',
  'areola',
  'areolae',
  'areolar',
  'nipple',
  'nipples',
  // 4. gluteal / natal cleft
  'buttock cleft',
  'buttocks cleft',
  'gluteal cleft',
  'intergluteal cleft',
  'natal cleft',
  'gluteal crease cleft',
]);

/** Front Desk Handoff Note (§5.3, PAT-006) */
export const HANDOFF_CATEGORY = Object.freeze({
  EXPECTATION: 'EXPECTATION',
  COMMUNICATION: 'COMMUNICATION',
  URGENCY: 'URGENCY',
  PREVIOUS_EXPERIENCE: 'PREVIOUS_EXPERIENCE',
  FINANCIAL: 'FINANCIAL',
  ACCESSIBILITY: 'ACCESSIBILITY',
  COMPANION: 'COMPANION',
  OTHER: 'OTHER',
});

export const HANDOFF_CATEGORY_LIST = Object.freeze(Object.values(HANDOFF_CATEGORY));

export const HANDOFF_URGENCY = Object.freeze({
  NORMAL: 'NORMAL',
  DOCTOR_ATTENTION: 'DOCTOR_ATTENTION',
  IMMEDIATE_TRIAGE_ALERT: 'IMMEDIATE_TRIAGE_ALERT',
});

export const HANDOFF_URGENCY_LIST = Object.freeze(Object.values(HANDOFF_URGENCY));

/** Duplicate/merge and migration (PAT-001, PAT-008) */
export const MERGE_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  MERGED: 'MERGED',
  REJECTED: 'REJECTED',
});

export const MERGE_STATUS_LIST = Object.freeze(Object.values(MERGE_STATUS));

export const IMPORT_BATCH_STATUS = Object.freeze({
  DRY_RUN: 'DRY_RUN',
  IMPORTED: 'IMPORTED',
  RECONCILED: 'RECONCILED',
  FAILED: 'FAILED',
});

export const IMPORT_BATCH_STATUS_LIST = Object.freeze(Object.values(IMPORT_BATCH_STATUS));

export default {
  BLOOD_GROUP,
  MARITAL_STATUS,
  DOCUMENT_CATEGORY,
  TIMELINE_EVENT,
  DOCUMENT_REVIEW_STATE,
  DOCUMENT_SOURCE,
  PATIENT_SOURCE_CATEGORY_LIST,
  PATIENT_VISIBILITY,
  SCAN_STATE,
  PHOTO_LATERALITY,
  RESTRICTED_BODY_REGIONS,
  HANDOFF_CATEGORY,
  HANDOFF_URGENCY,
  MERGE_STATUS,
  IMPORT_BATCH_STATUS,
};
