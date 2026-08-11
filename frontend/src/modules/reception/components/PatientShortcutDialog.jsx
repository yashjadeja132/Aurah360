import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PhoneCall } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { PatientPicker } from '@/modules/appointments/components/bookingPickers';
import { CheckInDialog } from './CheckInDialog';
import { PaymentDialog } from '@/modules/billing/components/PaymentDialog';
import { useRecordPayment } from '@/modules/billing/hooks/useBilling';
import { billingApi } from '@/modules/billing/api/billingApi';
import { formatMoney } from '@/modules/billing/constants';
import { patientDetailPath } from '@/constants/routes';
import { usePatientDetail } from '@/modules/patients/hooks/usePatients';

const CHECK_IN_ABLE = ['SCHEDULED', 'CONFIRMED'];

/**
 * Shared "search for a patient, then act" shortcut used by four of the six header shortcuts on
 * the reception desk (Check-in / Upload report / Record payment / Call patient) — see the flow
 * diff's shortcut palette (spec §0). One `PatientPicker` search step, then a mode-specific
 * resolution step, so none of the four duplicate the search UI.
 */
export function PatientShortcutDialog({ open, onOpenChange, mode, branchId, todaysAppointments = [] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [checkInTarget, setCheckInTarget] = useState(null);
  const [collectInvoice, setCollectInvoice] = useState(null);
  const recordPayment = useRecordPayment(collectInvoice?.id);

  useEffect(() => {
    if (!open) {
      setPatientId('');
      setSearch('');
      setCheckInTarget(null);
      setCollectInvoice(null);
    }
  }, [open]);

  // Documents: no resolution step needed — jump straight to the patient's Documents tab
  // (PatientDocumentsPanel already owns the upload form; no second copy of it here).
  useEffect(() => {
    if (mode === 'documents' && patientId) {
      onOpenChange(false);
      navigate(`${patientDetailPath(patientId)}?tab=documents`);
    }
  }, [mode, patientId, navigate, onOpenChange]);

  // Check-in: resolve today's checkin-able appointment(s) for the chosen patient from the same
  // day-sheet list already loaded on this page — no second appointments query.
  const eligibleAppointments = useMemo(() => {
    if (mode !== 'checkin' || !patientId) return [];
    return todaysAppointments.filter(
      (a) => (a.patient?.id || a.patientId) === patientId && CHECK_IN_ABLE.includes(a.status)
    );
  }, [mode, patientId, todaysAppointments]);

  // Record payment: patient's open (finalized, balance > 0) invoices.
  const dueQuery = useQuery({
    queryKey: ['reception', 'shortcut-due', patientId],
    queryFn: async () => {
      const res = await billingApi.duePayments({ patientId, limit: 20 });
      return res.data || [];
    },
    enabled: mode === 'payment' && Boolean(patientId),
  });
  const dueInvoices = dueQuery.data || [];

  const title = {
    checkin: t('receptionDesk.shortcuts.checkInTitle', 'Check in a patient'),
    documents: t('receptionDesk.shortcuts.uploadTitle', 'Upload report'),
    payment: t('receptionDesk.shortcuts.paymentTitle', 'Record payment'),
    call: t('receptionDesk.shortcuts.callTitle', 'Call patient'),
  }[mode];

  return (
    <>
      <Dialog open={open && mode !== 'documents'} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {t('receptionDesk.shortcuts.searchHint', 'Search by name, MRN or mobile.')}
            </DialogDescription>
          </DialogHeader>

          <PatientPicker
            value={patientId}
            onChange={setPatientId}
            search={search}
            onSearchChange={setSearch}
            branchId={branchId}
          />

          {mode === 'checkin' && patientId && (
            <div className="space-y-2">
              {eligibleAppointments.length === 0 && (
                <EmptyState
                  title={t('receptionDesk.shortcuts.noApptTitle', 'No appointment to check in')}
                  description={t(
                    'receptionDesk.shortcuts.noApptDescription',
                    'This patient has no scheduled or confirmed appointment today.'
                  )}
                />
              )}
              {eligibleAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>
                    {appt.startTime} · {appt.appointmentNumber} ·{' '}
                    {appt.doctor?.name || t('receptionDesk.daySheet.noDoctor', 'No doctor')}
                  </span>
                  <Button size="sm" onClick={() => setCheckInTarget(appt)}>
                    {t('receptionDesk.daySheet.checkIn', 'Check in')}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {mode === 'payment' && patientId && (
            <div className="space-y-2">
              {dueQuery.isLoading && <Skeleton className="h-16 w-full" />}
              {!dueQuery.isLoading && dueInvoices.length === 0 && (
                <EmptyState
                  title={t('receptionDesk.shortcuts.noDueTitle', 'Nothing outstanding')}
                  description={t(
                    'receptionDesk.shortcuts.noDueDescription',
                    'This patient has no unpaid finalized invoice.'
                  )}
                />
              )}
              {dueInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span>
                    {inv.invoiceNumber} · {t('receptionDesk.shortcuts.balance', 'Balance')}{' '}
                    {formatMoney(inv.balanceAmount)}
                  </span>
                  <Button size="sm" onClick={() => setCollectInvoice(inv)}>
                    {t('receptionDesk.attention.collect', 'Collect {{amount}}', {
                      amount: formatMoney(inv.balanceAmount),
                    })}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {mode === 'call' && patientId && <CallPatientCard patientId={patientId} />}
        </DialogContent>
      </Dialog>

      <CheckInDialog
        open={Boolean(checkInTarget)}
        onOpenChange={(o) => {
          if (!o) {
            setCheckInTarget(null);
            onOpenChange(false);
          }
        }}
        appointment={checkInTarget}
      />

      <PaymentDialog
        key={collectInvoice?.id || 'none'}
        open={Boolean(collectInvoice)}
        balance={collectInvoice?.balanceAmount || 0}
        pending={recordPayment.isPending}
        onClose={() => setCollectInvoice(null)}
        onSubmit={(payload) =>
          recordPayment.mutate(payload, {
            onSuccess: () => {
              setCollectInvoice(null);
              onOpenChange(false);
            },
          })
        }
      />
    </>
  );
}

/**
 * "Call patient" — click-to-call contact card. There is deliberately NO outcome logging here:
 * `CrmExtensionsService.recordRecallOutcome` only exists against an already-created RecallEntry
 * id, there is no generic "log a call against any patient" endpoint, AND the RECEPTIONIST role
 * does not even hold `crm.recall` (see backend/src/constants/rolePermissions.js), so it cannot
 * reach the recall worklist either. Faking a log-anytime capability the backend does not support
 * would be worse than this honest, working subset: look the patient up, dial them.
 */
function CallPatientCard({ patientId }) {
  const { t } = useTranslation();
  // Reuses the same patient-detail fetch every other picker in this codebase uses.
  const { data: patient, isLoading } = usePatientDetail(patientId);

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!patient) return null;

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">{patient.fullName}</p>
      <p className="text-muted-foreground">
        {patient.mrn} · {patient.mobile || t('receptionDesk.shortcuts.noMobile', 'No mobile on file')}
      </p>
      {patient.mobile && (
        <Button asChild size="sm">
          <a href={`tel:${patient.mobile}`}>
            <PhoneCall className="h-4 w-4" />
            {t('receptionDesk.shortcuts.call', 'Call {{mobile}}', { mobile: patient.mobile })}
          </a>
        </Button>
      )}
    </div>
  );
}

export default PatientShortcutDialog;
