import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceListPanel } from '@/modules/billing/components/InvoiceListPanel';
import { DuePaymentsPanel } from '@/modules/billing/components/DuePaymentsPanel';
import { DiscountApprovalPanel } from '@/modules/billing/components/DiscountApprovalPanel';
import { CashClosePanel } from '@/modules/billing/components/CashClosePanel';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

/**
 * One billing screen instead of four sidebar destinations. Tabs are CLIENT-SIDE only (no route
 * change per tab) following the `PatientDetailPage` pattern: a TABS array with
 * permission-conditional entries, plus a guarded render so a hand-set tab id can never bypass the
 * permission check.
 *
 * Permission gates match the routes these panels came from exactly:
 *   invoices / dues → billing.view  (the route itself; the hub is mounted behind it)
 *   approvals       → billing.discount_approve
 *   cash close      → billing.cash_close
 * `billing.*` satisfies any of them, which `hasAnyPermission` handles.
 *
 * Invoice DETAIL deliberately stays its own route — it is a record, not a tab.
 */
export default function BillingHubPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const canApproveDiscounts = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_DISCOUNT_APPROVE,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canCashClose = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_CASH_CLOSE,
    PERMISSIONS.BILLING_ALL,
  ]);

  const TABS = [
    { id: 'invoices', label: t('billing.hub.tabs.invoices', 'Invoices') },
    { id: 'dues', label: t('billing.hub.tabs.dues', 'Dues') },
    ...(canApproveDiscounts
      ? [{ id: 'approvals', label: t('billing.hub.tabs.approvals', 'Approvals') }]
      : []),
    ...(canCashClose
      ? [{ id: 'cashClose', label: t('billing.hub.tabs.cashClose', 'Cash close') }]
      : []),
  ];

  const [tab, setTab] = useState('invoices');

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('billing.hub.title', 'Billing')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'billing.hub.subtitle',
            'Invoices, due collection, discount approvals and the daily cash close — all on one screen.'
          )}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && <InvoiceListPanel />}
      {tab === 'dues' && <DuePaymentsPanel />}
      {tab === 'approvals' && canApproveDiscounts && <DiscountApprovalPanel />}
      {tab === 'cashClose' && canCashClose && <CashClosePanel />}
    </section>
  );
}
