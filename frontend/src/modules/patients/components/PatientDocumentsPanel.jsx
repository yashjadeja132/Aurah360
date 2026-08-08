import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';
import { usePatientDocuments, usePatientMutations } from '../hooks/usePatients';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

const CATEGORIES = [
  'IDENTITY_PROOF',
  'PRESCRIPTION',
  'LAB_REPORT',
  'MEDICAL_REPORT',
  'CONSENT_FORM',
  'INSURANCE',
  'OTHER',
];

const SOURCES = ['PATIENT', 'EXTERNAL_DOCTOR', 'CLINIC_GENERATED', 'INSURANCE_PROVIDER', 'OTHER'];

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
  // DOC-001 — the backend hard-requires a clinical/report date (not the upload date) before
  // it will accept a document; defaulting to today covers the common case while still letting
  // staff correct it for a report that was actually dated earlier.
  const [clinicalDate, setClinicalDate] = useState(todayIso());
  const [source, setSource] = useState('PATIENT');

  const categoryLabel = (c) =>
    t(`patients.documents.categories.${c}`, c.replaceAll('_', ' '));

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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('clinicalDate', clinicalDate);
    formData.append('source', source);
    if (title) formData.append('title', title);
    try {
      await uploadDocument.mutateAsync({ id: patientId, formData });
      toast.success(t('patients.documents.uploadSuccess', 'Document uploaded'));
      setFile(null);
      setTitle('');
      setClinicalDate(todayIso());
    } catch (err) {
      toast.error(err?.response?.data?.message || t('patients.documents.uploadFailed', 'Upload failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <PermissionGuard permissions={[PERMISSIONS.PATIENTS_DOCUMENTS, PERMISSIONS.PATIENTS_ALL]}>
        <form onSubmit={onUpload} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </Select>
          <Input
            placeholder={t('patients.documents.titleOptional', 'Title (optional)')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button type="submit" disabled={uploadDocument.isPending}>
            {t('common.upload', 'Upload')}
          </Button>
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
                <p className="text-xs text-muted-foreground">
                  {categoryLabel(doc.category)} · {(doc.size / 1024).toFixed(1)} KB
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
