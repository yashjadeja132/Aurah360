import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import {
  useDoctorConsultations,
  useStartConsultation,
} from '@/modules/consultations/hooks/useConsultations';
import { ConsultationStatusBadge } from '@/modules/consultations/components/StatusBadges';
import { consultationWorkspacePath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

export default function ConsultationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];
  // '' = All doctors (default). A specific id narrows to that doctor.
  const [doctorId, setDoctorId] = useState('');

  const today = todayKey();
  const { data: apptData } = useAppointmentList({
    doctorId: doctorId || undefined,
    from: today,
    to: today,
    limit: 50,
  });
  const appointments = apptData?.items || [];

  const { data: consultations = [], isLoading } = useDoctorConsultations(doctorId);
  const start = useStartConsultation();

  const eligible = useMemo(
    () =>
      appointments.filter((a) =>
        ['CHECKED_IN', 'IN_CONSULTATION', 'CONFIRMED', 'SCHEDULED'].includes(a.status)
      ),
    [appointments]
  );

  const openFromAppointment = async (appointmentId) => {
    const res = await start.mutateAsync({ appointmentId });
    const id = res?.data?.consultation?.id;
    if (id) navigate(consultationWorkspacePath(id));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('consultations.list.title', 'Consultations')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('consultations.list.subtitle', 'Doctor EMR workspace — clinical notes, vitals, diagnosis, photos.')}
          </p>
        </div>
      </div>

      <div className="max-w-sm">
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('consultations.list.allDoctors', 'All doctors')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.doctorCode} — {d.user?.fullName || t('consultations.list.doctorFallback', 'Doctor')}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">
            {t('consultations.list.startFromAppointment', 'Start from appointment')}
          </h2>
          <div className="space-y-2">
            {eligible.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {a.startTime} · {a.patient?.fullName || t('consultations.list.patientFallback', 'Patient')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.appointmentNumber} · {a.status}
                  </p>
                </div>
                <PermissionGuard
                  permissions={[PERMISSIONS.CONSULTATION_CREATE, PERMISSIONS.CONSULTATION_ALL]}
                >
                  <Button
                    size="sm"
                    disabled={start.isPending}
                    onClick={() => openFromAppointment(a.id)}
                  >
                    <Plus className="h-4 w-4" />
                    {t('consultations.list.openEmr', 'Open EMR')}
                  </Button>
                </PermissionGuard>
              </div>
            ))}
            {!eligible.length && (
              <p className="text-sm text-muted-foreground">
                {t('consultations.list.noEligibleAppointments', 'No eligible appointments today.')}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">
            {t('consultations.list.recentConsultations', 'Recent consultations')}
          </h2>
          {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}
          <div className="space-y-2">
            {consultations.map((c) => (
              <Link
                key={c.id}
                to={consultationWorkspacePath(c.id)}
                className="flex items-center justify-between rounded-xl border bg-card p-3 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">
                      {c.consultationNumber} · {c.patient?.fullName || t('consultations.list.patientFallback', 'Patient')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.startedAt ? new Date(c.startedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                </div>
                <ConsultationStatusBadge status={c.status} />
              </Link>
            ))}
            {!consultations.length && !isLoading && (
              <p className="text-sm text-muted-foreground">
                {t('consultations.list.noConsultationsYet', 'No consultations yet.')}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
