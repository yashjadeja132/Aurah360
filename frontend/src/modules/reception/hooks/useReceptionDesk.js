import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { billingApi } from '@/modules/billing/api/billingApi';
import { branchesApi } from '@/modules/branches/api/branchesApi';
import { consentApi } from '../api/consentApi';
import { useReceptionDashboard } from './useReception';

/**
 * Branch list, but only when the caller may actually read it. `GET /branches` requires
 * `branches.view`, which the RECEPTIONIST role does NOT hold — and the shared `useBranchList` hook
 * takes no `enabled` flag, so calling it unconditionally 403s for the role this screen serves.
 * Same api + QUERY_KEYS entry (so the cache is shared), just gated. Branches module untouched.
 */
export function useBranchesIfPermitted(enabled) {
  const params = { limit: 50 };
  return useQuery({
    queryKey: QUERY_KEYS.BRANCH_LIST(params),
    queryFn: async () => {
      const res = await branchesApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    enabled: Boolean(enabled),
  });
}

/** Local YYYY-MM-DD — `/reception/dashboard` treats a bare date as a local-day boundary. */
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A patient waiting longer than this is a problem the desk should be told about, not find. */
export const WAIT_ALERT_MINUTES = 20;

/**
 * Consent purposes that gate an ordinary clinic visit. `CONSENT_PURPOSE` also carries optional,
 * marketing-ish purposes (MARKETING_MESSAGES, BEFORE_AFTER_INTERNAL, …) — those are NOT blockers
 * and are deliberately excluded, so the panel only ever flags consent that actually stops care.
 */
export const REQUIRED_CONSENT_PURPOSES = ['PRIVACY_NOTICE', 'CARE_RECORD_PROCESSING'];

/**
 * Consent is resolved one request per patient (no bulk endpoint exists), so the set is capped.
 * In practice the "present right now" list is a handful of people.
 */
const CONSENT_LOOKUP_CAP = 25;

/** Appointment statuses that mean "this visit is still waiting for someone to arrive". */
const PENDING_CHECK_IN = ['REQUESTED', 'PENDING_APPROVAL', 'SCHEDULED', 'CONFIRMED'];

/** Queue statuses that mean the patient is physically in the building. */
const PRESENT_QUEUE_STATUSES = ['WAITING', 'CALLED', 'IN_CONSULTATION', 'TREATMENT'];

/** Appointment statuses that mean the patient is physically in the building. */
const PRESENT_APPOINTMENT_STATUSES = ['CHECKED_IN', 'IN_CONSULTATION'];

export const ATTENTION_KIND = Object.freeze({
  WAITING_TOO_LONG: 'WAITING_TOO_LONG',
  LATE_ARRIVAL: 'LATE_ARRIVAL',
  MISSING_CONSENT: 'MISSING_CONSENT',
  DUE_AT_DESK: 'DUE_AT_DESK',
});

/**
 * Rank = how badly this blocks the clinic right now. A patient sitting past the wait threshold is
 * the loudest signal (they are visibly unhappy in the waiting room); an unsigned required consent
 * blocks the doctor from working at all; money can be collected any time before they leave.
 */
const KIND_RANK = {
  [ATTENTION_KIND.WAITING_TOO_LONG]: 0,
  [ATTENTION_KIND.LATE_ARRIVAL]: 1,
  [ATTENTION_KIND.MISSING_CONSENT]: 2,
  [ATTENTION_KIND.DUE_AT_DESK]: 3,
};

function minutesSince(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * A.1 — everything the reception desk landing needs, from endpoints that already exist. No new
 * backend route: each question the front desk asks maps onto a list the API already serves.
 *
 *  · "the whole day sheet + the live queue + counters"
 *        → `GET /reception/dashboard?branchId&date` (one call; returns counts, appointments, queue,
 *          queueSummary already populated with patient/doctor/branch).
 *  · "who is waiting too long"
 *        → derived from the same payload's queue entries: WAITING + `arrivalTime` older than
 *          WAIT_ALERT_MINUTES. `arrivalTime` is on the queue entry's safe object, so no extra call.
 *  · "who has arrived but is not checked in"
 *        → the appointment's server-computed `isLate` flag while the status is still pre-check-in.
 *          NOTE: this app has no separate "arrived" event — check-in IS the arrival record — so
 *          "past their slot and still not checked in" is the honest signal available, and it is
 *          exactly the row a receptionist needs to chase.
 *  · "who is missing a required consent"
 *        → `GET /consent/patients/:patientId`, one request per PRESENT patient only (capped), because
 *          the consent module exposes no bulk read. Gate on `consent.view` via `canViewConsent`.
 *  · "who standing at my desk owes money"
 *        → `GET /billing/due-payments?checkedInToday=true&branchId` — the existing at-the-desk filter.
 *
 * RBAC: RECEPTIONIST holds reception.view/checkin, queue.view/manage, billing.view, consent.view and
 * patients.*, so every source above is readable by the role this screen is for. It does NOT hold
 * `reports.view`, which is why nothing here touches `/reports/*` (revenue tiles would 403).
 */
export function useReceptionDesk({ branchId, canViewConsent = false, canViewBilling = false } = {}) {
  const date = todayISO();
  const dashboard = useReceptionDashboard(branchId, date);

  const payload = dashboard.data?.data || {};
  const counts = payload.counts || {};
  const appointments = payload.appointments || [];
  const queue = payload.queue || [];
  const queueSummary = payload.queueSummary || {};

  /**
   * At-the-desk dues. The shared `useDuePayments` hook takes no `enabled` flag, and this call must
   * NOT fire for a user without `billing.view` (it would 403 on the very screen built for them), so
   * the query is declared here against the same api + QUERY_KEYS entry — identical cache shape, but
   * gated. The billing module file stays untouched.
   */
  const duesAtDesk = useQuery({
    queryKey: QUERY_KEYS.BILLING_DUE_PAYMENTS({
      ...(branchId ? { branchId } : {}),
      checkedInToday: 'true',
      limit: 100,
    }),
    queryFn: async () => {
      const res = await billingApi.duePayments({
        ...(branchId ? { branchId } : {}),
        checkedInToday: 'true',
        limit: 100,
      });
      return { items: res.data || [], meta: res.meta };
    },
    enabled: canViewBilling && Boolean(branchId),
  });

  /**
   * Which required purposes are actually IN FORCE. A purpose with no published, active definition is
   * one the clinic has not adopted, so a patient cannot meaningfully be "missing" it — verified
   * against the live API, where `GET /consent/definitions` returns `[]`, which would otherwise make
   * every present patient show a false consent gap. When nothing is published this list is empty and
   * the whole consent branch (including its per-patient requests) switches itself off.
   */
  const definitionsQuery = useQuery({
    queryKey: ['reception', 'consent-definitions'],
    queryFn: async () => (await consentApi.listDefinitions()).data?.definitions || [],
    enabled: canViewConsent,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  const activeRequiredPurposes = useMemo(() => {
    const published = new Set(
      (definitionsQuery.data || []).filter((d) => d.isActive !== false).map((d) => d.purpose)
    );
    return REQUIRED_CONSENT_PURPOSES.filter((p) => published.has(p));
  }, [definitionsQuery.data]);

  const consentEnabled = canViewConsent && activeRequiredPurposes.length > 0;

  /** Patients physically in the building right now — the only set worth a consent lookup. */
  const presentPatientIds = useMemo(() => {
    const ids = new Set();
    for (const e of queue) {
      if (PRESENT_QUEUE_STATUSES.includes(e.queueStatus) && e.patientId) ids.add(String(e.patientId));
    }
    for (const a of appointments) {
      const pid = a.patient?.id || a.patientId;
      if (PRESENT_APPOINTMENT_STATUSES.includes(a.status) && pid) ids.add(String(pid));
    }
    return [...ids].slice(0, CONSENT_LOOKUP_CAP);
  }, [queue, appointments]);

  const consentQueries = useQueries({
    queries: presentPatientIds.map((patientId) => ({
      queryKey: ['reception', 'consent-states', patientId],
      queryFn: async () => (await consentApi.currentStates(patientId)).data?.states || [],
      enabled: consentEnabled,
      // Consent changes rarely within a session; don't re-ask on every dashboard poll.
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  /**
   * `useQueries` hands back a new array every render, so memoising on it directly would never hit.
   * This signature changes only when a lookup actually resolves, which is the real input.
   */
  const consentSignature = consentQueries.map((q) => `${q.dataUpdatedAt}:${q.status}`).join('|');

  /** patientId → list of required purposes that are not GRANTED. */
  const missingConsentByPatient = useMemo(() => {
    if (!consentEnabled) return {};
    const map = {};
    presentPatientIds.forEach((patientId, i) => {
      const q = consentQueries[i];
      // An errored or pending lookup is UNKNOWN, not "missing" — never invent a compliance problem.
      if (!q || q.isLoading || q.isError || !Array.isArray(q.data)) return;
      const granted = new Set(q.data.filter((s) => s.state === 'GRANTED').map((s) => s.purpose));
      const missing = activeRequiredPurposes.filter((p) => !granted.has(p));
      if (missing.length) map[patientId] = missing;
    });
    return map;
  }, [consentEnabled, activeRequiredPurposes, presentPatientIds, consentQueries, consentSignature]);

  const dueRows = duesAtDesk.data?.items || [];

  /**
   * The ranked "needs attention now" list. One row per problem, each carrying the object the
   * inline action needs (appointment for check-in, queue entry for call, invoice for collect).
   */
  const attention = useMemo(() => {
    const rows = [];

    for (const entry of queue) {
      if (entry.queueStatus !== 'WAITING') continue;
      const waited = minutesSince(entry.arrivalTime);
      if (waited < WAIT_ALERT_MINUTES) continue;
      rows.push({
        id: `wait-${entry.id}`,
        kind: ATTENTION_KIND.WAITING_TOO_LONG,
        patientId: entry.patientId ? String(entry.patientId) : null,
        patientName: entry.patient?.fullName || null,
        patientMrn: entry.patient?.mrn || null,
        doctorName: entry.doctor?.name || null,
        minutes: waited,
        tokenNumber: entry.tokenNumber,
        queueEntry: entry,
      });
    }

    for (const appt of appointments) {
      if (!appt.isLate || !PENDING_CHECK_IN.includes(appt.status)) continue;
      rows.push({
        id: `late-${appt.id}`,
        kind: ATTENTION_KIND.LATE_ARRIVAL,
        patientId: appt.patient?.id || appt.patientId || null,
        patientName: appt.patient?.fullName || null,
        patientMrn: appt.patient?.mrn || null,
        doctorName: appt.doctor?.name || null,
        startTime: appt.startTime,
        appointmentNumber: appt.appointmentNumber,
        appointment: appt,
      });
    }

    const nameById = {};
    for (const e of queue) {
      if (e.patientId) nameById[String(e.patientId)] = e.patient || null;
    }
    for (const a of appointments) {
      const pid = a.patient?.id || a.patientId;
      if (pid && !nameById[String(pid)]) nameById[String(pid)] = a.patient || null;
    }

    for (const [patientId, purposes] of Object.entries(missingConsentByPatient)) {
      rows.push({
        id: `consent-${patientId}`,
        kind: ATTENTION_KIND.MISSING_CONSENT,
        patientId,
        patientName: nameById[patientId]?.fullName || null,
        patientMrn: nameById[patientId]?.mrn || null,
        purposes,
      });
    }

    for (const inv of dueRows) {
      rows.push({
        id: `due-${inv.id}`,
        kind: ATTENTION_KIND.DUE_AT_DESK,
        patientId: inv.patient?.id || inv.patientId || null,
        patientName: inv.patient?.fullName || null,
        patientMrn: inv.patient?.mrn || null,
        amount: inv.balanceAmount || 0,
        invoiceNumber: inv.invoiceNumber,
        invoice: inv,
      });
    }

    return rows.sort((a, b) => {
      const r = KIND_RANK[a.kind] - KIND_RANK[b.kind];
      if (r !== 0) return r;
      // Within a kind: longest wait first, then biggest amount first.
      if ((b.minutes || 0) !== (a.minutes || 0)) return (b.minutes || 0) - (a.minutes || 0);
      if ((b.amount || 0) !== (a.amount || 0)) return (b.amount || 0) - (a.amount || 0);
      return String(a.patientName || '').localeCompare(String(b.patientName || ''));
    });
  }, [queue, appointments, missingConsentByPatient, dueRows]);

  const longestWait = useMemo(
    () =>
      queue
        .filter((e) => e.queueStatus === 'WAITING')
        .reduce((max, e) => Math.max(max, minutesSince(e.arrivalTime)), 0),
    [queue]
  );

  return {
    date,
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    error: dashboard.error,
    refetch: dashboard.refetch,
    counts,
    appointments,
    queue,
    queueSummary,
    attention,
    longestWait,
    dues: {
      count: duesAtDesk.data?.meta?.total || 0,
      /**
       * Summed from the rows, NOT from `meta.totalOutstanding`. Verified against the live API: that
       * meta field comes back 0 while the rows carry real balances, because the repository computes
       * it with an aggregate `$match` on the raw query filter — `find()` casts a string `branchId`
       * to an ObjectId but `aggregate()` does not, so the total matches nothing. Rows are fetched at
       * the API's 100 cap anyway, which is well above a single branch's at-the-desk list.
       */
      outstanding: dueRows.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0),
      isLoading: canViewBilling && duesAtDesk.isLoading,
    },
    consent: {
      /** How many present patients we actually managed to check — honest denominator. */
      checked: consentEnabled ? presentPatientIds.length : 0,
      missingCount: Object.keys(missingConsentByPatient).length,
      /** False when the clinic has published no required consent definition — nothing to check. */
      isEnabled: consentEnabled,
      isLoading: consentEnabled && consentQueries.some((q) => q.isLoading),
    },
  };
}

export default useReceptionDesk;
