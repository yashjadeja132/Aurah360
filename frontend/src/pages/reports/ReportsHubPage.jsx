import { Navigate } from 'react-router-dom';
import { APP_ROUTES } from '@/constants/routes';

/**
 * The old hub-of-cards is gone — its card grids are now tabs on
 * `ReportsWorkspacePage`. Kept as a redirect so any bookmark or stale link that
 * still resolves through this component lands on the consolidated screen.
 * (`routes/lazyPages.js` still imports this file.)
 */
export default function ReportsHubPage() {
  return <Navigate to={`${APP_ROUTES.REPORTS}?tab=dashboards`} replace />;
}
