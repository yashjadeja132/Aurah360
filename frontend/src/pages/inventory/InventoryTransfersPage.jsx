import { useTranslation } from 'react-i18next';
import { InventoryTransfersPanel } from '@/modules/inventory/components/InventoryTransfersPanel';

/**
 * INV-002 — thin wrapper. The body lives in `InventoryTransfersPanel` and is shared with the
 * Inventory hub's Transfers tab; every PermissionGuard this page used to carry
 * (INVENTORY_TRANSFER_REQUEST / _APPROVE / _RECEIVE, each with INVENTORY_ALL) lives inside the
 * panel unchanged.
 */
export default function InventoryTransfersPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('inventory.transfers.title', 'Branch stock transfers')}
      </h1>
      <InventoryTransfersPanel />
    </section>
  );
}
