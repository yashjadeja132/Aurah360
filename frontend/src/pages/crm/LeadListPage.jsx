import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useLeads, useCreateLead } from '@/modules/crm/hooks/useCrm';
import { LEAD_STATUS_LABELS } from '@/modules/crm/constants';
import { leadDetailPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import api from '@/services/api';
import { toast } from 'sonner';

export default function LeadListPage() {
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
  const branchId =
    branchesRes?.data?.items?.[0]?.id || branchesRes?.data?.[0]?.id || null;

  const quickCreate = async () => {
    if (!branchId) {
      toast.error(t('crm.leadList.noBranch'));
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.leadList.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('crm.leadList.subtitle')}</p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.CRM_CREATE, PERMISSIONS.CRM_ALL]}>
          <Button onClick={quickCreate} disabled={create.isPending}>
            <Plus className="h-4 w-4" />
            {t('crm.leadList.newLead')}
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder={t('crm.leadList.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('crm.leadList.allStatuses')}</option>
          {Object.keys(LEAD_STATUS_LABELS).map((k) => (
            <option key={k} value={k}>
              {t(`crm.leadStatus.${k}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
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
                {l.phone} · {l.source || '—'} · {l.assignee?.fullName || t('crm.leadList.unassigned')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{t(`crm.leadStatus.${l.status}`)}</Badge>
              <Button asChild size="sm" variant="outline">
                <Link to={leadDetailPath(l.id)}>{t('crm.leadList.open')}</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
