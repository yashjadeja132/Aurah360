import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import {
  useAdverseEvents,
  useReportAdverseEvent,
  useCloseAdverseEvent,
} from '../hooks/useTreatmentSafety';
import { PERMISSIONS } from '@/constants/rbac';

const SEVERITY_VARIANT = {
  MILD: 'secondary',
  MODERATE: 'warning',
  SEVERE: 'destructive',
  LIFE_THREATENING: 'destructive',
};
const STATUS_VARIANT = {
  OPEN: 'warning',
  ESCALATED: 'destructive',
  UNDER_REVIEW: 'info',
  RESOLVED: 'success',
  CLOSED: 'secondary',
};

const SEVERITY_LABEL_KEYS = {
  MILD: 'treatments.safety.severity.mild',
  MODERATE: 'treatments.safety.severity.moderate',
  SEVERE: 'treatments.safety.severity.severe',
  LIFE_THREATENING: 'treatments.safety.severity.lifeThreatening',
};

const STATUS_LABEL_KEYS = {
  OPEN: 'treatments.safety.status.open',
  ESCALATED: 'treatments.safety.status.escalated',
  UNDER_REVIEW: 'treatments.safety.status.underReview',
  RESOLVED: 'treatments.safety.status.resolved',
  CLOSED: 'treatments.safety.status.closed',
};

/**
 * Safety tab of the Treatments hub — the adverse-event register, extracted from the former
 * `TreatmentSafetyPage`. Patch tests are recorded from the session workspace; this register
 * tracks adverse events, which must never be hidden by completing billing (§10.3).
 * Gates unchanged: adverse_event.create to report, adverse_event.resolve to close.
 */
export function AdverseEventRegisterPanel() {
  const { t } = useTranslation();
  const { data: patientsData } = usePatientList({ limit: 50 });
  const patients = patientsData?.items || [];
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];

  const { data: events = [], isLoading } = useAdverseEvents();
  const report = useReportAdverseEvent();
  const close = useCloseAdverseEvent();

  const [form, setForm] = useState({
    patientId: '',
    branchId: '',
    severity: 'MILD',
    onsetAt: new Date().toISOString().slice(0, 16),
    description: '',
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.branchId || !form.description) return;
    await report.mutateAsync(form);
    setForm({ ...form, description: '' });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'treatments.safety.subtitle',
          'Adverse event register — severity, escalation, responsible clinician and closure.'
        )}
      </p>

      <PermissionGuard permissions={[PERMISSIONS.ADVERSE_EVENT_CREATE]}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />{' '}
              {t('treatments.safety.reportForm.title', 'Report an adverse event')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                value={form.patientId}
                onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
              >
                <option value="">
                  {t('treatments.safety.reportForm.patientPlaceholder', 'Patient')}
                </option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </Select>
              <Select
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
              >
                <option value="">
                  {t('treatments.safety.reportForm.branchPlaceholder', 'Branch')}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName || b.name}
                  </option>
                ))}
              </Select>
              <Select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
              >
                {['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'].map((s) => (
                  <option key={s} value={s}>
                    {t(SEVERITY_LABEL_KEYS[s], s.replace('_', ' '))}
                  </option>
                ))}
              </Select>
              <Input
                type="datetime-local"
                value={form.onsetAt}
                onChange={(e) => setForm((f) => ({ ...f, onsetAt: e.target.value }))}
              />
              <Input
                className="sm:col-span-2 lg:col-span-3"
                placeholder={t(
                  'treatments.safety.reportForm.descriptionPlaceholder',
                  'Description of what happened'
                )}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <Button type="submit" disabled={report.isPending}>
                <Plus className="h-4 w-4" /> {t('treatments.safety.reportForm.submit', 'Report')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardHeader>
          <CardTitle>{t('treatments.safety.register.title', 'Register')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('treatments.safety.register.columns.onset', 'Onset')}</TableHead>
                <TableHead>{t('treatments.safety.register.columns.severity', 'Severity')}</TableHead>
                <TableHead>
                  {t('treatments.safety.register.columns.description', 'Description')}
                </TableHead>
                <TableHead>{t('treatments.safety.register.columns.status', 'Status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('treatments.safety.register.empty', 'No adverse events recorded.')}
                  </TableCell>
                </TableRow>
              )}
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>{new Date(ev.onsetAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANT[ev.severity]}>
                      {t(SEVERITY_LABEL_KEYS[ev.severity], ev.severity.replace('_', ' '))}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-sm truncate">{ev.description}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ev.status]}>
                      {t(STATUS_LABEL_KEYS[ev.status], ev.status.replace(/_/g, ' '))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!['RESOLVED', 'CLOSED'].includes(ev.status) && (
                      <PermissionGuard permissions={[PERMISSIONS.ADVERSE_EVENT_RESOLVE]}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            close.mutate({
                              id: ev.id,
                              payload: {
                                closureNotes: t(
                                  'treatments.safety.register.defaultClosureNotes',
                                  'Reviewed and closed'
                                ),
                              },
                            })
                          }
                        >
                          {t('treatments.safety.register.closeButton', 'Close')}
                        </Button>
                      </PermissionGuard>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdverseEventRegisterPanel;
