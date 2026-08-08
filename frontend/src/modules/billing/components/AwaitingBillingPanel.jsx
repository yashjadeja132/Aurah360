import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileText, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { formatMoney } from '@/modules/billing/constants';
import { invoiceDetailPath } from '@/constants/routes';

/**
 * A.1/A.2 — "finished treatment, awaiting billing": DRAFT invoices, i.e. bills raised for completed
 * work that nobody has finalized or collected yet. Each row links to the invoice record so the
 * cashier finishes the bill in one hop.
 */
export function AwaitingBillingPanel({ items = [], total = 0, isLoading = false }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="h-4 w-4 text-primary" />
          {t('billing.cashier.awaitingBilling', 'Awaiting billing')}{' '}
          <Badge variant={total ? 'warning' : 'secondary'}>{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={FileText}
            title={t('billing.cashier.awaitingBillingEmptyTitle', 'No bill is waiting')}
            description={t(
              'billing.cashier.awaitingBillingEmpty',
              'Every raised bill has been finalized. Nothing to close out right now.'
            )}
          />
        )}

        {!isLoading && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.cashier.invoice', 'Invoice')}</TableHead>
                <TableHead>{t('billing.cashier.patient', 'Patient')}</TableHead>
                <TableHead>{t('billing.cashier.amount', 'Amount')}</TableHead>
                <TableHead>{t('billing.cashier.raised', 'Raised')}</TableHead>
                <TableHead>{t('billing.cashier.action', 'Action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <p className="text-xs text-muted-foreground">{inv.branch?.name || '—'}</p>
                  </TableCell>
                  <TableCell>
                    {inv.patient?.fullName || '—'}
                    <p className="text-xs text-muted-foreground">{inv.patient?.mobile || ''}</p>
                  </TableCell>
                  <TableCell className="font-semibold">{formatMoney(inv.total)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm">
                      <Link to={invoiceDetailPath(inv.id)}>
                        {t('billing.cashier.finishBill', 'Finish bill')}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default AwaitingBillingPanel;
