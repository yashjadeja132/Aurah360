import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useLoyaltySettings,
  usePatientBalance,
  usePatientLedger,
  usePatientTierProgress,
  useCreatePatientAdjustment,
} from '@/modules/loyalty/hooks/useLoyalty';
import { PERMISSIONS } from '@/constants/rbac';

const REASON_CATEGORY_OPTIONS = [
  { value: 'SERVICE_RECOVERY', label: 'Service recovery' },
  { value: 'CORRECTION', label: 'Correction' },
  { value: 'PROMOTION', label: 'Promotion' },
  { value: 'OTHER', label: 'Other' },
];

const ENTRY_TYPE_LABELS = {
  CREDIT: 'Earned',
  DEBIT_REDEEM: 'Redeemed',
  DEBIT_EXPIRY: 'Expired',
  DEBIT_CLAWBACK: 'Clawed back',
  CREDIT_REVERSAL: 'Reversal credit',
  MANUAL_CREDIT: 'Manual credit',
  MANUAL_DEBIT: 'Manual debit',
};

const CREDIT_ENTRY_TYPES = new Set(['CREDIT', 'CREDIT_REVERSAL', 'MANUAL_CREDIT']);

export function PatientLoyaltyPanel({ patientId }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const { data: settings } = useLoyaltySettings();
  const { data: balance, isLoading: balanceLoading } = usePatientBalance(patientId);
  const { data: ledger, isLoading: ledgerLoading } = usePatientLedger(patientId, { page, limit: 10 });
  const tiersEnabled = Boolean(settings?.tiersEnabled);
  const { data: tierProgress } = usePatientTierProgress(tiersEnabled ? patientId : null);

  if (balanceLoading) return <Skeleton className="h-64 w-full" />;

  const entries = ledger?.items || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('loyalty.currentBalance', 'Current balance')}
          value={balance?.currentBalance ?? 0}
        />
        <StatCard
          label={t('loyalty.redeemableBalance', 'Redeemable balance')}
          value={balance?.redeemableBalance ?? 0}
        />
        <StatCard
          label={t('loyalty.lifetimeEarned', 'Lifetime earned')}
          value={balance?.lifetimeEarned ?? 0}
        />
        <StatCard
          label={t('loyalty.lifetimeRedeemed', 'Lifetime redeemed')}
          value={balance?.lifetimeRedeemed ?? 0}
          secondary={t('loyalty.lifetimeExpiredValue', '{{count}} expired', {
            count: balance?.lifetimeExpired ?? 0,
          })}
        />
      </div>

      {balance?.nextExpiringLotPoints > 0 && balance?.nextExpiringLotDate && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          {t(
            'loyalty.nextExpiringLot',
            '{{points}} points expire on {{date}}',
            {
              points: balance.nextExpiringLotPoints,
              date: new Date(balance.nextExpiringLotDate).toLocaleDateString(),
            }
          )}
        </div>
      )}

      {tiersEnabled && tierProgress && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('loyalty.tierStatus', 'Tier status')}</CardTitle>
            <Badge variant="info">{tierProgress.currentTier?.name || t('loyalty.noTier', 'No tier')}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {tierProgress.nextTier ? (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {t('loyalty.progressToward', 'Progress toward {{tier}}', {
                      tier: tierProgress.nextTier.name,
                    })}
                  </span>
                  <span>
                    {tierProgress.progressValue ?? 0} / {tierProgress.nextTier.threshold}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        ((tierProgress.progressValue ?? 0) / (tierProgress.nextTier.threshold || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('loyalty.topTier', 'This patient has reached the highest tier.')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <PermissionGuard permissions={[PERMISSIONS.LOYALTY_ADJUST, PERMISSIONS.LOYALTY_ALL]}>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setAdjustOpen(true)}>
            {t('loyalty.manualAdjustment', 'Manual adjustment')}
          </Button>
        </div>
      </PermissionGuard>

      <Card>
        <CardHeader><CardTitle>{t('loyalty.statement', 'Points statement')}</CardTitle></CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !entries.length ? (
            <EmptyState
              title={t('loyalty.noLedgerEntries', 'No points activity yet')}
              description={t('loyalty.noLedgerEntriesDesc', 'Earning and redemption activity will appear here.')}
            />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {entries.map((entry) => {
                const isCredit = CREDIT_ENTRY_TYPES.has(entry.entryType);
                return (
                  <li key={entry.id} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ${
                        isCredit ? 'bg-success' : 'bg-destructive'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {t(`loyalty.entryType.${entry.entryType}`, ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType)}
                      </p>
                      <span className={`font-semibold ${isCredit ? 'text-success' : 'text-destructive'}`}>
                        {isCredit ? '+' : '-'}{entry.points}
                      </span>
                    </div>
                    {(entry.note || entry.ruleCode || entry.sourceRefType) && (
                      <p className="text-sm text-muted-foreground">
                        {entry.note || entry.ruleCode || entry.sourceRefType}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          <Pagination meta={ledger?.meta} onPageChange={setPage} />
        </CardContent>
      </Card>

      <ManualAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        patientId={patientId}
      />
    </div>
  );
}

function StatCard({ label, value, secondary }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-primary">{value}</p>
        {secondary && <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>}
      </CardContent>
    </Card>
  );
}

function ManualAdjustmentDialog({ open, onOpenChange, patientId }) {
  const { t } = useTranslation();
  const [direction, setDirection] = useState('CREDIT');
  const [points, setPoints] = useState('');
  const [reasonCategory, setReasonCategory] = useState('SERVICE_RECOVERY');
  const [note, setNote] = useState('');
  const createAdjustment = useCreatePatientAdjustment(patientId);

  const reset = () => {
    setDirection('CREDIT');
    setPoints('');
    setReasonCategory('SERVICE_RECOVERY');
    setNote('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    await createAdjustment.mutateAsync({
      entryType: direction === 'CREDIT' ? 'MANUAL_CREDIT' : 'MANUAL_DEBIT',
      points: Number(points) || 0,
      reasonCategory,
      note: note.trim(),
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('loyalty.manualAdjustment', 'Manual adjustment')}</DialogTitle>
          <DialogDescription>
            {t('loyalty.manualAdjustmentDesc', 'Credit or debit points with a mandatory reason and note.')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('loyalty.direction', 'Direction')}</Label>
            <Select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="CREDIT">{t('loyalty.credit', 'Credit (add points)')}</option>
              <option value="DEBIT">{t('loyalty.debit', 'Debit (remove points)')}</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('loyalty.points', 'Points')}</Label>
            <Input
              type="number"
              min={1}
              required
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('loyalty.reasonCategory', 'Reason category')}</Label>
            <Select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
              {REASON_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`loyalty.reasonCategoryOption.${o.value}`, o.label)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('loyalty.note', 'Note (required)')}</Label>
            <textarea
              required
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('loyalty.notePlaceholder', 'Explain why this adjustment is being made…')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={createAdjustment.isPending || !note.trim() || !points}>
              {createAdjustment.isPending ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PatientLoyaltyPanel;
