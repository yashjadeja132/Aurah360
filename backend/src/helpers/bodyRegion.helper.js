import { RESTRICTED_BODY_REGIONS, RESTRICTED_BODY_REGION_TERMS } from '../enums/patient.js';

/**
 * IMG-003 — body-region matching for the restricted-capture policy.
 *
 * `bodyRegion` stays FREE TEXT on purpose. It is a `z.string()` in the validators and a plain
 * `String` on ClinicalPhoto, and the values already in the field are descriptive prose
 * ("Face", "left cheek — nasolabial fold"). Constraining it to an enum would (a) reject
 * legitimate descriptive regions clinicians rely on, and (b) invalidate existing rows, while
 * buying nothing for safety: an attacker who wants to bypass the policy just picks the nearest
 * allowed enum value. The defence has to be in the MATCHER, not in the field type.
 *
 * So the matcher is normalised + token-based instead of a naive substring test:
 *   1. normalise — NFKD, strip diacritics, lowercase, collapse every non-alphanumeric run to `_`.
 *   2. legacy pass — the original RESTRICTED_BODY_REGIONS substring test still runs first, so no
 *      value that was blocked before this change can start passing.
 *   3. token pass — a RESTRICTED_BODY_REGION_TERMS entry matches when EVERY token in it is
 *      present in the region's token set, order-independent. Exact tokens (not substrings) means
 *      "nasolabial" never trips the "labial" term, while "Areola — left breast", "left areola"
 *      and "AREOLA" are all caught where the old substring test caught none of them.
 */

const DIACRITICS = /\p{Diacritic}/gu;

/** Lowercase, de-accented, `_`-separated form of a free-text body region. */
export function normalizeBodyRegion(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Distinct alphanumeric tokens of a free-text body region. */
export function bodyRegionTokens(value) {
  return normalizeBodyRegion(value).split('_').filter(Boolean);
}

/**
 * Returns the restricted term that matched, or null. Returning the term (rather than a bare
 * boolean) lets the caller audit exactly which policy entry fired.
 */
export function findRestrictedBodyRegionTerm(value) {
  const normalized = normalizeBodyRegion(value);
  if (!normalized) return null;

  const legacy = RESTRICTED_BODY_REGIONS.find((r) => normalized.includes(r));
  if (legacy) return legacy;

  const tokens = new Set(normalized.split('_').filter(Boolean));
  const matched = RESTRICTED_BODY_REGION_TERMS.find((term) => {
    const termTokens = normalizeBodyRegion(term).split('_').filter(Boolean);
    return termTokens.length > 0 && termTokens.every((t) => tokens.has(t));
  });
  return matched || null;
}

export function isRestrictedBodyRegion(value) {
  return findRestrictedBodyRegionTerm(value) !== null;
}

export default { normalizeBodyRegion, bodyRegionTokens, findRestrictedBodyRegionTerm, isRestrictedBodyRegion };
