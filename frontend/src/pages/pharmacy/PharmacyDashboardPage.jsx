import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PharmacyOverviewPanel } from '@/modules/pharmacy/components/PharmacyOverviewPanel';
import { APP_ROUTES } from '@/constants/routes';

/**
 * Thin wrapper — the body lives in `PharmacyOverviewPanel` and is shared with the Pharmacy hub's
 * Overview tab. Standalone there is no sibling tab, so the "Prescription queue" link stays here and
 * a row's "Open" navigates to `/pharmacy/queue?rx=<id>` exactly as it did before (highlight the
 * row; do not create a dispense record).
 */
export default function PharmacyDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('pharmacy.dashboard.title', 'Pharmacy')}
        </h1>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.PHARMACY_QUEUE}>
            {t('pharmacy.dashboard.prescriptionQueue', 'Prescription queue')}
          </Link>
        </Button>
      </div>
      <PharmacyOverviewPanel
        onOpenPrescription={(prescriptionId) =>
          navigate(`${APP_ROUTES.PHARMACY_QUEUE}?rx=${prescriptionId}`)
        }
      />
    </section>
  );
}
