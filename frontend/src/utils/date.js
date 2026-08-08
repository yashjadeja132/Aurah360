/**
 * Calendar-day helpers.
 *
 * WHY THIS FILE EXISTS — read before reaching for `toISOString()`:
 *
 * This product persists *calendar day* values (appointment date, schedule day, date of birth,
 * a plan review date, a "today" filter) as the LOCAL start-of-day instant. The clinic runs in
 * IST (UTC+5:30), so Monday 2026-08-03 is stored and returned as `2026-08-02T18:30:00.000Z`.
 *
 * Deriving the day from the UTC form of such a value —
 *   `toISOString().slice(0, 10)` / `.split('T')[0]` / `getUTCDate()`
 * — therefore yields THE PREVIOUS DAY for every value in any UTC+ timezone. That single mistake
 * has produced multiple user-visible defects: appointments bucketed into the wrong day column,
 * a weekly strip disagreeing with the availability detail it linked to, and a DOB rendering a day
 * early in the patient record. `new Date().toISOString().slice(0, 10)` has the same flaw for
 * "today": between 00:00 and 05:30 IST it returns YESTERDAY.
 *
 * The fix is always the same: read the LOCAL calendar components (`getFullYear` / `getMonth` /
 * `getDate`) and format them yourself. That is what `localDateKey` does.
 *
 * `toISOString()` remains CORRECT — and must not be replaced — when the value is a true instant
 * rather than a calendar day: a `createdAt` / `updatedAt` timestamp, an audit time, a token
 * expiry moment. Those describe a point on the timeline, not a day on a wall calendar.
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * `YYYY-MM-DD` for the LOCAL calendar day of `value` (defaults to now).
 *
 * Accepts a `Date`, an ISO string, or an epoch number. Omit `value` to get today. An empty or
 * unparseable value yields `''` — never a silent fallback to today — so callers can feed the
 * result straight into an `<input type="date">` and still distinguish "no date on record".
 *
 * @param {Date|string|number} [value]
 * @returns {string} `YYYY-MM-DD`, or `''` when `value` is present but empty/invalid.
 */
export function localDateKey(value) {
  if (value === undefined) {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  if (value === null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local calendar day as `YYYY-MM-DD`. Alias kept for call-site readability. */
export function todayKey() {
  return localDateKey();
}

/**
 * The Monday of the week containing `value` (defaults to now), as a local `Date` at 00:00.
 * Sunday counts as the END of its week, matching the Mon–Sun strip the calendar screens render.
 *
 * @param {Date|string|number} [value]
 * @returns {Date} local midnight on that Monday.
 */
export function startOfWeek(value) {
  const d = value ? new Date(value) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `startOfWeek` as a `YYYY-MM-DD` key. */
export function startOfWeekKey(value) {
  return localDateKey(startOfWeek(value));
}

/**
 * `offset` days from `value` (defaults to now), as a `YYYY-MM-DD` key. Uses `setDate`, so DST
 * transitions and month/year rollover are handled by the platform.
 *
 * @param {number} offset days to add (may be negative)
 * @param {Date|string|number} [value]
 */
export function addDaysKey(offset, value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + offset);
  return localDateKey(d);
}

export default { localDateKey, todayKey, startOfWeek, startOfWeekKey, addDaysKey };
