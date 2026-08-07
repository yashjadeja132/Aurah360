import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import {
  useBreakGlassGrants,
  usePrivacyRequests,
  useOpenPrivacyRequest,
  useVerifyIdentity,
  useResolvePrivacyRequest,
} from '@/modules/privacy/hooks/usePrivacy';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

const REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'ERASURE', 'PORTABILITY', 'WITHDRAW_CONSENT', 'GRIEVANCE', 'OPT_OUT'];
const STATUS_VARIANT = { OPEN: 'secondary', IN_REVIEW: 'info', FULFILLED: 'success', DENIED: 'destructive', PARTIALLY_FULFILLED: 'warning' };

/** §16.5, PRV-002/003 — data-subject rights case management + break-glass access log. */
export default function PrivacyAdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('requests');

  const TABS = [
    { id: 'requests', label: t('settings.privacy.tabs.requests', 'Privacy requests'), icon: FileClock },
    { id: 'breakglass', label: t('settings.privacy.tabs.breakglass', 'Break-glass log'), icon: ShieldAlert },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.privacy.title', 'Privacy & access governance')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.privacy.description', 'Data-subject rights cases and the break-glass emergency-access log.')}
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium',
              tab === tb.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
          </button>
        ))}
      </div>

      {tab === 'requests' ? <PrivacyRequestsTab /> : <BreakGlassTab />}
    </section>
  );
}

function PrivacyRequestsTab() {
  const { t } = useTranslation();
  const { data: patientsData } = usePatientList({ limit: 50 });
  const patients = patientsData?.items || [];
  const { data: requests = [], isLoading } = usePrivacyRequests();
  const open = useOpenPrivacyRequest();
  const verify = useVerifyIdentity();
  const resolve = useResolvePrivacyRequest();
  const [form, setForm] = useState({ patientId: '', type: 'ACCESS', description: '' });

  return (
    <div className="space-y-4">
      <PermissionGuard permissions={[PERMISSIONS.PRIVACY_REQUEST_CREATE, PERMISSIONS.PRIVACY_REQUEST_ALL]}>
        <Card>
          <CardHeader><CardTitle>{t('settings.privacy.requests.newCaseCard', 'Open a new case')}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!form.patientId) return;
                await open.mutateAsync(form);
                setForm({ patientId: '', type: 'ACCESS', description: '' });
              }}
            >
              <Select value={form.patientId} onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}>
                <option value="">{t('settings.privacy.requests.patientPlaceholder', 'Patient')}</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
              </Select>
              <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {REQUEST_TYPES.map((rt) => <option key={rt} value={rt}>{rt.replace(/_/g, ' ')}</option>)}
              </Select>
              <Input placeholder={t('settings.privacy.requests.descriptionPlaceholder', 'Description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              <Button type="submit" disabled={open.isPending}>{t('settings.privacy.requests.openCaseAction', 'Open case')}</Button>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow><TableHead>{t('settings.privacy.requests.table.type', 'Type')}</TableHead><TableHead>{t('settings.privacy.requests.table.due', 'Due')}</TableHead><TableHead>{t('settings.privacy.requests.table.status', 'Status')}</TableHead><TableHead>{t('settings.privacy.requests.table.actions', 'Actions')}</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && requests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('settings.privacy.requests.empty', 'No open cases.')}</TableCell></TableRow>}
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.type.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{new Date(r.dueDate).toDateString()}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status] || 'secondary'}>{r.status.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    <PermissionGuard permissions={[PERMISSIONS.PRIVACY_REQUEST_RESOLVE, PERMISSIONS.PRIVACY_REQUEST_ALL]}>
                      {r.status === 'OPEN' && (
                        <Button size="sm" variant="outline" onClick={() => verify.mutate(r.id)}>{t('settings.privacy.requests.verifyIdentityAction', 'Verify identity')}</Button>
                      )}
                      {r.status === 'IN_REVIEW' && (
                        <Button size="sm" onClick={() => resolve.mutate({ id: r.id, payload: { status: 'FULFILLED' } })}>
                          {t('settings.privacy.requests.markFulfilledAction', 'Mark fulfilled')}
                        </Button>
                      )}
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BreakGlassTab() {
  const { t } = useTranslation();
  const { data: grants = [], isLoading } = useBreakGlassGrants();

  return (
    <Card>
      <CardHeader><CardTitle>{t('settings.privacy.breakglass.title', 'Break-glass access log')}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow><TableHead>{t('settings.privacy.breakglass.table.resource', 'Resource')}</TableHead><TableHead>{t('settings.privacy.breakglass.table.reason', 'Reason')}</TableHead><TableHead>{t('settings.privacy.breakglass.table.granted', 'Granted')}</TableHead><TableHead>{t('settings.privacy.breakglass.table.expires', 'Expires')}</TableHead><TableHead>{t('settings.privacy.breakglass.table.status', 'Status')}</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && grants.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('settings.privacy.breakglass.empty', 'No break-glass access has been used.')}</TableCell></TableRow>}
            {grants.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.resourceType}{g.resourceId ? ` #${g.resourceId}` : ''}</TableCell>
                <TableCell className="max-w-xs truncate">{g.reason}</TableCell>
                <TableCell>{new Date(g.grantedAt).toLocaleString()}</TableCell>
                <TableCell>{new Date(g.expiresAt).toLocaleString()}</TableCell>
                <TableCell><Badge variant={g.isValidNow ? 'warning' : 'secondary'}>{g.isValidNow ? t('settings.privacy.breakglass.active', 'Active') : t('settings.privacy.breakglass.expired', 'Expired')}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
