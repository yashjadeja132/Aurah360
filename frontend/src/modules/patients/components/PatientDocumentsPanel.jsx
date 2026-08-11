import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';
import { usePatientDocuments, usePatientMutations } from '../hooks/usePatients';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { localDateKey, todayKey } from '@/utils/date';

const CATEGORIES = [
  'IDENTITY_PROOF',
  'PRESCRIPTION',
  'LAB_REPORT',
  'MEDICAL_REPORT',
  'CONSENT_FORM',
  'INSURANCE',
  'OTHER',
];

/** Must match DOCUMENT_SOURCE on the server (backend/src/enums/patient.js) — the model enforces it
 *  as an enum, so an invented value is rejected on upload. */
const SOURCES = ['PATIENT', 'EXTERNAL_DOCTOR', 'LABORATORY', 'HOSPITAL', 'INTERNAL_BRANCH'];

function todayIso() {
  return todayKey();
}

export function PatientDocumentsPanel({ patientId }) {
  const { t } = useTranslation();
  const { data: docs = [], isLoading } = usePatientDocuments(patientId);
  const { uploadDocument, renameDocument, deleteDocument } = usePatientMutations();
  const [category, setCategory] = useState('IDENTITY_PROOF');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  /**
   * DOC-001 — the date printed ON the report, which for a scanned external report is in the PAST.
   *
   * Starts EMPTY on purpose. These two fields were held in state and posted to the server but never
   * rendered, so every upload was silently filed under today's date and source PATIENT: a lab report
   * from three months ago landed at the top of the clinical timeline, and the timeline is what the
   * doctor reads to reconstruct a history. A wrong date that nobody was asked for is worse than a
   * required field, so the value must be entered rather than inherited from the upload moment.
   */
  const [clinicalDate, setClinicalDate] = useState('');
  const [source, setSource] = useState('PATIENT');
  // §5 — patient visibility chosen at Save: hidden (staff/doctor-only) or released once a
  // doctor approves. Defaults HIDDEN, matching the server default for anything left unset.
  const [patientVisibility, setPatientVisibility] = useState('HIDDEN');

  const categoryLabel = (c) =>
    t(`patients.documents.categories.${c}`, c.replaceAll('_', ' '));

  const sourceLabel = (s) => t(`patients.documents.sources.${s}`, s.replaceAll('_', ' '));

  const onUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error(t('patients.documents.chooseFile', 'Choose a file'));
      return;
    }
    if (!clinicalDate) {
      toast.error(t('patients.documents.dateRequired', 'Clinical/report date is required'));
      return;
    }
    // `max` on the input only constrains the picker; a typed date still gets through, and the
    // server rejects a future date anyway — catching it here keeps the file upload from being
    // re-sent just to be refused.
    if (clinicalDate > todayIso()) {
      toast.error(t('patients.documents.dateFuture', 'Clinical/report date cannot be in the future'));
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('clinicalDate', clinicalDate);
    formData.append('source', source);
    formData.append('patientVisibility', patientVisibility);
    if (title) formData.append('title', title);
    try {
      await uploadDocument.mutateAsync({ id: patientId, formData });
      toast.success(t('patients.documents.uploadSuccess', 'Document uploaded'));
      setFile(null);
      setTitle('');
      // Cleared, not reset to today — the next document is a different document with its own date.
      setClinicalDate('');
      setPatientVisibility('HIDDEN');
    } catch (err) {
      toast.error(err?.response?.data?.message || t('patients.documents.uploadFailed', 'Upload failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <PermissionGuard permissions={[PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL]}>
        <form onSubmit={onUpload} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="doc-category">{t('patients.documents.category', 'Category')}</Label>
            <Select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel(c)}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-clinical-date">
              {t('patients.documents.clinicalDate', 'Date on report')}
            </Label>
            <Input
              id="doc-clinical-date"
              type="date"
              required
              // A report is dated when it was issued; the picker must not offer a later day.
              max={todayIso()}
              value={clinicalDate}
              onChange={(e) => setClinicalDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('patients.documents.clinicalDateHint', 'Use the date printed on the report, not today.')}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-source">{t('patients.documents.source', 'Source')}</Label>
            <Select id="doc-source" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{sourceLabel(s)}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-visibility">{t('patients.documents.visibility', 'Patient visibility')}</Label>
            <Select
              id="doc-visibility"
              value={patientVisibility}
              onChange={(e) => setPatientVisibility(e.target.value)}
            >
              <option value="HIDDEN">{t('patients.documents.visibilityHidden', 'Hidden (staff only)')}</option>
              <option value="RELEASE_ON_APPROVAL">
                {t('patients.documents.visibilityReleaseOnApproval', 'Release on doctor approval')}
              </option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-title">{t('patients.documents.titleField', 'Title')}</Label>
            <Input
              id="doc-title"
              placeholder={t('patients.documents.titleOptional', 'Title (optional)')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-file">{t('patients.documents.file', 'File')}</Label>
            <Input
              id="doc-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={uploadDocument.isPending}>
              {t('common.upload', 'Upload')}
            </Button>
          </div>
        </form>
      </PermissionGuard>

      {!docs.length ? (
        <EmptyState
          title={t('patients.documents.noDocuments', 'No documents')}
          description={t('patients.documents.noDocumentsDesc', 'Upload identity proofs, labs, consents and more.')}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{doc.title}</p>
                {/* The clinical date is what orders the timeline, so it has to be visible here —
                    a wrong one is only correctable if someone can see it. */}
                <p className="text-xs text-muted-foreground">
                  {categoryLabel(doc.category)} · {sourceLabel(doc.source || 'PATIENT')} ·{' '}
                  {/* `null` (not undefined) so a missing date never renders as today. */}
                  {t('patients.documents.dated', 'Dated')} {localDateKey(doc.clinicalDate || null) || '—'} ·{' '}
                  {(doc.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`${APP_CONFIG.apiOrigin || ''}${doc.url}`} target="_blank" rel="noreferrer">
                    {t('patients.documents.preview', 'Preview')}
                  </a>
                </Button>
                <PermissionGuard permissions={[PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL]}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const next = window.prompt(t('patients.documents.renamePrompt', 'Rename document'), doc.title);
                      if (!next?.trim()) return;
                      await renameDocument.mutateAsync({
                        id: patientId,
                        documentId: doc.id,
                        title: next.trim(),
                      });
                      toast.success(t('patients.documents.renamed', 'Renamed'));
                    }}
                  >
                    {t('patients.documents.rename', 'Rename')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(t('patients.documents.deleteConfirm', 'Delete this document?'))) return;
                      await deleteDocument.mutateAsync({ id: patientId, documentId: doc.id });
                      toast.success(t('patients.documents.deleted', 'Deleted'));
                    }}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </PermissionGuard>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PatientDocumentsPanel;
