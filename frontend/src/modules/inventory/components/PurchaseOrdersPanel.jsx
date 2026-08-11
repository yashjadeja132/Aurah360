import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  usePurchaseOrders,
  useSuppliers,
  useInventoryItems,
  useCreatePo,
} from '@/modules/inventory/hooks/useInventory';
import { inventoryApi } from '@/modules/inventory/api/inventoryApi';

/** Body of the former PurchaseOrdersPage: PO → goods receipt → batch/expiry → stock. */
export function PurchaseOrdersPanel() {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = usePurchaseOrders({ limit: 50 });
  const { data: suppliers } = useSuppliers({ limit: 20 });
  const { data: itemsData } = useInventoryItems({ limit: 20 });
  const create = useCreatePo();
  const pos = data?.items || [];
  const supplierList = suppliers?.items || [];
  const items = itemsData?.items || [];

  const [supplierId, setSupplierId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState(50);

  // GRN-GAP-4 — receive-quick GRN fields: manufacture date + bin are per-line/optional,
  // tax/landedCost/paymentReference are header-level. Kept as simple controlled inputs since
  // "receive quick" is a one-line GRN shortcut, not a full multi-line entry form.
  const [manufactureDate, setManufactureDate] = useState('');
  const [bin, setBin] = useState('');
  const [tax, setTax] = useState('');
  const [landedCost, setLandedCost] = useState('');
  const [paymentReference, setPaymentReference] = useState('');

  const createPo = async () => {
    const item = items.find((i) => i.id === itemId);
    if (!supplierId || !item) return;
    await create.mutateAsync({
      supplierId,
      branchId: item.branchId,
      items: [
        {
          inventoryItemId: item.id,
          name: item.name,
          quantityOrdered: Number(qty) || 50,
          unitCost: item.purchasePrice,
          mrp: item.mrp,
        },
      ],
    });
  };

  const receiveQuick = async (po) => {
    try {
      await inventoryApi.submitPo(po.id);
      const line = po.items?.[0];
      if (!line?.inventoryItemId) return;
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      const grn = await inventoryApi.createGrn({
        supplierId: po.supplierId,
        branchId: po.branchId,
        purchaseOrderId: po.id,
        tax: tax ? Number(tax) : undefined,
        landedCost: landedCost ? Number(landedCost) : undefined,
        paymentReference: paymentReference || undefined,
        items: [
          {
            inventoryItemId: line.inventoryItemId,
            name: line.name,
            batchNumber: `UI-${Date.now()}`,
            manufactureDate: manufactureDate || undefined,
            expiryDate: future.toISOString(),
            quantity: line.quantityOrdered || 10,
            unitCost: line.unitCost,
            mrp: line.mrp,
            bin: bin || undefined,
          },
        ],
      });
      await inventoryApi.postGrn(grn.data.grn.id);
      toast.success(t('inventory.po.goodsReceived', 'Goods received'));
      refetch();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('inventory.po.receiveFailed', 'Receive failed'));
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('inventory.po.subtitle', 'PO → Goods receipt → batch/expiry → stock via inventory engine.')}
      </p>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">{t('inventory.po.supplier', 'Supplier')}</option>
          {supplierList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">{t('inventory.po.item', 'Item')}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Button onClick={createPo} disabled={create.isPending || !supplierId || !itemId}>
          {t('inventory.po.createPo', 'Create PO')}
        </Button>
      </div>

      {/* GRN-GAP-4 — optional receive-quick GRN details, applied to the next "Receive" click below. */}
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-5">
        <Input
          type="date"
          placeholder={t('inventory.po.manufactureDate', 'Manufacture date')}
          value={manufactureDate}
          onChange={(e) => setManufactureDate(e.target.value)}
        />
        <Input
          placeholder={t('inventory.po.bin', 'Bin / location')}
          value={bin}
          onChange={(e) => setBin(e.target.value)}
        />
        <Input
          type="number"
          placeholder={t('inventory.po.tax', 'Tax')}
          value={tax}
          onChange={(e) => setTax(e.target.value)}
        />
        <Input
          type="number"
          placeholder={t('inventory.po.landedCost', 'Landed cost')}
          value={landedCost}
          onChange={(e) => setLandedCost(e.target.value)}
        />
        <Input
          placeholder={t('inventory.po.paymentReference', 'Payment reference')}
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {pos.map((po) => (
          <div
            key={po.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {po.poNumber} · {po.supplier?.name || po.supplierId}
              </p>
              <p className="text-xs text-muted-foreground">
                {po.items?.length || 0} {t('inventory.po.lines', 'lines')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{po.status}</Badge>
              {po.status !== 'RECEIVED' && (
                <Button size="sm" variant="outline" onClick={() => receiveQuick(po)}>
                  {t('inventory.po.receive', 'Receive')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!pos.length && !isLoading && (
          <EmptyState
            icon={ClipboardList}
            title={t('inventory.hub.po.empty', 'No purchase orders yet.')}
            description={t(
              'inventory.hub.po.emptyHint',
              'Pick a supplier and an item above to raise your first purchase order.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default PurchaseOrdersPanel;
