import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import {
  useLoyaltyRules,
  useCreateLoyaltyRule,
  useAddRuleVersion,
  useLoyaltyPreviewCalculation,
} from '@/modules/loyalty/hooks/useLoyalty';

const EARNING_EVENTS = [
  'VISIT_COMPLETED',
  'SPEND_BASED',
  'TREATMENT_SESSION_COMPLETED',
  'PACKAGE_PURCHASE',
  'REFERRAL_REFERRER',
  'REFERRAL_REFEREE',
  'ON_TIME_FOLLOW_UP',
  'APP_REGISTRATION',
  'REVIEW_SUBMITTED',
  'BIRTHDAY_BONUS',
  'PROFILE_COMPLETION',
  'CAMPAIGN_MULTIPLIER',
  'MANUAL_GOODWILL',
  'CUSTOM',
];
const FORMULA_TYPES = ['FIXED', 'PER_AMOUNT', 'PERCENT_OF_AMOUNT'];
const ROUNDING_RULES = ['FLOOR', 'ROUND', 'CEILING'];
const ELIGIBILITY_OPTIONS = ['ALL_PATIENTS', 'NEW_PATIENTS_ONLY', 'SPECIFIC_TIER', 'MINIMUM_VISITS'];

const EMPTY_DRAFT = {
  ruleCode: '',
  eventType: 'SPEND_BASED',
  name: '',
  notes: '',
  formulaType: 'PER_AMOUNT',
  pointValue: 1,
  perAmountInr: 100,
  roundingRule: 'FLOOR',
  perEventCap: '',
  perDayCap: '',
  perMonthCap: '',
  lifetimeCap: '',
  eligibility: 'ALL_PATIENTS',
  minimumVisits: '',
  requiresMarketingConsent: false,
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

function PreviewWidget({ draft }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(1000);
  const preview = useLoyaltyPreviewCalculation(draft, amount);

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t('loyalty.rules.previewTitle', 'Live preview calculator (client-side estimate)')}
      </p>
      <div className="flex items-center gap-2">
        <Label htmlFor="preview-amount" className="text-xs">
          {t('loyalty.rules.previewAmount', 'Sample amount (₹)')}
        </Label>
        <Input
          id="preview-amount"
          type="number"
          className="h-8 w-32"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
        />
      </div>
      <p className="text-sm">
        {t('loyalty.rules.previewResult', 'Estimated points')}:{' '}
        <span className="font-semibold">{preview.cappedPoints}</span>
        {preview.capApplied && (
          <Badge variant="warning" className="ml-2">
            {t('loyalty.rules.capApplied', 'Cap applied')}
          </Badge>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          'loyalty.rules.previewDisclaimer',
          'Approximation only — eligibility, campaign multipliers and server-side rounding are not simulated here.'
        )}
      </p>
    </div>
  );
}

function RuleFormFields({ draft, setDraft }) {
  const { t } = useTranslation();
  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.formulaType', 'Formula type')}</Label>
          <Select value={draft.formulaType} onChange={(e) => set('formulaType', e.target.value)}>
            {FORMULA_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`loyalty.formulaType.${v}`, v)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.pointValue', 'Point value')}</Label>
          <Input
            type="number"
            value={draft.pointValue}
            onChange={(e) => set('pointValue', Number(e.target.value))}
          />
        </div>
        {draft.formulaType === 'PER_AMOUNT' && (
          <div className="space-y-1.5">
            <Label>{t('loyalty.rules.fields.perAmountInr', 'Per ₹ amount')}</Label>
            <Input
              type="number"
              value={draft.perAmountInr}
              onChange={(e) => set('perAmountInr', Number(e.target.value))}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.roundingRule', 'Rounding rule')}</Label>
          <Select value={draft.roundingRule} onChange={(e) => set('roundingRule', e.target.value)}>
            {ROUNDING_RULES.map((v) => (
              <option key={v} value={v}>
                {t(`loyalty.roundingRule.${v}`, v)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.perEventCap', 'Per-event cap')}</Label>
          <Input type="number" value={draft.perEventCap} onChange={(e) => set('perEventCap', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.perDayCap', 'Per-day cap')}</Label>
          <Input type="number" value={draft.perDayCap} onChange={(e) => set('perDayCap', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.perMonthCap', 'Per-month cap')}</Label>
          <Input type="number" value={draft.perMonthCap} onChange={(e) => set('perMonthCap', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.lifetimeCap', 'Lifetime cap')}</Label>
          <Input type="number" value={draft.lifetimeCap} onChange={(e) => set('lifetimeCap', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.eligibility', 'Eligibility')}</Label>
          <Select value={draft.eligibility} onChange={(e) => set('eligibility', e.target.value)}>
            {ELIGIBILITY_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {t(`loyalty.eligibility.${v}`, v)}
              </option>
            ))}
          </Select>
        </div>
        {draft.eligibility === 'MINIMUM_VISITS' && (
          <div className="space-y-1.5">
            <Label>{t('loyalty.rules.fields.minimumVisits', 'Minimum visits')}</Label>
            <Input
              type="number"
              value={draft.minimumVisits}
              onChange={(e) => set('minimumVisits', e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t('loyalty.rules.fields.effectiveFrom', 'Effective from')}</Label>
          <Input type="date" value={draft.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="requiresMarketingConsent"
          type="checkbox"
          checked={Boolean(draft.requiresMarketingConsent)}
          onChange={(e) => set('requiresMarketingConsent', e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="requiresMarketingConsent">
          {t('loyalty.rules.fields.requiresMarketingConsent', 'Requires marketing consent')}
        </Label>
      </div>

      <PreviewWidget draft={draft} />
    </div>
  );
}

export default function LoyaltyRulesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useLoyaltyRules();
  const createRule = useCreateLoyaltyRule();
  const addVersion = useAddRuleVersion();
  const [newOpen, setNewOpen] = useState(false);
  const [versionRuleId, setVersionRuleId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const rules = data?.items || [];

  const openNewRule = () => {
    setDraft(EMPTY_DRAFT);
    setNewOpen(true);
  };

  const openNewVersion = (rule) => {
    setVersionRuleId(rule.id);
    setDraft({ ...EMPTY_DRAFT, eventType: rule.eventType });
  };

  const submitNewRule = async (e) => {
    e.preventDefault();
    await createRule.mutateAsync({
      ruleCode: draft.ruleCode,
      eventType: draft.eventType,
      name: draft.name,
      notes: draft.notes,
      version: { ...draft },
    });
    setNewOpen(false);
  };

  const submitNewVersion = async (e) => {
    e.preventDefault();
    await addVersion.mutateAsync({ id: versionRuleId, ...draft });
    setVersionRuleId(null);
  };

  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-primary">
              {t('loyalty.rules.title', 'Earning rules')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('loyalty.rules.subtitle', 'Built-in and custom earning events, versioned and effective-dated')}
            </p>
          </div>
          <PermissionGuard permissions={[PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL]}>
            <Button onClick={openNewRule}>{t('loyalty.rules.newRule', 'New rule')}</Button>
          </PermissionGuard>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}

        <div className="space-y-2">
          {rules.map((rule) => {
            const active =
              rule.versions?.slice().sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))[0] ||
              null;
            return (
              <div key={rule.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {rule.name} <span className="text-xs text-muted-foreground">({rule.ruleCode})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`loyalty.earningEvent.${rule.eventType}`, rule.eventType)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
                    </Badge>
                    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL]}>
                      <Button size="sm" variant="outline" onClick={() => openNewVersion(rule)}>
                        {t('loyalty.rules.addVersion', 'Add version')}
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>
                {active && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('loyalty.rules.activeVersionSummary', 'Active version')}:{' '}
                    {t(`loyalty.formulaType.${active.formulaType}`, active.formulaType)} · {active.pointValue}
                    {active.formulaType === 'PER_AMOUNT' ? ` / ₹${active.perAmountInr}` : ''}
                    {' · '}
                    {t(`loyalty.roundingRule.${active.roundingRule}`, active.roundingRule)}
                  </p>
                )}
              </div>
            );
          })}
          {!rules.length && !isLoading && (
            <p className="text-sm text-muted-foreground">{t('loyalty.rules.empty', 'No rules yet.')}</p>
          )}
        </div>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('loyalty.rules.newRuleTitle', 'New earning rule')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitNewRule} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('loyalty.rules.fields.ruleCode', 'Rule code')}</Label>
                  <Input
                    value={draft.ruleCode}
                    onChange={(e) => setDraft((p) => ({ ...p, ruleCode: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.rules.fields.name', 'Name')}</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.rules.fields.eventType', 'Earning event')}</Label>
                  <Select
                    value={draft.eventType}
                    onChange={(e) => setDraft((p) => ({ ...p, eventType: e.target.value }))}
                  >
                    {EARNING_EVENTS.map((v) => (
                      <option key={v} value={v}>
                        {t(`loyalty.earningEvent.${v}`, v)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <RuleFormFields draft={draft} setDraft={setDraft} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={createRule.isPending}>
                  {t('common.save', 'Save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(versionRuleId)} onOpenChange={(v) => !v && setVersionRuleId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('loyalty.rules.newVersionTitle', 'Add rule version')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitNewVersion} className="space-y-4">
              <RuleFormFields draft={draft} setDraft={setDraft} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setVersionRuleId(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={addVersion.isPending}>
                  {t('common.save', 'Save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </PermissionGuard>
  );
}
