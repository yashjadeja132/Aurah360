import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { InventoryOverviewPanel } from '@/modules/inventory/components/InventoryOverviewPanel';
import { StockLedgerPanel } from '@/modules/inventory/components/StockLedgerPanel';
import { InventoryExpiryPanel } from '@/modules/inventory/components/InventoryExpiryPanel';
import { InventoryTransfersPanel } from '@/modules/inventory/components/InventoryTransfersPanel';
import { PurchaseOrdersPanel } from '@/modules/inventory/components/PurchaseOrdersPanel';
import { SuppliersPanel } from '@/modules/inventory/components/SuppliersPanel';

/**
 * Gates carried over verbatim from the five routes these panels used to live
 * behind. All of INVENTORY, INVENTORY_LEDGER, PURCHASE_ORDERS, SUPPLIERS and
 * INVENTORY_TRANSFERS were wrapped in the same `InventoryPermission`
 * (inventory.view / inventory.*), so every tab shares that gate.
 *
 * PO_PERMS additionally accepts the purchase.* family because
 * `GET /inventory/purchase-orders` and `GET /inventory/suppliers` are declared
 * `requirePermission(...view, ...purchase)` — a purchasing-only user can read
 * those lists. That is a widening of who sees the TAB, never a narrowing: the
 * hub itself is still gated on the union below, so nothing that was reachable
 * before is unreachable now.
 */
const CORE_PERMS = [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL];
const PO_PERMS = [
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_ALL,
  PERMISSIONS.PURCHASE_VIEW,
  PERMISSIONS.PURCHASE_CREATE,
  PERMISSIONS.PURCHASE_ALL,
];

/** Union of every tab gate — what it takes to see the hub at all. */
export const INVENTORY_HUB_PERMISSIONS = [...new Set([...CORE_PERMS, ...PO_PERMS])];

/**
 * Single Inventory screen. Replaces the five sibling routes
 * (InventoryDashboardPage, StockLedgerPage, InventoryTransfersPage,
 * PurchaseOrdersPage, SuppliersPage) that each had to be reached from the
 * sidebar with no shared shell, and adds the Expiry tab that never existed.
 * Tab lives in `?tab=` so a tab is deep-linkable and back/forward works.
 */
export default function InventoryHubPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = user?.permissions;

  const canViewCore = hasAnyPermission(perms, CORE_PERMS);
  const canViewPurchasing = hasAnyPermission(perms, PO_PERMS);

  const TABS = useMemo(
    () => [
      ...(canViewCore
        ? [
            { id: 'overview', label: t('inventory.hub.tabs.overview', 'Overview') },
            { id: 'ledger', label: t('inventory.hub.tabs.ledger', 'Stock ledger') },
            { id: 'expiry', label: t('inventory.hub.tabs.expiry', 'Expiry') },
            { id: 'transfers', label: t('inventory.hub.tabs.transfers', 'Transfers') },
          ]
        : []),
      ...(canViewPurchasing
        ? [
            { id: 'purchase-orders', label: t('inventory.hub.tabs.purchaseOrders', 'Purchase orders') },
            { id: 'suppliers', label: t('inventory.hub.tabs.suppliers', 'Suppliers') },
          ]
        : []),
    ],
    [t, canViewCore, canViewPurchasing]
  );

  const requested = searchParams.get('tab');
  const tab = TABS.some((tb) => tb.id === requested) ? requested : TABS[0]?.id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const tabIds = TABS.map((tb) => tb.id);

  return (
    <PermissionGuard permissions={INVENTORY_HUB_PERMISSIONS} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('inventory.dashboard.title', 'Inventory')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'inventory.hub.subtitle',
              'Stock, expiry, branch transfers, purchase orders and suppliers in one place'
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

        {tab === 'overview' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <InventoryOverviewPanel onNavigateTab={setTab} availableTabs={tabIds} />
          </PermissionGuard>
        )}
        {tab === 'ledger' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <StockLedgerPanel initialItemId={searchParams.get('itemId') || ''} />
          </PermissionGuard>
        )}
        {tab === 'expiry' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <InventoryExpiryPanel />
          </PermissionGuard>
        )}
        {tab === 'transfers' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <InventoryTransfersPanel />
          </PermissionGuard>
        )}
        {tab === 'purchase-orders' && (
          <PermissionGuard permissions={PO_PERMS}>
            <PurchaseOrdersPanel />
          </PermissionGuard>
        )}
        {tab === 'suppliers' && (
          <PermissionGuard permissions={PO_PERMS}>
            <SuppliersPanel />
          </PermissionGuard>
        )}
      </section>
    </PermissionGuard>
  );
}
