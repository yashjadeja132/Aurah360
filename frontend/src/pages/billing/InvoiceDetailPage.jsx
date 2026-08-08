import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, Printer, Mail, MessageCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PaymentDialog } from '@/modules/billing/components/PaymentDialog';
import { RefundDialog } from '@/modules/billing/components/RefundDialog';
import { LoyaltyRedemptionPanel } from '@/modules/billing/components/LoyaltyRedemptionPanel';
import {
  useInvoice,
  useUpdateInvoice,
  useFinalizeInvoice,
  useVoidInvoice,
  useRecordPayment,
  useRefundPayment,
} from '@/modules/billing/hooks/useBilling';
import { billingApi } from '@/modules/billing/api/billingApi';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ITEM_TYPE_OPTIONS,
  formatMoney,
  emptyItem,
} from '@/modules/billing/constants';
import { APP_ROUTES, invoicePrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { toast } from 'sonner';

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: invoice, isLoading, isError, error } = useInvoice(id);
  const update = useUpdateInvoice(id);
  const finalize = useFinalizeInvoice(id);
  const voidDraft = useVoidInvoice(id);
  const recordPayment = useRecordPayment(id);
  const refundPayment = useRefundPayment(id);

  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [discountType, setDiscountType] = useState('FLAT');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  // A.8 — which recorded payment the refund dialog is acting on (null = closed).
  const [refundTarget, setRefundTarget] = useState(null);

  useEffect(() => {
    if (!invoice) return;
    setItems(
      (invoice.items || []).map((it) => ({
        ...emptyItem(),
        ...it,
        referenceId: it.referenceId || '',
      }))
    );
    setNotes(invoice.notes || '');
    setDiscountType(invoice.discountType || 'FLAT');
    setDiscountValue(invoice.discountValue || 0);
    setDiscountReason(invoice.discountReason || '');
  }, [invoice?.id, invoice?.updatedAt]);

  const readOnly = invoice?.status !== 'DRAFT';

  // A.5 — mirror the server's manual-discount percentage (line discounts + header discount,
  // loyalty redemption excluded) so the cashier sees the gate coming before saving.
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const itemDiscounts = items.reduce((s, i) => s + (Number(i.discount) || 0), 0);
  const headerDiscount =
    discountType === 'PERCENTAGE'
      ? (subtotal * Math.min(Number(discountValue) || 0, 100)) / 100
      : Number(discountValue) || 0;
  const manualDiscount = itemDiscounts + headerDiscount;
  const thresholdPercent = invoice?.discountThresholdPercent ?? 0;
  const discountPercent = subtotal > 0 ? (manualDiscount / subtotal) * 100 : 0;
  const aboveThreshold = discountPercent > thresholdPercent;
  const reasonMissing = aboveThreshold && !discountReason.trim();
  const approvalStatus = invoice?.discountApprovalStatus;
  const finalizeBlocked = approvalStatus === 'PENDING_APPROVAL' || approvalStatus === 'REJECTED';
  // An above-threshold discount only clears once it has actually been approved — and an unsaved
  // edit that pushes it above the threshold counts as not-yet-approved too.
  const finalizeDisallowed =
    reasonMissing || finalizeBlocked || (aboveThreshold && approvalStatus !== 'APPROVED');

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t('billing.detail.loading', 'Loading…')}</p>;
  if (isError || !invoice) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('billing.detail.notFound', 'Invoice not found')}
      </p>
    );
  }

  const save = () =>
    update.mutateAsync({
      notes,
      discountType,
      discountValue: Number(discountValue) || 0,
      // Approval state is computed server-side from these numbers — only the reason travels.
      discountReason: discountReason.trim() || null,
      items: items.map((it) => ({
        ...it,
        referenceId: it.referenceId || null,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
      })),
    });

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={APP_ROUTES.BILLING}>
              <ArrowLeft className="h-4 w-4" />
              {t('billing.detail.back', 'Back')}
            </Link>
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {invoice.invoiceNumber}
            </h1>
            <Badge>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
            <Badge variant={invoice.outstanding ? 'destructive' : 'outline'}>
              {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
            </Badge>
            {invoice.outstanding && <Badge variant="destructive">{t('billing.detail.outstanding', 'Outstanding')}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.patient?.fullName} · {invoice.branch?.name} · {t('billing.detail.doctorPrefix', 'Dr.')} {invoice.doctor?.name || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={invoicePrintPath(id)}>
              <Printer className="h-4 w-4" />
              {t('billing.detail.print', 'Print')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await billingApi.emailPlaceholder(id);
              toast.success(t('billing.detail.emailPlaceholderMarked', 'Email placeholder marked'));
            }}
          >
            <Mail className="h-4 w-4" />
            {t('billing.detail.email', 'Email')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await billingApi.whatsappPlaceholder(id);
              toast.success(t('billing.detail.whatsappPlaceholderMarked', 'WhatsApp placeholder marked'));
            }}
          >
            <MessageCircle className="h-4 w-4" />
            {t('billing.detail.whatsapp', 'WhatsApp')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span>{t('billing.detail.paymentProgress', 'Payment progress')}</span>
          <span>{invoice.paymentProgress || 0}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${invoice.paymentProgress || 0}%` }}
          />
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p>
            {t('billing.detail.total', 'Total')}: <strong>{formatMoney(invoice.total)}</strong>
          </p>
          <p>
            {t('billing.detail.paid', 'Paid')}: <strong>{formatMoney(invoice.paidAmount)}</strong>
          </p>
          <p>
            {t('billing.detail.balance', 'Balance')}: <strong>{formatMoney(invoice.balanceAmount)}</strong>
          </p>
        </div>
      </div>

      {invoice.packageSnapshot && (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="font-medium">{t('billing.detail.packageSnapshot', 'Package (copied snapshot — plan not modified)')}</p>
          <p>
            {invoice.packageSnapshot.packageName} ·{' '}
            {formatMoney(invoice.packageSnapshot.packagePrice)} · {t('billing.detail.discount', 'discount')}{' '}
            {formatMoney(invoice.packageSnapshot.discount)} · {t('billing.detail.maxSessions', 'max sessions')}{' '}
            {invoice.packageSnapshot.maximumSessions}
          </p>
        </div>
      )}

      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('billing.detail.lineItems', 'Line items')}</h2>
        {items.map((item, index) => (
          <div key={item.id || index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6">
            <Select
              disabled={readOnly}
              value={item.itemType}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, itemType: e.target.value };
                setItems(next);
              }}
            >
              {ITEM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              className="sm:col-span-2"
              disabled={readOnly}
              placeholder={t('billing.detail.description', 'Description')}
              value={item.description}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, description: e.target.value };
                setItems(next);
              }}
            />
            <Input
              type="number"
              disabled={readOnly}
              value={item.quantity}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, quantity: e.target.value };
                setItems(next);
              }}
            />
            <Input
              type="number"
              disabled={readOnly}
              value={item.unitPrice}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, unitPrice: e.target.value };
                setItems(next);
              }}
            />
            <Input
              type="number"
              disabled={readOnly}
              placeholder={t('billing.detail.discAbbrev', 'Disc')}
              value={item.discount}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, discount: e.target.value };
                setItems(next);
              }}
            />
          </div>
        ))}
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setItems([...items, emptyItem()])}>
            {t('billing.detail.addItem', 'Add item')}
          </Button>
        )}
      </div>

      {!readOnly && (
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
          <div>
            <Label>{t('billing.detail.discountType', 'Discount type')}</Label>
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="FLAT">{t('billing.detail.flat', 'Flat')}</option>
              <option value="PERCENTAGE">{t('billing.detail.percentage', 'Percentage')}</option>
            </Select>
          </div>
          <div>
            <Label>{t('billing.detail.discountValue', 'Discount value')}</Label>
            <Input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div>
            <Label>{t('billing.detail.notes', 'Notes')}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {aboveThreshold && (
            <div className="sm:col-span-3">
              <Label>
                {t('billing.detail.discountReason', 'Discount reason')}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder={t('billing.detail.discountReasonPlaceholder', 'Required — why is this discount being given?')}
              />
              <p className="mt-1 text-xs font-medium text-warning">
                {t(
                  'billing.detail.discountAboveThreshold',
                  'This discount is {{percent}}% of the subtotal, above the {{threshold}}% threshold — it needs a reason and an approver sign-off before this invoice can be finalized.',
                  { percent: discountPercent.toFixed(1), threshold: thresholdPercent }
                )}
              </p>
              {reasonMissing && (
                <p className="mt-1 text-xs font-medium text-destructive">
                  {t('billing.detail.discountReasonRequired', 'A reason is required to save a discount above the threshold.')}
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground sm:col-span-3">
            {t('billing.detail.taxNote', 'Tax from branch settings (GST placeholder {{percent}}%).', { percent: invoice.taxPercent })}
          </p>
        </div>
      )}

      {finalizeBlocked && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            approvalStatus === 'REJECTED'
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-warning/40 bg-warning/10'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">
              {approvalStatus === 'REJECTED'
                ? t('billing.detail.discountRejectedTitle', 'Discount rejected — finalize is blocked')
                : t('billing.detail.discountPendingTitle', 'Awaiting discount approval — finalize is blocked')}
            </p>
            <p>
              {approvalStatus === 'REJECTED'
                ? t(
                    'billing.detail.discountRejectedBody',
                    'An approver rejected this discount. Reduce it to {{threshold}}% of the subtotal or below, then save — that clears the gate.',
                    { threshold: thresholdPercent }
                  )
                : t(
                    'billing.detail.discountPendingBody',
                    'This discount is above the {{threshold}}% threshold. Someone with discount-approval rights must approve it before this invoice can be finalized.',
                    { threshold: thresholdPercent }
                  )}
            </p>
            {invoice.discountReason && (
              <p className="text-xs">
                {t('billing.detail.discountReasonGiven', 'Reason given')}: {invoice.discountReason}
              </p>
            )}
            {invoice.discountDecisionNote && (
              <p className="text-xs">
                {t('billing.detail.discountDecisionNote', 'Approver note')}: {invoice.discountDecisionNote}
              </p>
            )}
            <PermissionGuard permissions={[PERMISSIONS.BILLING_DISCOUNT_APPROVE, PERMISSIONS.BILLING_ALL]}>
              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link to={APP_ROUTES.BILLING_DISCOUNT_APPROVALS}>
                  {t('billing.detail.goToApprovals', 'Open discount approvals')}
                </Link>
              </Button>
            </PermissionGuard>
          </div>
        </div>
      )}

      {!readOnly && (
        <LoyaltyRedemptionPanel invoiceId={id} patientId={invoice.patientId} invoice={invoice} />
      )}

      <div className="flex flex-wrap gap-2">
        {!readOnly && (
          <>
            <PermissionGuard permissions={[PERMISSIONS.BILLING_EDIT, PERMISSIONS.BILLING_ALL]}>
              <Button variant="outline" disabled={update.isPending || reasonMissing} onClick={() => save()}>
                {t('billing.detail.saveDraft', 'Save draft')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permissions={[PERMISSIONS.BILLING_FINALIZE, PERMISSIONS.BILLING_ALL]}>
              <Button
                // A.5 — the server is the real gate; disabling here just avoids a pointless
                // round-trip and makes the block visible rather than a surprise error toast.
                disabled={finalize.isPending || finalizeDisallowed}
                title={
                  finalizeDisallowed
                    ? t('billing.detail.finalizeBlockedHint', 'Discount approval is required before finalizing.')
                    : undefined
                }
                onClick={async () => {
                  await save();
                  finalize.mutate();
                }}
              >
                <Check className="h-4 w-4" />
                {t('billing.detail.finalize', 'Finalize')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permissions={[PERMISSIONS.BILLING_EDIT, PERMISSIONS.BILLING_ALL]}>
              <Button
                variant="ghost"
                disabled={voidDraft.isPending}
                onClick={() => {
                  const reason = window.prompt(t('billing.detail.voidReasonPrompt', 'Reason for voiding this draft (required):'));
                  if (!reason?.trim()) return;
                  voidDraft.mutate(reason.trim());
                }}
              >
                {t('billing.detail.voidDraft', 'Void draft')}
              </Button>
            </PermissionGuard>
          </>
        )}
        {invoice.status === 'FINALIZED' && invoice.balanceAmount > 0 && (
          <PermissionGuard permissions={[PERMISSIONS.BILLING_PAYMENT, PERMISSIONS.BILLING_ALL]}>
            <Button onClick={() => setPayOpen(true)}>{t('billing.detail.recordPayment', 'Record payment')}</Button>
          </PermissionGuard>
        )}
      </div>

      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{t('billing.detail.paymentHistory', 'Payment history')}</h2>
        {(invoice.payments || []).map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed py-2 text-sm"
          >
            <span>
              {p.paymentNumber} · {p.method}
              {p.isPartial ? ` (${t('billing.detail.partial', 'partial')})` : ''}
              {p.isAdvance ? ` (${t('billing.detail.advance', 'advance')})` : ''}
              {p.status === 'REFUNDED' && (
                <Badge variant="destructive" className="ml-2">
                  {t('billing.detail.refunded', 'Refunded')}
                </Badge>
              )}
              {p.status === 'REFUNDED' && p.refundReason && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatMoney(p.refundedAmount)} · {p.refundMethod} · {p.refundReason}
                  {p.refundNotes ? ` — ${p.refundNotes}` : ''}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{formatMoney(p.amount)}</span>
              {/* A.8 — refunds are an elevated action; only a RECORDED payment can be refunded. */}
              {p.status === 'RECORDED' && (
                <PermissionGuard permissions={[PERMISSIONS.BILLING_REFUND, PERMISSIONS.BILLING_ALL]}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRefundTarget(p)}
                    disabled={refundPayment.isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('billing.detail.refund', 'Refund')}
                  </Button>
                </PermissionGuard>
              )}
            </span>
          </div>
        ))}
        {!invoice.payments?.length && (
          <p className="text-sm text-muted-foreground">{t('billing.detail.noPayments', 'No payments yet.')}</p>
        )}
      </div>

      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{t('billing.detail.invoiceTimeline', 'Invoice timeline')}</h2>
        {(invoice.timeline || [])
          .slice()
          .reverse()
          .map((t, i) => (
            <div key={i} className="text-sm text-muted-foreground">
              {t.at ? new Date(t.at).toLocaleString() : '—'} — <strong>{t.action}</strong>
              {t.note ? `: ${t.note}` : ''}
            </div>
          ))}
      </div>

      <PaymentDialog
        open={payOpen}
        balance={invoice.balanceAmount}
        pending={recordPayment.isPending}
        onClose={() => setPayOpen(false)}
        onSubmit={(payload) => {
          recordPayment.mutate(payload, { onSuccess: () => setPayOpen(false) });
        }}
      />

      <RefundDialog
        open={Boolean(refundTarget)}
        payment={refundTarget}
        pending={refundPayment.isPending}
        onClose={() => setRefundTarget(null)}
        onSubmit={(payload) => {
          refundPayment.mutate(payload, { onSuccess: () => setRefundTarget(null) });
        }}
      />
    </section>
  );
}
