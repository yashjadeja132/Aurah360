import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import {
  useInvoices,
  useCreateInvoice,
  useCreateInvoiceFromPlan,
} from '@/modules/billing/hooks/useBilling';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatMoney,
  emptyItem,
} from '@/modules/billing/constants';
import { invoiceDetailPath, invoicePrintPath } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. A branch-scoped role
// (Cashier, Branch Manager, Pharmacist) only ever works at their own branch, so the branch
// picker is Owner/Admin-only for them — it is pre-filled and locked instead.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * A.2 — invoice browse/create list. Extracted verbatim from the former `InvoiceListPage` body so
 * the billing hub can render it as a tab without a route change; the page-level heading stays with
 * whichever screen hosts the panel.
 */
export function InvoiceListPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('treatmentPlanId') || '';
  const patientFromQuery = searchParams.get('patientId') || '';

  const [branchId, setBranchId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState(patientFromQuery);
  const [patientSearch, setPatientSearch] = useState('');

  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const effectiveBranch = !isGlobalScope ? user?.branch || '' : branchId || branches[0]?.id || '';

  const { data: patientsData, isFetching: patientsFetching } = usePatientList({
    search: patientSearch,
    limit: 10,
    page: 1,
  });
  const patients = patientsData?.items || [];

  const { data, isLoading } = useInvoices({
    branchId: effectiveBranch || undefined,
    paymentStatus: paymentStatus || undefined,
    search: search || undefined,
    patientId: patientId || undefined,
    limit: 50,
  });
  const invoices = data?.items || [];
  const create = useCreateInvoice();
  const fromPlan = useCreateInvoiceFromPlan();

  const startBlank = async () => {
    if (!effectiveBranch || !patientId) return;
    const res = await create.mutateAsync({
      patientId,
      branchId: effectiveBranch,
      items: [{ ...emptyItem(), description: t('billing.list.consultationFee', 'Consultation fee'), unitPrice: 500, itemType: 'CONSULTATION' }],
    });
    const id = res?.data?.invoice?.id;
    if (id) navigate(invoiceDetailPath(id));
  };

  const startFromPlan = async () => {
    if (!planId) return;
    const res = await fromPlan.mutateAsync(planId);
    const id = res?.data?.invoice?.id;
    if (id) navigate(invoiceDetailPath(id));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {isGlobalScope ? (
          <Select value={effectiveBranch} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('billing.list.branch', 'Branch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName || b.name}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={branches.find((b) => b.id === effectiveBranch)?.displayName || branches.find((b) => b.id === effectiveBranch)?.name || ''}
            disabled
            readOnly
          />
        )}
        <SearchableCombobox
          value={patientId}
          onChange={setPatientId}
          options={patients}
          search={patientSearch}
          onSearchChange={setPatientSearch}
          isLoading={patientsFetching}
          loadingText={t('common.searching', 'Searching…')}
          renderLabel={(p) => p.fullName || `${p.firstName} ${p.lastName}`}
          renderSublabel={(p) => p.mrn}
          placeholder={t('billing.list.patient', 'Patient')}
          emptyText={t('billing.list.noPatientMatch', 'No match')}
        />
        <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="">{t('billing.list.allPaymentStatus', 'All payment status')}</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input placeholder={t('billing.list.searchPlaceholder', 'Search INV-…')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <PermissionGuard permissions={[PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_ALL]}>
          <Button onClick={startBlank} disabled={!patientId || !effectiveBranch || create.isPending}>
            <Plus className="h-4 w-4" />
            {t('billing.list.newInvoice', 'New invoice')}
          </Button>
        </PermissionGuard>
      </div>

      {planId && (
        <PermissionGuard permissions={[PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_ALL]}>
          <Button variant="outline" onClick={startFromPlan} disabled={fromPlan.isPending}>
            {t('billing.list.createFromPlan', 'Create from treatment plan')}
          </Button>
        </PermissionGuard>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('billing.list.loading', 'Loading…')}</p>}
        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">
                  {inv.invoiceNumber} · {inv.patient?.fullName || t('billing.list.patient', 'Patient')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(inv.total)} · {t('billing.list.paid', 'Paid')} {formatMoney(inv.paidAmount)} · {t('billing.list.balance', 'Balance')}{' '}
                  {formatMoney(inv.balanceAmount)}
                </p>
              </div>
              <Badge variant={inv.status === 'FINALIZED' ? 'success' : 'warning'}>
                {INVOICE_STATUS_LABELS[inv.status] || inv.status}
              </Badge>
              {inv.outstanding && <Badge variant="destructive">{t('billing.list.outstanding', 'Outstanding')}</Badge>}
              <Badge variant="outline">{PAYMENT_STATUS_LABELS[inv.paymentStatus]}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={invoiceDetailPath(inv.id)}>{t('billing.list.open', 'Open')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={invoicePrintPath(inv.id)}>{t('billing.list.print', 'Print')}</Link>
              </Button>
            </div>
          </div>
        ))}
        {!invoices.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('billing.list.noInvoices', 'No invoices yet.')}</p>
        )}
      </div>
    </div>
  );
}

export default InvoiceListPanel;
