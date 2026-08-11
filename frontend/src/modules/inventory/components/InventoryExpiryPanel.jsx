import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useInventoryExpiryReport,
  useAdjustStock,
  useMarkDamaged,
  useReturnToVendor,
} from '@/modules/inventory/hooks/useInventory';
import { inventoryApi } from '@/modules/inventory/api/inventoryApi';
import { PERMISSIONS } from '@/constants/rbac';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * NEW TAB — there was no expiry screen anywhere in the app; near-expiry only
 * showed up as an inline advisory line on the dispense screen. The data has
 * existed on the backend all along: `GET /inventory/reports/expiry` walks every
 * batch and returns EXPIRED + NEAR_EXPIRY rows with quantities (near-expiry
 * window = InventoryService NEAR_EXPIRY_DAYS).
 *
 * Write-off uses the existing `POST /inventory/adjust` endpoint with a negative
 * quantity: InventoryService deliberately exempts ADJUSTMENT from its
 * "cannot use expired batch" block, which is precisely the write-off path. It is
 * gated on the same permissions that endpoint requires (inventory.adjust /
 * stock.adjust / inventory.*), so read-only viewers never see the button.
 */
const STATUS_META = {
  EXPIRED: { variant: 'destructive', labelKey: 'inventory.expiry.expired', labelDefault: 'Expired' },
  NEAR_EXPIRY: { variant: 'warning', labelKey: 'inventory.expiry.nearExpiry', labelDefault: 'Near expiry' },
};

export function InventoryExpiryPanel() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const { data: rows = [], isLoading, isError } = useInventoryExpiryReport();
  const adjust = useAdjustStock();
  const markDamaged = useMarkDamaged();
  const returnToVendor = useReturnToVendor();

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await inventoryApi.exportReport('expiry');
      downloadBlob(blob, filename);
    } catch (err) {
      toast.error(err.message || t('inventory.expiry.exportFailed', 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const totals = useMemo(() => {
    const acc = {
      expiredBatches: 0,
      expiredQuantity: 0,
      nearBatches: 0,
      nearQuantity: 0,
    };
    for (const row of rows) {
      if (row.status === 'EXPIRED') {
        acc.expiredBatches += 1;
        acc.expiredQuantity += Number(row.quantity) || 0;
      } else {
        acc.nearBatches += 1;
        acc.nearQuantity += Number(row.quantity) || 0;
      }
    }
    return acc;
  }, [rows]);

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  const writeOff = (row) => {
    const message = t(
      'inventory.expiry.writeOffConfirm',
      'Write off {{quantity}} unit(s) of batch {{batch}}? This posts a negative stock adjustment.',
      { quantity: row.quantity, batch: row.batchNumber }
    );
    if (!window.confirm(message)) return;
    adjust.mutate({
      inventoryItemId: row.inventoryItemId,
      quantity: -Math.abs(Number(row.quantity) || 0),
      batchNumber: row.batchNumber,
      reason: 'Expiry write-off',
    });
  };

  const markDamage = (row) => {
    const message = t(
      'inventory.expiry.markDamagedConfirm',
      'Mark {{quantity}} unit(s) of batch {{batch}} as damaged? This blocks the remainder from dispensing.',
      { quantity: row.quantity, batch: row.batchNumber }
    );
    if (!window.confirm(message)) return;
    markDamaged.mutate({
      inventoryItemId: row.inventoryItemId,
      batchNumber: row.batchNumber,
      quantity: Math.abs(Number(row.quantity) || 0),
      reason: 'Damaged (expiry screen)',
    });
  };

  const returnVendor = (row) => {
    const supplierId = window.prompt(
      t('inventory.expiry.returnToVendorPrompt', 'Supplier ID to return batch {{batch}} to?', {
        batch: row.batchNumber,
      })
    );
    if (!supplierId) return;
    returnToVendor.mutate({
      inventoryItemId: row.inventoryItemId,
      batchNumber: row.batchNumber,
      supplierId,
      quantity: Math.abs(Number(row.quantity) || 0),
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {t('inventory.expiry.loadFailed', 'Could not load the expiry report.')}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'inventory.expiry.subtitle',
          'Expired and near-expiry batches across stock, earliest expiry first.'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t('inventory.expiry.expiredBatches', 'Expired batches'), totals.expiredBatches],
          [t('inventory.expiry.expiredQuantity', 'Expired quantity'), totals.expiredQuantity],
          [t('inventory.expiry.nearExpiryBatches', 'Near-expiry batches'), totals.nearBatches],
          [t('inventory.expiry.nearExpiryQuantity', 'Near-expiry quantity'), totals.nearQuantity],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t('inventory.expiry.batches', 'Batches')}</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              className="sm:w-56"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('inventory.expiry.allStatuses', 'Expired & near expiry')}</option>
              <option value="EXPIRED">{t('inventory.expiry.expired', 'Expired')}</option>
              <option value="NEAR_EXPIRY">{t('inventory.expiry.nearExpiry', 'Near expiry')}</option>
            </Select>
            <PermissionGuard
              permissions={[PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.INVENTORY_ALL]}
            >
              <Button size="sm" variant="outline" disabled={exporting} onClick={handleExport}>
                {exporting
                  ? t('inventory.expiry.exporting', 'Exporting…')
                  : t('inventory.expiry.export', 'Export')}
              </Button>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent>
          {!visible.length ? (
            <EmptyState
              icon={CalendarX}
              title={t('inventory.expiry.empty', 'Nothing expiring.')}
              description={t(
                'inventory.expiry.emptyHint',
                'No batch in stock is expired or inside the near-expiry window.'
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.expiry.item', 'Item')}</TableHead>
                  <TableHead>{t('inventory.expiry.batch', 'Batch')}</TableHead>
                  <TableHead>{t('inventory.expiry.expiryDate', 'Expires')}</TableHead>
                  <TableHead>{t('inventory.expiry.quantity', 'Quantity')}</TableHead>
                  <TableHead>{t('inventory.expiry.status', 'Status')}</TableHead>
                  <TableHead>{t('inventory.expiry.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
                  const meta = STATUS_META[row.status] || STATUS_META.NEAR_EXPIRY;
                  return (
                    <TableRow key={`${row.inventoryItemId}-${row.batchNumber}`}>
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.itemCode}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.batchNumber || '—'}</TableCell>
                      <TableCell>
                        {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="font-semibold">{row.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{t(meta.labelKey, meta.labelDefault)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <PermissionGuard
                            permissions={[
                              PERMISSIONS.INVENTORY_ADJUST,
                              PERMISSIONS.STOCK_ADJUST,
                              PERMISSIONS.INVENTORY_ALL,
                            ]}
                          >
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={adjust.isPending}
                              onClick={() => writeOff(row)}
                            >
                              {t('inventory.expiry.writeOff', 'Write off')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markDamaged.isPending}
                              onClick={() => markDamage(row)}
                            >
                              {t('inventory.expiry.markDamaged', 'Mark damage')}
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard
                            permissions={[
                              PERMISSIONS.INVENTORY_ADJUST,
                              PERMISSIONS.STOCK_ADJUST,
                              PERMISSIONS.INVENTORY_ALL,
                              PERMISSIONS.PURCHASE_ALL,
                            ]}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={returnToVendor.isPending}
                              onClick={() => returnVendor(row)}
                            >
                              {t('inventory.expiry.returnToVendor', 'Return to vendor')}
                            </Button>
                          </PermissionGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InventoryExpiryPanel;
