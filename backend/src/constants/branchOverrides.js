/**
 * ORG-006 — the set of Branch fields that SHADOW an organization-level default.
 *
 * A branch document mixes two very different kinds of field:
 *
 *   - Branch IDENTITY (name, branchCode, email, phone, address, city, …). These describe a
 *     specific physical location. They have no organization-level counterpart, so there is
 *     nothing for them to "override" and they are always editable.
 *
 *   - ORG-SHADOWED operating policy (below). Each of these either duplicates a field on the
 *     Organization singleton (timezone, logo) or expresses local operating policy the
 *     organization may wish to standardise across the clinic (workingHours, holidayCalendar,
 *     settings, notes).
 *
 * `Organization.branchOverridableFields` is the allowlist over THIS set only. A field in this
 * list but not in the org's allowlist may not be changed on a branch — the branch must follow the
 * organization. Before this was enforced, `getOverridableFields()` had no caller at all and a
 * branch could override anything, which made the setting decorative.
 */
export const ORG_SHADOWED_BRANCH_FIELDS = Object.freeze([
  'timezone',
  'logo',
  'workingHours',
  'holidayCalendar',
  'settings',
  'notes',
]);

export const ORG_SHADOWED_BRANCH_FIELD_SET = new Set(ORG_SHADOWED_BRANCH_FIELDS);

export default { ORG_SHADOWED_BRANCH_FIELDS, ORG_SHADOWED_BRANCH_FIELD_SET };
