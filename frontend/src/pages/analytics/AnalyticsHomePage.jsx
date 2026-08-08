import { Navigate } from 'react-router-dom';
import { APP_ROUTES } from '@/constants/routes';

/**
 * The analytics landing was a second hub-of-cards duplicating the reports hub.
 * Its executive card and category grid are now the "Dashboards" and "Reports"
 * tabs of `ReportsWorkspacePage`, so this redirects there.
 * (`routes/lazyPages.js` still imports this file.)
 */
export default function AnalyticsHomePage() {
  return <Navigate to={`${APP_ROUTES.REPORTS}?tab=reports`} replace />;
}
