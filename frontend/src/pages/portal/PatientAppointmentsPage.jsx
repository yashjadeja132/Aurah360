import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  usePatientAppointments,
} from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';
import { useQueryClient } from '@tanstack/react-query';

export default function PatientAppointmentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientAppointments();
  const qc = useQueryClient();
  const items = Array.isArray(data) ? data : data?.items || data?.appointments || [];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.appointments.title', 'Appointments')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.appointments.description', 'View history, cancel (24h policy), or book via clinic slots.')}</p>
      </div>

      <div className="space-y-2">
        {items.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-xl border bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{a.appointmentNumber}</p>
              <p className="text-sm text-muted-foreground">
                {a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString() : '—'} · {a.startTime} · {a.status}
              </p>
            </div>
            {['SCHEDULED', 'CONFIRMED'].includes(a.status) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await patientPortalApi.cancelAppointment(a.id, 'Cancelled via portal');
                    toast.success(t('portal.appointments.cancelled', 'Cancelled'));
                    qc.invalidateQueries({ queryKey: ['patient-portal'] });
                  } catch (err) {
                    toast.error(err?.response?.data?.message || t('portal.appointments.cancelFailed', 'Cancel failed'));
                  }
                }}
              >
                {t('portal.appointments.cancel', 'Cancel')}
              </Button>
            )}
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.appointments.empty', 'No appointments yet.')}</p>
        )}
      </div>
    </section>
  );
}
