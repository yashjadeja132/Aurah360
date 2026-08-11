import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronDown, ChevronRight, ClipboardList, FlaskConical, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { QueryState } from '@/components/common/QueryState';
import { EmptyState } from '@/components/common/EmptyState';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
} from '@/modules/appointments/constants';
import { PatientContextPanel } from '@/modules/doctorDay/components/PatientContextPanel';
import { MyDayColumns } from '@/modules/doctorDay/components/MyDayColumns';
import { RequestedAppointmentsPanel } from '@/modules/doctorDay/components/RequestedAppointmentsPanel';
import {
  useMyDayAppointments,
  useMyDoctorDashboard,
  useMyDayColumns,
  useRequestedApprovals,
  useReportReviewBacklogCount,
} from '@/modules/doctorDay/hooks/useDoctorDay';

function formatDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function humanType(value) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function AppointmentRow({ appointment, showDay, expanded, onToggle }) {
  const { t } = useTranslation();
  const patientId = appointment.patient?.id || appointment.patientId;
  const rowId = `my-day-context-${appointment.id}`;

  return (
    <li className="overflow-hidden border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={rowId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        <span className="w-28 shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {appointment.startTime || '—'}
          {showDay && (
            <span className="block text-xs font-normal text-muted-foreground">
              {formatDay(appointment.appointmentDate)}
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-foreground">
            {appointment.patient?.fullName || t('doctorDay.unknownPatient', 'Unknown patient')}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {appointment.patient?.mrn}
            {appointment.service?.name ? ` · ${appointment.service.name}` : ''}
          </span>
        </span>

        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {humanType(appointment.appointmentType)}
        </span>

        <Badge
          variant={APPOINTMENT_STATUS_VARIANT[appointment.status] || 'secondary'}
          className="shrink-0"
        >
          {APPOINTMENT_STATUS_LABELS[appointment.status] || appointment.status}
        </Badge>
      </button>

      {expanded && (
        <div id={rowId}>
          <PatientContextPanel patientId={patientId} />
        </div>
      )}
    </li>
  );
}

function AppointmentGroup({ title, rows, showDay, expandedId, onToggle, emptyText }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title} <span className="font-normal">({rows.length})</span>
      </h2>
      <Card className="overflow-hidden">
        {rows.length > 0 ? (
          <ul className="divide-y-0">
            {rows.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                showDay={showDay}
                expanded={expandedId === a.id}
                onToggle={() => onToggle(a.id)}
              />
            ))}
          </ul>
        ) : (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

/**
 * A1 — the doctor's post-login landing screen. Upcoming appointments with each
 * patient's history and treatment progress inline, so nothing has to be opened
 * in another page before the patient walks in.
 */
export default function DoctorMyDayPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState(null);

  const dashboard = useMyDoctorDashboard();
  const doctorId = dashboard.data?.doctorId || null;
  const appointments = useMyDayAppointments(doctorId);
  const summary = dashboard.data?.summary || {};

  const { today = [], upcoming = [] } = appointments.grouped;
  const { columns, urgentCount } = useMyDayColumns(today);
  const requestedApprovals = useRequestedApprovals(doctorId);
  const reportBacklog = useReportReviewBacklogCount();

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || '';
  const canSeeEmr = hasAnyPermission(user?.permissions, [
    PERMISSIONS.CONSULTATION_VIEW,
    PERMISSIONS.CONSULTATION_ALL,
  ]);

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const isLoading = dashboard.isLoading || (Boolean(doctorId) && appointments.isLoading);

  if (!dashboard.isLoading && !doctorId) {
    return (
      <section className="space-y-6">
        <PageHeader
          title={t('doctorDay.title', 'My day')}
          description={t('doctorDay.subtitle', 'Your upcoming appointments with each patient’s history inline.')}
        />
        <EmptyState
          icon={Stethoscope}
          title={t('doctorDay.noDoctorProfile', 'No doctor profile linked to this account')}
          description={t(
            'doctorDay.noDoctorProfileHint',
            'This screen shows the appointments of the doctor linked to your login. Ask an administrator to link a doctor record.'
          )}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={
          firstName
            ? t('doctorDay.greeting', 'Good day, Dr. {{name}}', { name: firstName })
            : t('doctorDay.title', 'My day')
        }
        description={t(
          'doctorDay.subtitle',
          'Your upcoming appointments with each patient’s history inline.'
        )}
        actions={
          canSeeEmr ? (
            <Button asChild variant="outline" size="sm">
              <Link to={APP_ROUTES.CONSULTATIONS}>{t('doctorDay.openEmr', 'Open EMR')}</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('doctorDay.kpi.todaysPatients', "Today's patients")}
          value={summary.todaysPatients ?? 0}
          icon={CalendarClock}
          tone="info"
        />
        <StatCard
          label={t('doctorDay.kpi.pendingNotes', 'Unsigned notes')}
          value={summary.pendingNotes ?? 0}
          hint={t('doctorDay.kpi.pendingNotesHint', 'Needs your signature')}
          tone={summary.pendingNotes ? 'warning' : 'success'}
        />
        <StatCard
          label={t('doctorDay.kpi.followUps', 'Follow-ups today')}
          value={summary.followUps ?? 0}
        />
        <StatCard
          label={t('doctorDay.kpi.upcoming', 'Upcoming (30 days)')}
          value={upcoming.length}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('doctorDay.kpi.urgentWaiting', 'Waiting > 20 min')}
          value={urgentCount}
          icon={ClipboardList}
          tone={urgentCount ? 'destructive' : 'success'}
          hint={t('doctorDay.kpi.urgentWaitingHint', 'Patients waiting past the threshold')}
        />
        <Link to={APP_ROUTES.REPORT_REVIEW_QUEUE} className="block">
          <StatCard
            label={t('doctorDay.kpi.reportBacklog', 'Report review backlog')}
            value={reportBacklog.count}
            icon={FlaskConical}
            tone={reportBacklog.count ? 'warning' : 'success'}
            hint={t('doctorDay.kpi.reportBacklogHint', 'Results awaiting your review')}
          />
        </Link>
        <StatCard
          label={t('doctorDay.kpi.requestedApprovals', 'Requests needing approval')}
          value={requestedApprovals.items.length}
          icon={CalendarClock}
          tone={requestedApprovals.items.length ? 'warning' : 'success'}
          hint={t('doctorDay.kpi.requestedApprovalsHint', 'Accept, propose, or reject below')}
        />
      </div>

      <RequestedAppointmentsPanel doctorId={doctorId} />

      <p className="text-xs text-muted-foreground">
        {t('doctorDay.expandHint', 'Select a row to see that patient’s history and treatment progress here — no need to leave this screen.')}
      </p>

      <QueryState
        isLoading={isLoading}
        isError={dashboard.isError || appointments.isError}
        error={dashboard.error || appointments.error}
        isEmpty={!isLoading && today.length === 0 && upcoming.length === 0}
        emptyTitle={t('doctorDay.emptyTitle', 'Nothing scheduled')}
        emptyDescription={t(
          'doctorDay.emptyDescription',
          'You have no appointments today or in the next 30 days.'
        )}
        onRetry={() => {
          dashboard.refetch();
          appointments.refetch();
        }}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('doctorDay.today', 'Today')} <span className="font-normal">({today.length})</span>
            </h2>
            <MyDayColumns columns={columns} />
          </div>
          <AppointmentGroup
            title={t('doctorDay.comingUp', 'Coming up')}
            rows={upcoming}
            showDay
            expandedId={expandedId}
            onToggle={toggle}
            emptyText={t('doctorDay.noneUpcoming', 'Nothing booked in the next 30 days.')}
          />
        </div>
      </QueryState>
    </section>
  );
}
