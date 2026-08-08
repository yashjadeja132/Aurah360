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

/**
 * ── Clinic-timezone calendar arithmetic ────────────────────────────────────────────────────────
 *
 * WHY: `Date#setHours`, `Date#getFullYear`, `new Date(y, m, d)` and `toISOString().slice(0, 10)`
 * all resolve against a timezone we do not control — the first three use the HOST process
 * timezone, the last uses UTC. The clinic is in Surat and reports in IST; the container is stock
 * UTC. So on production every "start of day" was 05:30 IST, every daily report was shifted 5.5h,
 * and every ISO-sliced day label was a day early for anything recorded after 18:30 IST.
 *
 * These helpers do the same arithmetic against `clinicTimezone()` instead. There is no
 * `luxon`/`date-fns-tz` in package.json and adding one for this is not worth it: `Intl` ships in
 * Node 20 with full ICU and already knows every IANA zone.
 */

/** `hourCycle: 'h23'` because `hour12` renders midnight as "24" in some locales. */
const partsFormatterCache = new Map();
function partsFormatter(timeZone) {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of `date` as seen in `timeZone`. */
export function zonedParts(date, timeZone = clinicTimezone()) {
  const out = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of `timeZone` from UTC, in ms, at the instant `date`. IST = +19800000. */
function zoneOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Compare on whole seconds — formatToParts has no millisecond field.
  return asIfUtc - (Math.floor(date.getTime() / 1000) * 1000);
}

/**
 * The instant at which `timeZone`'s wall clock reads the given fields.
 *
 * Inverting a zone offset needs two passes: the offset depends on the instant, and the instant
 * depends on the offset. IST has no DST so one pass would do, but a clinic that reconfigures its
 * timezone to a DST zone should not silently get an hour-wrong boundary twice a year.
 */
export function zonedTimeToInstant(
  { year, month, day, hour = 0, minute = 0, second = 0, ms = 0 },
  timeZone = clinicTimezone()
) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstGuess = naive - zoneOffsetMs(new Date(naive), timeZone);
  const refined = naive - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(refined);
}

/**
 * `YYYY-MM-DD` for the calendar day `date` falls on IN THE CLINIC'S TIMEZONE.
 *
 * This is the string form that must match `dayBucket()` group ids, which also bucket in the clinic
 * timezone. NEVER use `toISOString().slice(0, 10)` for a day label: a calendar day stored as
 * clinic-local start-of-day reads back as `…T18:30:00.000Z` on the PREVIOUS UTC date.
 */
export function clinicDayKey(date, timeZone = clinicTimezone()) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = zonedParts(d, timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** First instant of the clinic-local calendar day containing `date`. */
export function clinicStartOfDay(date = new Date(), timeZone = clinicTimezone()) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToInstant({ year: p.year, month: p.month, day: p.day }, timeZone);
}

/** Last instant (…23:59:59.999 clinic-local) of the clinic-local day containing `date`. */
export function clinicEndOfDay(date = new Date(), timeZone = clinicTimezone()) {
  const p = zonedParts(date, timeZone);
  return zonedTimeToInstant(
    { year: p.year, month: p.month, day: p.day, hour: 23, minute: 59, second: 59, ms: 999 },
    timeZone
  );
}

/**
 * `date` shifted by `n` clinic-local calendar days, returned as clinic-local start-of-day.
 *
 * Done on the calendar fields rather than by subtracting `n * 86400000` ms so a DST transition
 * inside the window cannot drop or duplicate a day.
 */
export function clinicShiftDays(date, n, timeZone = clinicTimezone()) {
  const p = zonedParts(date, timeZone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return zonedTimeToInstant(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    },
    timeZone
  );
}

export default {
  nowUtc,
  clinicTimezone,
  dayBucket,
  zonedParts,
  zonedTimeToInstant,
  clinicDayKey,
  clinicStartOfDay,
  clinicEndOfDay,
  clinicShiftDays,
};
