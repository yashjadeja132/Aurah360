import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Truck, PackageCheck, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import {
  useInventoryItems,
  useTransfers,
  useRequestTransfer,
  useApproveTransfer,
  useRejectTransfer,
  useDispatchTransfer,
  useReceiveTransfer,
} from '@/modules/inventory/hooks/useInventory';
import { PERMISSIONS } from '@/constants/rbac';

const STATUS_VARIANT = {
  REQUESTED: 'secondary',
  APPROVED: 'info',
  IN_TRANSIT: 'warning',
  RECEIVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
};

const emptyForm = { fromBranchId: '', toBranchId: '', fromItemId: '', quantityRequested: '' };

/** INV-002 — request → approve → dispatch → in transit → receive, both branches reconcile. */
export default function InventoryTransfersPage() {
  const { t } = useTranslation();
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [form, setForm] = useState(emptyForm);

  const { data: itemsData } = useInventoryItems({ branchId: form.fromBranchId || undefined, limit: 100 });
  const items = itemsData?.items || [];

  const { data: transfers = [], isLoading } = useTransfers();
  const requestTransfer = useRequestTransfer();
  const approve = useApproveTransfer();
  const reject = useRejectTransfer();
  const dispatch = useDispatchTransfer();
  const receive = useReceiveTransfer();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.fromBranchId || !form.toBranchId || !form.fromItemId || !form.quantityRequested) return;
    await requestTransfer.mutateAsync({ ...form, quantityRequested: Number(form.quantityRequested) });
    setForm(emptyForm);
  };

  const branchName = (id) => branches.find((b) => b.id === id)?.displayName || branches.find((b) => b.id === id)?.name || '—';

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('inventory.transfers.title', 'Branch stock transfers')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inventory.transfers.subtitle', 'Request → approve → dispatch → in transit → receive. Both branches reconcile on receipt.')}
        </p>
      </div>

      <PermissionGuard permissions={[PERMISSIONS.INVENTORY_TRANSFER_REQUEST, PERMISSIONS.INVENTORY_ALL]}>
        <Card>
          <CardHeader><CardTitle>{t('inventory.transfers.requestATransfer', 'Request a transfer')}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>{t('inventory.transfers.fromBranch', 'From branch')}</Label>
                <Select value={form.fromBranchId} onChange={(e) => setForm((f) => ({ ...f, fromBranchId: e.target.value, fromItemId: '' }))}>
                  <option value="">{t('inventory.transfers.select', 'Select')}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.displayName || b.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.transfers.toBranch', 'To branch')}</Label>
                <Select value={form.toBranchId} onChange={set('toBranchId')}>
                  <option value="">{t('inventory.transfers.select', 'Select')}</option>
                  {branches.filter((b) => b.id !== form.fromBranchId).map((b) => (
                    <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.transfers.item', 'Item')}</Label>
                <Select value={form.fromItemId} onChange={set('fromItemId')} disabled={!form.fromBranchId}>
                  <option value="">{t('inventory.transfers.selectItem', 'Select item')}</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('inventory.transfers.quantity', 'Quantity')}</Label>
                <Input type="number" value={form.quantityRequested} onChange={set('quantityRequested')} min="0.01" step="0.01" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={requestTransfer.isPending}>
                  {t('inventory.transfers.requestTransfer', 'Request transfer')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardHeader><CardTitle>{t('inventory.transfers.transfers', 'Transfers')}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.transfers.transferNumber', 'Transfer #')}</TableHead>
                <TableHead>{t('inventory.transfers.route', 'Route')}</TableHead>
                <TableHead>{t('inventory.transfers.qtyRequested', 'Qty requested')}</TableHead>
                <TableHead>{t('inventory.transfers.status', 'Status')}</TableHead>
                <TableHead>{t('inventory.transfers.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && transfers.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('inventory.transfers.noTransfers', 'No transfers yet.')}</TableCell></TableRow>
              )}
              {transfers.map((t2) => (
                <TableRow key={t2.id}>
                  <TableCell className="font-medium">{t2.transferNumber}</TableCell>
                  <TableCell className="flex items-center gap-1 text-sm">
                    {branchName(t2.fromBranchId)} <ArrowRight className="h-3 w-3" /> {branchName(t2.toBranchId)}
                  </TableCell>
                  <TableCell>{t2.quantityRequested}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[t2.status] || 'secondary'}>{t2.status}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    {t2.status === 'REQUESTED' && (
                      <PermissionGuard permissions={[PERMISSIONS.INVENTORY_TRANSFER_APPROVE, PERMISSIONS.INVENTORY_ALL]}>
                        <Button size="sm" variant="outline" onClick={() => approve.mutate(t2.id)}>{t('inventory.transfers.approve', 'Approve')}</Button>
                        <Button size="sm" variant="destructive" onClick={() => reject.mutate({ id: t2.id, reason: 'Rejected by staff' })}>
                          <PackageX className="h-3.5 w-3.5" /> {t('inventory.transfers.reject', 'Reject')}
                        </Button>
                      </PermissionGuard>
                    )}
                    {t2.status === 'APPROVED' && (
                      <PermissionGuard permissions={[PERMISSIONS.INVENTORY_TRANSFER_APPROVE, PERMISSIONS.INVENTORY_ALL]}>
                        <Button
                          size="sm"
                          onClick={() => dispatch.mutate({ id: t2.id, payload: { quantityDispatched: t2.quantityRequested } })}
                        >
                          <Truck className="h-3.5 w-3.5" /> {t('inventory.transfers.dispatch', 'Dispatch')}
                        </Button>
                      </PermissionGuard>
                    )}
                    {t2.status === 'IN_TRANSIT' && (
                      <PermissionGuard permissions={[PERMISSIONS.INVENTORY_TRANSFER_RECEIVE, PERMISSIONS.INVENTORY_ALL]}>
                        <Button
                          size="sm"
                          onClick={() => receive.mutate({ id: t2.id, payload: { quantityReceived: t2.quantityDispatched } })}
                        >
                          <PackageCheck className="h-3.5 w-3.5" /> {t('inventory.transfers.receive', 'Receive')}
                        </Button>
                      </PermissionGuard>
                    )}
                    {t2.status === 'RECEIVED' && t2.varianceQuantity !== 0 && (
                      <span className="text-xs text-warning">{t('inventory.transfers.variance', 'Variance')}: {t2.varianceQuantity}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
