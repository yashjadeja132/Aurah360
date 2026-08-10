import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import '../../src/config/env.js';
import { refreshOrgRuntime, resetOrgRuntime } from '../../src/config/orgRuntime.js';
import {
  clinicDayKey,
  clinicStartOfDay,
  clinicEndOfDay,
  zonedTimeToInstant,
} from '../../src/utils/date.util.js';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  daysAgo,
  financialYearRange,
  localDayKey,
  eachDayKey,
  parseReportFilters,
} from '../../src/helpers/reportFilters.helper.js';

/**
 * TZ-001 — report boundaries and day labels must be the CLINIC's, whatever the host is.
 *
 * The defect these cover only appears when the process timezone is not IST, which is exactly the
 * configuration nobody develops in and everybody deploys to (stock containers are UTC). So every
 * assertion here runs under several forced `process.env.TZ` values and expects the SAME answer:
 * a suite that only passes on an IST laptop is the suite that let this ship.
 */

const HOST_ZONES = ['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati'];
const ORIGINAL_TZ = process.env.TZ;

function withHostTz(tz, fn) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

/** Runs `fn` once per host timezone and returns nothing — assertions live inside `fn`. */
function inEveryHostZone(fn) {
  for (const tz of HOST_ZONES) withHostTz(tz, () => fn(tz));
}

// 05 Aug 2025 19:00 UTC === 06 Aug 2025 00:30 IST. The clinic day and the UTC day DISAGREE here,
// which is the whole point: anything after 18:30 UTC is already tomorrow in Surat.
const EVENING_UTC = new Date('2025-08-05T19:00:00.000Z');
// 05 Aug 2025 10:00 UTC === 05 Aug 2025 15:30 IST — clinic day and UTC day agree.
const MIDDAY_UTC = new Date('2025-08-05T10:00:00.000Z');

beforeEach(() => {
  resetOrgRuntime();
  refreshOrgRuntime({ timezone: 'Asia/Kolkata', financialYearStartMonth: 4 });
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('TZ-001 host timezone override actually bites', () => {
  it('confirms process.env.TZ really changes host-local Date reads (guards the whole suite)', () => {
    const utcDay = withHostTz('UTC', () => EVENING_UTC.getDate());
    const istDay = withHostTz('Asia/Kolkata', () => EVENING_UTC.getDate());
    // If these were equal, every "still correct under UTC" assertion below would be vacuous.
    expect(utcDay).toBe(5);
    expect(istDay).toBe(6);
  });
});

describe('TZ-001 clinic day boundaries', () => {
  it('startOfDay/endOfDay bracket the clinic day, not the host day', () => {
    inEveryHostZone(() => {
      expect(startOfDay(EVENING_UTC).toISOString()).toBe('2025-08-05T18:30:00.000Z');
      expect(endOfDay(EVENING_UTC).toISOString()).toBe('2025-08-06T18:29:59.999Z');

      expect(startOfDay(MIDDAY_UTC).toISOString()).toBe('2025-08-04T18:30:00.000Z');
      expect(endOfDay(MIDDAY_UTC).toISOString()).toBe('2025-08-05T18:29:59.999Z');
    });
  });

  it('keeps an instant strictly inside its own clinic day', () => {
    inEveryHostZone(() => {
      for (const at of [EVENING_UTC, MIDDAY_UTC]) {
        expect(startOfDay(at).getTime()).toBeLessThanOrEqual(at.getTime());
        expect(endOfDay(at).getTime()).toBeGreaterThanOrEqual(at.getTime());
      }
    });
  });

  it('spans exactly one day, to the millisecond', () => {
    inEveryHostZone(() => {
      expect(endOfDay(EVENING_UTC).getTime() - startOfDay(EVENING_UTC).getTime()).toBe(
        24 * 60 * 60 * 1000 - 1
      );
    });
  });

  it('startOfMonth/endOfMonth bracket the clinic month', () => {
    inEveryHostZone(() => {
      expect(startOfMonth(EVENING_UTC).toISOString()).toBe('2025-07-31T18:30:00.000Z');
      expect(endOfMonth(EVENING_UTC).toISOString()).toBe('2025-08-31T18:29:59.999Z');
    });
  });

  it('endOfMonth rolls the year over in December', () => {
    inEveryHostZone(() => {
      expect(endOfMonth(new Date('2025-12-20T19:00:00.000Z')).toISOString()).toBe(
        '2025-12-31T18:29:59.999Z'
      );
    });
  });

  it('daysAgo counts clinic calendar days back from the clinic day', () => {
    inEveryHostZone(() => {
      // Clinic day of EVENING_UTC is 6 Aug; 30 days back is 7 Jul, starting 06 Jul 18:30Z.
      expect(daysAgo(30, EVENING_UTC).toISOString()).toBe('2025-07-06T18:30:00.000Z');
      expect(daysAgo(0, EVENING_UTC).toISOString()).toBe('2025-08-05T18:30:00.000Z');
    });
  });
});

describe('TZ-001 financial year', () => {
  it('treats 1 April 00:30 IST as the new financial year even though UTC still says March', () => {
    inEveryHostZone(() => {
      // 31 Mar 2025 19:00 UTC === 01 Apr 2025 00:30 IST.
      const fy = financialYearRange(new Date('2025-03-31T19:00:00.000Z'));
      expect(fy.label).toBe('FY2025-26');
      expect(fy.from.toISOString()).toBe('2025-03-31T18:30:00.000Z');
      expect(fy.to.toISOString()).toBe('2026-03-31T18:29:59.999Z');
    });
  });

  it('still reports the OLD financial year at 22:30 IST on 31 March', () => {
    inEveryHostZone(() => {
      const fy = financialYearRange(new Date('2025-03-31T17:00:00.000Z'));
      expect(fy.label).toBe('FY2024-25');
      expect(fy.to.toISOString()).toBe('2025-03-31T18:29:59.999Z');
    });
  });

  it('leaves no gap or overlap between consecutive financial years', () => {
    inEveryHostZone(() => {
      const current = financialYearRange(new Date('2025-08-05T19:00:00.000Z'), 0);
      const previous = financialYearRange(new Date('2025-08-05T19:00:00.000Z'), -1);
      expect(current.from.getTime() - previous.to.getTime()).toBe(1);
    });
  });

  it('honours a configured non-April start month, in clinic time', () => {
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'Asia/Kolkata', financialYearStartMonth: 1 });
    inEveryHostZone(() => {
      const fy = financialYearRange(new Date('2025-08-05T19:00:00.000Z'));
      expect(fy.from.toISOString()).toBe('2024-12-31T18:30:00.000Z');
      expect(fy.to.toISOString()).toBe('2025-12-31T18:29:59.999Z');
    });
  });
});

describe('TZ-001 day labels', () => {
  it('localDayKey labels the clinic day, never the UTC or host day', () => {
    inEveryHostZone(() => {
      expect(localDayKey(EVENING_UTC)).toBe('2025-08-06');
      expect(localDayKey(MIDDAY_UTC)).toBe('2025-08-05');
      // The classic bug: a calendar day stored as clinic midnight is …T18:30Z the day before.
      expect(EVENING_UTC.toISOString().slice(0, 10)).toBe('2025-08-05');
    });
  });

  it('labels a clinic-midnight calendar-day value as that day, not the day before', () => {
    inEveryHostZone(() => {
      const storedCalendarDay = zonedTimeToInstant({ year: 2025, month: 8, day: 5 });
      expect(storedCalendarDay.toISOString()).toBe('2025-08-04T18:30:00.000Z');
      expect(clinicDayKey(storedCalendarDay)).toBe('2025-08-05');
    });
  });

  it('eachDayKey enumerates clinic days inclusively and never drops the last one', () => {
    inEveryHostZone(() => {
      expect(eachDayKey(new Date('2025-08-03T19:00:00.000Z'), MIDDAY_UTC)).toEqual([
        '2025-08-04',
        '2025-08-05',
      ]);
      // A range that starts and ends inside one clinic day is one key, not zero and not two.
      expect(eachDayKey(EVENING_UTC, new Date('2025-08-06T10:00:00.000Z'))).toEqual(['2025-08-06']);
    });
  });

  it('produces exactly one key per day of a month-long range', () => {
    inEveryHostZone(() => {
      const keys = eachDayKey(daysAgo(30, EVENING_UTC), EVENING_UTC);
      expect(keys).toHaveLength(31);
      expect(new Set(keys).size).toBe(31);
      expect(keys[0]).toBe('2025-07-07');
      expect(keys[keys.length - 1]).toBe('2025-08-06');
    });
  });

  it('every eachDayKey label falls inside the parseReportFilters range that produced it', () => {
    inEveryHostZone(() => {
      const filters = parseReportFilters({ dateFrom: '2025-08-01', dateTo: '2025-08-03' });
      const keys = eachDayKey(filters.dateFrom, filters.dateTo);
      expect(keys).toEqual(['2025-08-01', '2025-08-02', '2025-08-03']);
      // …and the bounds themselves are clinic midnight/23:59:59.999, not host midnight.
      expect(filters.dateFrom.toISOString()).toBe('2025-07-31T18:30:00.000Z');
      expect(filters.dateTo.toISOString()).toBe('2025-08-03T18:29:59.999Z');
    });
  });
});

describe('TZ-001 date-only query filters name a clinic day', () => {
  it('resolves ?dateFrom=YYYY-MM-DD against the clinic zone for a west-of-UTC clinic', () => {
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'America/New_York' });
    inEveryHostZone(() => {
      const filters = parseReportFilters({ dateFrom: '2025-08-01', dateTo: '2025-08-01' });
      // `new Date('2025-08-01')` is UTC midnight = 31 Jul 20:00 EDT, which would have started the
      // range a day early. The picked day is 1 Aug local: 04:00Z → 03:59:59.999Z next day.
      expect(filters.dateFrom.toISOString()).toBe('2025-08-01T04:00:00.000Z');
      expect(filters.dateTo.toISOString()).toBe('2025-08-02T03:59:59.999Z');
      expect(eachDayKey(filters.dateFrom, filters.dateTo)).toEqual(['2025-08-01']);
    });
  });

  it('still accepts a full instant unchanged', () => {
    inEveryHostZone(() => {
      const filters = parseReportFilters({ dateFrom: '2025-08-05T19:00:00.000Z' });
      expect(filters.dateFrom.toISOString()).toBe('2025-08-05T18:30:00.000Z');
    });
  });
});

describe('TZ-001 follows the configured organization timezone', () => {
  it('recomputes boundaries when the org timezone is not IST', () => {
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'America/New_York' });
    inEveryHostZone(() => {
      // 05 Aug 2025 19:00 UTC === 15:00 EDT on 5 Aug, so the day runs 04:00Z → 03:59:59.999Z.
      expect(clinicStartOfDay(EVENING_UTC).toISOString()).toBe('2025-08-05T04:00:00.000Z');
      expect(clinicEndOfDay(EVENING_UTC).toISOString()).toBe('2025-08-06T03:59:59.999Z');
      expect(clinicDayKey(EVENING_UTC)).toBe('2025-08-05');
    });
  });

  it('crosses a DST boundary without producing a 23- or 25-hour "day" label error', () => {
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'America/New_York' });
    inEveryHostZone(() => {
      // US DST began 09 Mar 2025. The local day is 23h long; the keys must still be consecutive.
      const keys = eachDayKey(
        new Date('2025-03-08T15:00:00.000Z'),
        new Date('2025-03-10T15:00:00.000Z')
      );
      expect(keys).toEqual(['2025-03-08', '2025-03-09', '2025-03-10']);
    });
  });
});
