import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
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
import { usePatientList, usePatientMutations } from '@/modules/patients/hooks/usePatients';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { DoctorPicker } from '@/modules/appointments/components/bookingPickers';
import {
  useAdverseEvents,
  useReportAdverseEvent,
  useCloseAdverseEvent,
} from '../hooks/useTreatmentSafety';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { toast } from 'sonner';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. TreatmentSafetyService
// rejects reportAdverseEvent when payload.branchId differs from the reporter's own branch
// scope (see #reportAdverseEvent's BRANCH_SCOPE_VIOLATION check) — so DOCTOR/NURSE, who only
// ever report from their own branch, must never be offered a branch picker here.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

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
export function AdverseEventRegisterPanel({ patientId: filterPatientId } = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const ownBranchId = !isGlobalScope ? user?.branch || '' : '';
  const [patientSearch, setPatientSearch] = useState('');
  const { data: patientsData, isFetching: patientsFetching } = usePatientList({
    search: patientSearch,
    limit: 10,
    page: 1,
  });
  const patients = patientsData?.items || [];
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const ownBranchName =
    branches.find((b) => String(b.id) === String(ownBranchId))?.displayName ||
    branches.find((b) => String(b.id) === String(ownBranchId))?.name ||
    null;

  const { data: events = [], isLoading } = useAdverseEvents(
    filterPatientId ? { patientId: filterPatientId } : {}
  );
  const report = useReportAdverseEvent();
  const close = useCloseAdverseEvent();
  // Attachments are uploaded via the same patient-document upload mechanism used elsewhere
  // (PatientDocumentsPanel) — the file is uploaded first to get a documentId, which is then
  // referenced on the adverse event's `attachments` list.
  const { uploadDocument } = usePatientMutations();
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [form, setForm] = useState({
    patientId: filterPatientId || '',
    branchId: ownBranchId,
    severity: 'MILD',
    onsetAt: new Date().toISOString().slice(0, 16),
    description: '',
    treatmentGiven: '',
    escalatedTo: '',
    attachments: [],
  });

  const onAttachFile = async (file) => {
    if (!file) return;
    if (!form.patientId) {
      toast.error(t('treatments.safety.reportForm.selectPatientFirst', 'Select a patient before attaching files'));
      return;
    }
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'OTHER');
      formData.append('clinicalDate', new Date().toISOString().slice(0, 10));
      formData.append('source', 'INTERNAL_BRANCH');
      const res = await uploadDocument.mutateAsync({ id: form.patientId, formData });
      const documentId = res?.data?.document?.id || res?.document?.id;
      if (documentId) {
        setForm((f) => ({ ...f, attachments: [...f.attachments, { documentId, note: file.name }] }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || t('treatments.safety.reportForm.attachmentFailed', 'Attachment upload failed'));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (idx) =>
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.branchId || !form.description) return;
    await report.mutateAsync({
      ...form,
      escalatedTo: form.escalatedTo || undefined,
      treatmentGiven: form.treatmentGiven || undefined,
    });
    setForm({ ...form, description: '', treatmentGiven: '', escalatedTo: '', attachments: [] });
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
              <SearchableCombobox
                value={form.patientId}
                onChange={(id) => setForm((f) => ({ ...f, patientId: id }))}
                options={patients}
                search={patientSearch}
                onSearchChange={setPatientSearch}
                isLoading={patientsFetching}
                loadingText={t('common.searching', 'Searching…')}
                renderLabel={(p) => `${p.firstName} ${p.lastName}`}
                placeholder={t('treatments.safety.reportForm.patientPlaceholder', 'Patient')}
                emptyText={t('treatments.safety.reportForm.noPatientMatch', 'No match')}
              />
              {isGlobalScope ? (
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
              ) : (
                // Branch-scoped reporters (DOCTOR/NURSE) always report from their own branch —
                // the backend rejects any other branchId, so no picker is offered.
                <Input
                  value={ownBranchName || t('treatments.safety.reportForm.branchPlaceholder', 'Branch')}
                  disabled
                  readOnly
                />
              )}
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
              <textarea
                className="flex min-h-[2.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-2"
                placeholder={t('treatments.safety.reportForm.treatmentGivenPlaceholder', 'Treatment given')}
                rows={2}
                value={form.treatmentGiven}
                onChange={(e) => setForm((f) => ({ ...f, treatmentGiven: e.target.value }))}
              />
              <div className="sm:col-span-2 lg:col-span-2">
                <DoctorPicker
                  value={form.escalatedTo}
                  onChange={(id) => setForm((f) => ({ ...f, escalatedTo: id }))}
                  branchId={isGlobalScope ? form.branchId : ownBranchId}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'treatments.safety.reportForm.escalationHint',
                    'Escalation target / responsible clinician'
                  )}
                </p>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 space-y-2">
                <Input
                  type="file"
                  disabled={uploadingAttachment}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    onAttachFile(file);
                    e.target.value = '';
                  }}
                />
                {form.attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {form.attachments.map((a, idx) => (
                      <li key={idx} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                        {a.note || t('treatments.safety.reportForm.attachment', 'Attachment')}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeAttachment(idx)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
