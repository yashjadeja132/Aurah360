/**
 * A1 — "My Day" doctor landing.
 *
 * Data strategy (deliberate, to keep the landing screen cheap):
 *  - EAGER, 2 requests total for the whole screen:
 *      1. GET /reports/dashboards/doctor  → resolves the signed-in user's own doctorId
 *         server-side plus the today counters (reuses the EXISTING doctor dashboard
 *         endpoint — no parallel endpoint was added).
 *      2. GET /appointments?doctorId=…&from=today&to=+30d  → one page (limit 100, the
 *         API cap) of upcoming rows, already populated with patient / service / branch.
 *  - LAZY, only when a row is expanded (see `usePatientContext`): the per-patient
 *    history/progress calls. Nothing per-row is fetched up front.
 */
import { useMemo } from 'react';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import { useReportDashboard } from '@/modules/reports/hooks/useReports';
import {
  useConsultationWorkspace,
  usePatientConsultationSummary,
} from '@/modules/consultations/hooks/useConsultations';
import { usePlanProgress } from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
/**
 * Appointment dates are persisted as local start-of-day (so they arrive as a timezone-shifted
 * timestamp, e.g. 18:30Z for an IST clinic). Reading them back on the LOCAL calendar day is what
 * recovers the intended date — a UTC slice would land a day early. See `@/utils/date`.
 */
import { localDateKey } from '@/utils/date';

/** Statuses that mean "this visit is off" — kept, but sorted to the bottom. */
const INACTIVE_STATUSES = ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'];

const HORIZON_DAYS = 30;

const toDateKey = localDateKey;

/**
 * The doctor's own id, resolved by the backend from the auth token. The reports
 * doctor dashboard already does this lookup, so we don't need a doctor-of-user route.
 */
export function useMyDoctorDashboard() {
  return useReportDashboard('doctor');
}

export function useMyDayAppointments(doctorId) {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const params = {
    doctorId,
    from: localDateKey(today),
    to: localDateKey(horizon),
    limit: 100,
    sortBy: 'appointmentDate',
    sortOrder: 'asc',
  };

  const query = useAppointmentList(params, Boolean(doctorId));

  const grouped = useMemo(() => {
    if (!doctorId) return { today: [], upcoming: [] };
    const rows = query.data?.items || [];
    const todayKey = localDateKey(new Date());

    const byTime = (a, b) => {
      const aOff = INACTIVE_STATUSES.includes(a.status) ? 1 : 0;
      const bOff = INACTIVE_STATUSES.includes(b.status) ? 1 : 0;
      if (aOff !== bOff) return aOff - bOff;
      const dk = toDateKey(a.appointmentDate).localeCompare(toDateKey(b.appointmentDate));
      if (dk !== 0) return dk;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    };

    const todayRows = [];
    const upcomingRows = [];
    for (const row of rows) {
      const key = toDateKey(row.appointmentDate);
      // `from`/`to` are day-bounded server-side; anything at-or-before today's key is "today".
      if (key <= todayKey) todayRows.push(row);
      else upcomingRows.push(row);
    }

    return { today: todayRows.sort(byTime), upcoming: upcomingRows.sort(byTime) };
  }, [doctorId, query.data]);

  return { ...query, isDisabled: !doctorId, grouped };
}

/**
 * Per-patient clinical context — fetched ONLY for the currently expanded row.
 * `patientId` is null while the row is collapsed, which leaves every query disabled.
 */
export function usePatientContext(patientId) {
  const summary = usePatientConsultationSummary(patientId);

  const consultations = useMemo(() => {
    const rows = summary.data?.previousConsultations || [];
    return [...rows].sort(
      (a, b) => new Date(b.startedAt || b.createdAt || 0) - new Date(a.startedAt || a.createdAt || 0)
    );
  }, [summary.data]);

  // Latest consultation carries the diagnosis/assessment; the summary payload doesn't
  // inline them, so one extra lazy call for the newest visit only (never per visit).
  const latestConsultationId = consultations[0]?.id || null;
  const workspace = useConsultationWorkspace(patientId ? latestConsultationId : null);

  const activePlan = useMemo(() => {
    const plans = summary.data?.previousTreatments || [];
    const live = plans.filter((p) => !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(p.status));
    return live[0] || plans[0] || null;
  }, [summary.data]);

  const progress = usePlanProgress(patientId ? activePlan?.id || null : null);

  const safetyFlags = useMemo(() => {
    const d = summary.data;
    if (!d) return [];
    return [
      d.allergies ? { key: 'allergies', value: d.allergies, critical: true } : null,
      d.chronicDiseases ? { key: 'chronicDiseases', value: d.chronicDiseases } : null,
      d.currentMedicines ? { key: 'currentMedicines', value: d.currentMedicines } : null,
      d.medicalHistory ? { key: 'medicalHistory', value: d.medicalHistory } : null,
    ].filter(Boolean);
  }, [summary.data]);

  return {
    isLoading: summary.isLoading || workspace.isLoading || progress.isLoading,
    isError: summary.isError,
    error: summary.error,
    consultations,
    latestConsultation: consultations[0] || null,
    diagnosis: workspace.data?.diagnosis || null,
    soap: workspace.data?.soap || null,
    activePlan,
    progress: progress.data || null,
    safetyFlags,
    timeline: summary.data?.timeline || [],
  };
}
