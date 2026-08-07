import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  usePurchaseOrders,
  useSuppliers,
  useInventoryItems,
  useCreatePo,
} from '@/modules/inventory/hooks/useInventory';
import { inventoryApi } from '@/modules/inventory/api/inventoryApi';
import { toast } from 'sonner';

export default function PurchaseOrdersPage() {
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
        items: [
          {
            inventoryItemId: line.inventoryItemId,
            name: line.name,
            batchNumber: `UI-${Date.now()}`,
            expiryDate: future.toISOString(),
            quantity: line.quantityOrdered || 10,
            unitCost: line.unitCost,
            mrp: line.mrp,
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
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('inventory.po.title', 'Purchase Orders')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inventory.po.subtitle', 'PO → Goods receipt → batch/expiry → stock via inventory engine.')}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">{t('inventory.po.supplier', 'Supplier')}</option>
          {supplierList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">{t('inventory.po.item', 'Item')}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Button onClick={createPo} disabled={create.isPending || !supplierId || !itemId}>
          {t('inventory.po.createPo', 'Create PO')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('inventory.po.loading', 'Loading…')}</p>}
        {pos.map((po) => (
          <div
            key={po.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {po.poNumber} · {po.supplier?.name || po.supplierId}
              </p>
              <p className="text-xs text-muted-foreground">{po.items?.length || 0} {t('inventory.po.lines', 'lines')}</p>
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
      </div>
    </section>
  );
}
