import { orgTimezone } from '../config/orgRuntime.js';

/** Store UTC; render in branch/clinic timezone later. */
export const nowUtc = () => new Date();

/**
 * The clinic's reporting timezone.
 *
 * PRECEDENCE: `Organization.timezone` (what an admin edits) > `CLINIC_DEFAULT_TIMEZONE` (a
 * deployment bootstrap default, used only before/if the organization record has been read) >
 * `Asia/Kolkata`. This used to read the env value unconditionally, so changing the organization's
 * timezone in the product had no effect anywhere. See src/config/orgRuntime.js for the full note
 * on why the org value is mirrored synchronously.
 */
export const clinicTimezone = () => orgTimezone();

/**
 * `$dateToString` day-bucket group id for trend/series aggregations.
 *
 * The timezone is NOT optional. Mongo groups on the UTC day by default, and this clinic runs in
 * IST (UTC+5:30), so two things go wrong without it:
 *   - calendar-day fields (appointmentDate, scheduledDate) are stored as local start-of-day and
 *     read back as `…T18:30:00.000Z` on the PREVIOUS UTC date, so every series label lands a day
 *     early;
 *   - true instants (paidAt, registrationDate) bucket on the UTC boundary, so a payment taken at
 *     01:00 IST is attributed to the previous day's revenue.
 * Both are wrong from the clinic's point of view, which is the only point of view a clinic report
 * has. Use this helper rather than hand-writing $dateToString.
 */
export const dayBucket = (dateExpr) => ({
  $dateToString: { format: '%Y-%m-%d', date: dateExpr, timezone: clinicTimezone() },
});

export default { nowUtc, clinicTimezone, dayBucket };
