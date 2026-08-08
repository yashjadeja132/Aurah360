import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ClinicalPhotosPanel } from '@/modules/consultations/components/ClinicalPhotosPanel';
import {
  usePatientConsultations,
  useConsultationPhotos,
} from '@/modules/consultations/hooks/useConsultations';

/**
 * Clinical photos inside the 360° patient profile, grouped by the consultation that captured them.
 *
 * Consent / body-area governance is deliberately NOT reimplemented here: photos are read through
 * the same `GET /consultations/:id/photos` endpoint (guarded by consultation.view) and rendered by
 * the same `ClinicalPhotosPanel` the consultation workspace uses, in read-only mode. That keeps the
 * consent-verified labelling, the seeded/blocked placeholder behaviour and the gated
 * `/files/photos/:id` image URL identical to the existing photos UI — no new ungated image path.
 */
export function PatientPhotosPanel({ patientId }) {
  const { t } = useTranslation();
  const { data: consultations = [], isLoading } = usePatientConsultations(patientId);

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  if (!consultations.length) {
    return (
      <EmptyState
        icon={Camera}
        title={t('patients.detail.photos.emptyTitle', 'No clinical photos')}
        description={t(
          'patients.detail.photos.emptyDescription',
          'Clinical photos are captured during a consultation. This patient has none yet.'
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t(
          'patients.detail.photos.consentNotice',
          'Clinical photos are consent-governed. Only share or export images whose photography consent is verified.'
        )}
      </p>
      {consultations.map((c) => (
        <ConsultationPhotos key={c.id} consultation={c} />
      ))}
    </div>
  );
}

function ConsultationPhotos({ consultation }) {
  const { t } = useTranslation();
  const { data: photos = [], isLoading } = useConsultationPhotos(consultation.id);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!photos.length) return null;

  const date = consultation.startedAt || consultation.createdAt;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {consultation.consultationNumber}
          {date ? ` · ${new Date(date).toLocaleDateString()}` : ''}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {consultation.doctor?.name ||
            t('patients.detail.photos.noDoctor', 'Doctor not recorded')}
          {' · '}
          {t('patients.detail.photos.count', '{{count}} photo(s)', { count: photos.length })}
        </p>
      </CardHeader>
      <CardContent>
        <ClinicalPhotosPanel consultationId={consultation.id} photos={photos} readOnly />
      </CardContent>
    </Card>
  );
}

export default PatientPhotosPanel;
