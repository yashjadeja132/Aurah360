import { useParams, Navigate } from 'react-router-dom';
import { MasterCrudPage } from '@/modules/masters/components/MasterCrudPage';
import { MASTER_CONFIGS } from '@/modules/masters/config/masterConfigs';

export default function MasterPage() {
  const { masterSlug } = useParams();
  const config = MASTER_CONFIGS[masterSlug];

  if (!config) {
    return <Navigate to="/settings/departments" replace />;
  }

  return <MasterCrudPage config={config} />;
}
