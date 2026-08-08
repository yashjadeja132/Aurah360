import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useLeads, useCreateLead } from '@/modules/crm/hooks/useCrm';
import { LEAD_STATUS_LABELS } from '@/modules/crm/constants';
import { leadDetailPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import api from '@/services/api';
import { toast } from 'sonner';

/** Searchable/filterable lead list (was LeadListPage). Lead detail stays a route. */
export function CrmLeadsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading } = useLeads({ status: status || undefined, q: q || undefined, limit: 50 });
  const create = useCreateLead();
  const leads = data?.items || [];
  const { data: branchesRes } = useQuery({
    queryKey: ['branches', 'crm-create'],
    queryFn: async () => (await api.get('/branches', { params: { limit: 1 } })).data,
  });
  const branchId = branchesRes?.data?.items?.[0]?.id || branchesRes?.data?.[0]?.id || null;

  const quickCreate = async () => {
    if (!branchId) {
      toast.error(t('crm.leadList.noBranch', 'No branch available'));
      return;
    }
    const res = await create.mutateAsync({
      firstName: 'New',
      lastName: 'Lead',
      phone: `99${Date.now().toString().slice(-8)}`,
      branchId,
      priority: 'MEDIUM',
    });
    const id = res?.data?.lead?.id;
    if (id) navigate(leadDetailPath(id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('crm.leadList.subtitle', 'All leads')}</p>
        <PermissionGuard permissions={[PERMISSIONS.CRM_CREATE, PERMISSIONS.CRM_ALL]}>
          <Button onClick={quickCreate} disabled={create.isPending}>
            <Plus className="h-4 w-4" />
            {t('crm.leadList.newLead', 'New lead')}
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder={t('crm.leadList.searchPlaceholder', 'Search leads…')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('crm.leadList.allStatuses', 'All statuses')}</option>
          {Object.keys(LEAD_STATUS_LABELS).map((k) => (
            <option key={k} value={k}>
              {t(`crm.leadStatus.${k}`, k)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {leads.map((l) => (
          <div
            key={l.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {l.fullName} · {l.leadNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.phone} · {l.source || '—'} · {l.assignee?.fullName || t('crm.leadList.unassigned', 'Unassigned')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{t(`crm.leadStatus.${l.status}`, l.status)}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link to={leadDetailPath(l.id)}>{t('crm.leadList.open', 'Open')}</Link>
              </Button>
            </div>
          </div>
        ))}
        {!leads.length && !isLoading && (
          <EmptyState title={t('crm.leadList.empty', 'No leads match these filters.')} />
        )}
      </div>
    </div>
  );
}

export default CrmLeadsPanel;
