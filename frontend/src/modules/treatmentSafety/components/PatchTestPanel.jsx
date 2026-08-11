import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical, Plus } from 'lucide-react';
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
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { useRecordPatchTest, useReviewPatchTest, usePatientPatchTests } from '../hooks/useTreatmentSafety';
import { PERMISSIONS } from '@/constants/rbac';

const RESULT_VARIANT = {
  PENDING: 'warning',
  NEGATIVE: 'success',
  POSITIVE: 'destructive',
  INCONCLUSIVE: 'secondary',
};

const RESULT_LABEL_KEYS = {
  PENDING: 'treatments.safety.patchTest.result.pending',
  NEGATIVE: 'treatments.safety.patchTest.result.negative',
  POSITIVE: 'treatments.safety.patchTest.result.positive',
  INCONCLUSIVE: 'treatments.safety.patchTest.result.inconclusive',
};

/**
 * Records and reviews patch tests. Follows `AdverseEventRegisterPanel`'s structure (report form
 * up top gated on the create permission, register/table below with a per-row action gated on the
 * review permission).
 *
 * There is no backend-recognized `PATCH_TEST_REVIEW` permission today — `POST
 * /treatment-safety/patch-tests/:id/review` is gated on the same `patch_test.record` grant as
 * recording one (see `backend/src/routes/v1/treatmentSafety.routes.js`). Both actions here are
 * gated on `PATCH_TEST_RECORD` (with the `PATCH_TEST_VIEW` wildcard) for that reason, matching the
 * server rather than inventing a client-only permission the API doesn't check.
 */
export function PatchTestPanel() {
  const { t } = useTranslation();
  const [recordPatientSearch, setRecordPatientSearch] = useState('');
  const { data: recordPatientsData, isFetching: recordPatientsFetching } = usePatientList({
    search: recordPatientSearch,
    limit: 10,
    page: 1,
  });
  const recordPatients = recordPatientsData?.items || [];

  const [registerPatientSearch, setRegisterPatientSearch] = useState('');
  const { data: registerPatientsData, isFetching: registerPatientsFetching } = usePatientList({
    search: registerPatientSearch,
    limit: 10,
    page: 1,
  });
  const registerPatients = registerPatientsData?.items || [];

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const { data: tests = [], isLoading } = usePatientPatchTests(selectedPatientId);
  const record = useRecordPatchTest();
  const review = useReviewPatchTest();

  const [form, setForm] = useState({
    patientId: '',
    productOrSetting: '',
    testArea: '',
    reviewDueAt: '',
  });

  const [reviewDrafts, setReviewDrafts] = useState({});

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId || !form.productOrSetting || !form.testArea || !form.reviewDueAt) return;
    await record.mutateAsync({
      patientId: form.patientId,
      productOrSetting: form.productOrSetting,
      testArea: form.testArea,
      reviewDueAt: form.reviewDueAt,
    });
    setForm((f) => ({ ...f, productOrSetting: '', testArea: '', reviewDueAt: '' }));
  };

  const draftFor = (id) => reviewDrafts[id] || { result: 'NEGATIVE', reactionNotes: '' };
  const setDraft = (id, patch) =>
    setReviewDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...patch } }));

  const onReview = async (id) => {
    const draft = draftFor(id);
    await review.mutateAsync({ id, payload: { result: draft.result, reactionNotes: draft.reactionNotes || null } });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'treatments.safety.patchTest.subtitle',
          'Record a patch test before a first-time product or setting, and log the reaction result once it is read.'
        )}
      </p>

      <PermissionGuard permissions={[PERMISSIONS.PATCH_TEST_RECORD]}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />{' '}
              {t('treatments.safety.patchTest.recordForm.title', 'Record a patch test')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SearchableCombobox
                value={form.patientId}
                onChange={(id) => setForm((f) => ({ ...f, patientId: id }))}
                options={recordPatients}
                search={recordPatientSearch}
                onSearchChange={setRecordPatientSearch}
                isLoading={recordPatientsFetching}
                loadingText={t('common.searching', 'Searching…')}
                renderLabel={(p) => `${p.firstName} ${p.lastName}`}
                placeholder={t('treatments.safety.patchTest.recordForm.patientPlaceholder', 'Patient')}
                emptyText={t('treatments.safety.patchTest.recordForm.noPatientMatch', 'No match')}
              />
              <Input
                placeholder={t('treatments.safety.patchTest.recordForm.productPlaceholder', 'Product / setting')}
                value={form.productOrSetting}
                onChange={(e) => setForm((f) => ({ ...f, productOrSetting: e.target.value }))}
              />
              <Input
                placeholder={t('treatments.safety.patchTest.recordForm.areaPlaceholder', 'Test area (e.g. forearm)')}
                value={form.testArea}
                onChange={(e) => setForm((f) => ({ ...f, testArea: e.target.value }))}
              />
              <Input
                type="date"
                value={form.reviewDueAt}
                onChange={(e) => setForm((f) => ({ ...f, reviewDueAt: e.target.value }))}
              />
              <Button type="submit" disabled={record.isPending} className="sm:col-span-2 lg:col-span-5 lg:w-fit">
                <Plus className="h-4 w-4" /> {t('treatments.safety.patchTest.recordForm.submit', 'Record patch test')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardHeader>
          <CardTitle>{t('treatments.safety.patchTest.register.title', 'Patch tests')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="sm:max-w-xs">
            <SearchableCombobox
              value={selectedPatientId}
              onChange={setSelectedPatientId}
              options={registerPatients}
              search={registerPatientSearch}
              onSearchChange={setRegisterPatientSearch}
              isLoading={registerPatientsFetching}
              loadingText={t('common.searching', 'Searching…')}
              renderLabel={(p) => `${p.firstName} ${p.lastName}`}
              placeholder={t(
                'treatments.safety.patchTest.register.selectPatient',
                'Select a patient to view their patch tests'
              )}
              emptyText={t('treatments.safety.patchTest.register.noPatientMatch', 'No match')}
            />
          </div>

          {!selectedPatientId ? (
            <p className="text-sm text-muted-foreground">
              {t('treatments.safety.patchTest.register.empty', 'Choose a patient above to see their patch test history.')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('treatments.safety.patchTest.register.columns.product', 'Product / setting')}</TableHead>
                  <TableHead>{t('treatments.safety.patchTest.register.columns.area', 'Area')}</TableHead>
                  <TableHead>{t('treatments.safety.patchTest.register.columns.dueAt', 'Review due')}</TableHead>
                  <TableHead>{t('treatments.safety.patchTest.register.columns.result', 'Result')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isLoading && tests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('treatments.safety.patchTest.register.none', 'No patch tests recorded for this patient.')}
                    </TableCell>
                  </TableRow>
                )}
                {tests.map((pt) => {
                  const pending = pt.result === 'PENDING' || !pt.result;
                  const draft = draftFor(pt.id);
                  return (
                    <TableRow key={pt.id}>
                      <TableCell>{pt.productOrSetting}</TableCell>
                      <TableCell>{pt.testArea}</TableCell>
                      <TableCell>{pt.reviewDueAt ? new Date(pt.reviewDueAt).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={RESULT_VARIANT[pt.result] || 'warning'}>
                          {t(RESULT_LABEL_KEYS[pt.result] || RESULT_LABEL_KEYS.PENDING, pt.result || 'PENDING')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {pending && (
                          <PermissionGuard permissions={[PERMISSIONS.PATCH_TEST_RECORD]}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={draft.result}
                                onChange={(e) => setDraft(pt.id, { result: e.target.value })}
                                className="h-8 w-36 text-xs"
                              >
                                {['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE'].map((r) => (
                                  <option key={r} value={r}>
                                    {t(RESULT_LABEL_KEYS[r], r)}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                className="h-8 w-40 text-xs"
                                placeholder={t('treatments.safety.patchTest.register.notesPlaceholder', 'Reaction notes')}
                                value={draft.reactionNotes}
                                onChange={(e) => setDraft(pt.id, { reactionNotes: e.target.value })}
                              />
                              <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => onReview(pt.id)}>
                                {t('treatments.safety.patchTest.register.submitReview', 'Save result')}
                              </Button>
                            </div>
                          </PermissionGuard>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PatchTestPanel;
