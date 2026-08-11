import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AdverseEventRegisterPanel } from '@/modules/treatmentSafety/components/AdverseEventRegisterPanel';
import { PatchTestPanel } from '@/modules/treatmentSafety/components/PatchTestPanel';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';

/**
 * Thin wrapper — body shared with the Treatments hub's Safety tab.
 * TRT-006: patch tests are now recorded and reviewed right here via `PatchTestPanel` (previously
 * this page claimed they were "recorded from the treatment session workspace" but no such control
 * existed anywhere — `useRecordPatchTest`/`useReviewPatchTest` were wired to the backend and never
 * imported). The adverse-event register tracks events, which must never be hidden by completing
 * billing (§10.3).
 */
export default function TreatmentSafetyPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || undefined;
  return (
    <section className="space-y-8">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatments.safety.title', 'Treatment safety')}
      </h1>
      {patientId && (
        <p className="text-sm text-muted-foreground">
          {t('treatments.safety.filteredForPatient', 'Showing adverse events for this patient only.')}
        </p>
      )}

      <PermissionGuard permissions={[PERMISSIONS.PATCH_TEST_VIEW, PERMISSIONS.PATCH_TEST_RECORD]}>
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            {t('treatments.safety.patchTest.title', 'Patch tests')}
          </h2>
          <PatchTestPanel />
        </div>
      </PermissionGuard>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          {t('treatments.safety.register.sectionTitle', 'Adverse events')}
        </h2>
        <AdverseEventRegisterPanel patientId={patientId} />
      </div>
    </section>
  );
}
