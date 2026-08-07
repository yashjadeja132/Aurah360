import { useTranslation } from 'react-i18next';
import { usePatientDocuments } from '@/modules/patientPortal/hooks/usePatientPortal';

export default function PatientDocumentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientDocuments();
  const items = Array.isArray(data) ? data : data?.items || [];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.documents.title', 'Documents')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.documents.description', 'Reports, consents, and uploads.')}</p>
      </div>
      <div className="space-y-2">
        {items.map((d) => (
          <a
            key={d.id}
            href={d.url || '#'}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border bg-white/80 p-4 hover:bg-teal-50/50"
          >
            <p className="font-medium">{d.title || d.fileName || t('portal.documents.defaultTitle', 'Document')}</p>
            <p className="text-xs text-muted-foreground">{d.category || t('portal.documents.defaultCategory', 'General')}</p>
          </a>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.documents.empty', 'No documents yet.')}</p>
        )}
      </div>
    </section>
  );
}
