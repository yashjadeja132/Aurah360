import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useLead,
  useAddFollowUp,
  useConvertLead,
} from '@/modules/crm/hooks/useCrm';
import { crmApi } from '@/modules/crm/api/crmApi';
import { FOLLOW_UP_TYPES } from '@/modules/crm/constants';
import { APP_ROUTES, patientDetailPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { toast } from 'sonner';

export default function LeadDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: lead, isLoading } = useLead(id);
  const addFu = useAddFollowUp(id);
  const convert = useConvertLead(id);

  const [fuType, setFuType] = useState('CALL');
  const [fuNotes, setFuNotes] = useState('');
  const [nextFu, setNextFu] = useState('');

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!lead) return <p className="p-6 text-sm text-destructive">{t('crm.leadDetail.notFound')}</p>;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={APP_ROUTES.CRM_LEADS}>
            <ArrowLeft className="h-4 w-4" />
            {t('crm.leadDetail.backToLeads')}
          </Link>
        </Button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-primary">{lead.fullName}</h1>
          <Badge>{t(`crm.leadStatus.${lead.status}`)}</Badge>
          <Badge variant="outline">{lead.priority}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {lead.leadNumber} · {lead.phone} · {lead.source || '—'} ·{' '}
          {lead.assignee?.fullName || t('crm.leadDetail.unassigned')}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 text-sm">
        <p>{t('crm.leadDetail.city')}: {lead.city || '—'}</p>
        <p>{t('crm.leadDetail.budget')}: {lead.budget ?? '—'}</p>
        <p>{t('crm.leadDetail.campaign')}: {lead.campaign || '—'}</p>
        <p>{t('crm.leadDetail.services')}: {(lead.interestedServices || []).join(', ') || '—'}</p>
        <p className="sm:col-span-2">{t('crm.leadDetail.remarks')}: {lead.remarks || '—'}</p>
        {lead.convertedPatientId && (
          <p className="sm:col-span-2">
            {t('crm.leadDetail.convertedPatient')}:{' '}
            <Link className="text-primary underline" to={patientDetailPath(lead.convertedPatientId)}>
              {lead.convertedPatient?.mrn || lead.convertedPatientId}
            </Link>
          </p>
        )}
      </div>

      {/* Follow-up timeline */}
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('crm.leadDetail.followUpTimeline')}</h2>
        {(lead.followUps || []).map((f) => (
          <div key={f.id} className="border-b border-dashed py-2 text-sm">
            <p className="font-medium">
              {f.type} · {f.date ? new Date(f.date).toLocaleString() : '—'}
            </p>
            <p className="text-muted-foreground">
              {f.notes || '—'} · {f.outcome || ''}
            </p>
          </div>
        ))}
        {!lead.followUps?.length && (
          <p className="text-sm text-muted-foreground">{t('crm.leadDetail.noFollowUps')}</p>
        )}

        <PermissionGuard permissions={[PERMISSIONS.CRM_FOLLOWUP, PERMISSIONS.CRM_ALL]}>
          <div className="grid gap-2 sm:grid-cols-4 pt-2">
            <Select value={fuType} onChange={(e) => setFuType(e.target.value)}>
              {FOLLOW_UP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input
              className="sm:col-span-2"
              placeholder={t('crm.leadDetail.notesPlaceholder')}
              value={fuNotes}
              onChange={(e) => setFuNotes(e.target.value)}
            />
            <Input type="datetime-local" value={nextFu} onChange={(e) => setNextFu(e.target.value)} />
            <Button
              className="sm:col-span-4"
              disabled={addFu.isPending}
              onClick={() =>
                addFu.mutate({
                  type: fuType,
                  notes: fuNotes,
                  nextFollowUp: nextFu ? new Date(nextFu).toISOString() : undefined,
                })
              }
            >
              {t('crm.leadDetail.addFollowUp')}
            </Button>
          </div>
        </PermissionGuard>
      </div>

      {/* Communication placeholders */}
      <div className="rounded-xl border p-4">
        <h2 className="mb-2 font-semibold">{t('crm.leadDetail.communicationPlaceholder')}</h2>
        <div className="flex flex-wrap gap-2">
          {['WHATSAPP', 'SMS', 'EMAIL', 'PHONE'].map((channel) => (
            <Button
              key={channel}
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await crmApi.logCommunication(id, {
                    channel,
                    notes: `${channel} placeholder log`,
                  });
                  toast.success(t('crm.leadDetail.loggedNoIntegration', { channel }));
                } catch (e) {
                  toast.error(e?.response?.data?.message || t('crm.leadDetail.failed'));
                }
              }}
            >
              {channel}
            </Button>
          ))}
        </div>
      </div>

      {/* Conversion */}
      {!lead.convertedPatientId && lead.status !== 'LOST' && lead.status !== 'JUNK' && (
        <PermissionGuard permissions={[PERMISSIONS.CRM_CONVERT, PERMISSIONS.CRM_ALL]}>
          <div className="rounded-xl border p-4">
            <h2 className="mb-2 font-semibold">{t('crm.leadDetail.convertToPatient')}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('crm.leadDetail.convertHint')}
            </p>
            <Button disabled={convert.isPending} onClick={() => convert.mutate({})}>
              {t('crm.leadDetail.convertLead')}
            </Button>
          </div>
        </PermissionGuard>
      )}
    </section>
  );
}
