import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { APP_ROUTES } from '@/constants/routes';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useOwnerBranchComparison } from '@/modules/reports/hooks/useOwnerLanding';
import { OwnerBranchScorecard } from '@/modules/reports/components/OwnerBranchScorecard';
import { OwnerApprovalsPanel } from '@/modules/reports/components/OwnerApprovalsPanel';

/**
 * Owner landing — the "90-second morning glance" the flow doc asks for.
 *
 * One screen, no navigation required:
 *   1. revenue / new patients / completed treatments for every branch and the
 *      all-branches total, today framed against yesterday;
 *   2. everything awaiting the owner's sign-off (discount approvals, loyalty
 *      manual adjustments, cash-close approvals).
 *
 * All data comes from endpoints that already exist — see
 * `modules/reports/hooks/useOwnerLanding.js` for why `GET /reports/analytics`
 * is the source rather than the executive or owner dashboard endpoints.
 */
export default function OwnerLandingPage() {
  const { t } = useTranslation();
  // `limit` is capped at 100 server-side.
  const { data: branchesData, isLoading: branchesLoading } = useBranchList({ limit: 100 });
  const branches = branchesData?.items || [];

  const comparison = useOwnerBranchComparison(branches);

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('owner.landing.title', 'Today at a glance')}
        description={t(
          'owner.landing.subtitle',
          'Every branch, today against yesterday, plus everything waiting on your approval.'
        )}
        actions={
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.REPORTS}>{t('reports.hubTitle', 'Reports & Analytics')}</Link>
          </Button>
        }
      />

      <OwnerBranchScorecard
        rows={comparison.rows}
        totals={comparison.totals}
        isLoading={branchesLoading || comparison.isLoading}
        isError={comparison.isError}
        error={comparison.error}
      />

      <OwnerApprovalsPanel />
    </section>
  );
}
