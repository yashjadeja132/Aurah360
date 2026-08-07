import { Sparkles, Power } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useAiGovernanceSummary, useAiFeatureFlags, useSetAiFeatureFlag, useAiRuns } from '@/modules/ai/hooks/useAiGovernance';
import { PERMISSIONS } from '@/constants/rbac';

/** AIG-001, §16.11 — AI governance: acceptance/edit/reject rate, cost, and per-use-case kill switch. */
export default function AiGovernancePage() {
  const { t } = useTranslation();
  const { data: summary } = useAiGovernanceSummary();
  const { data: flags = [] } = useAiFeatureFlags();
  const { data: runs = [] } = useAiRuns();
  const setFlag = useSetAiFeatureFlag();

  const USE_CASE_LABELS = {
    SUGGESTED_QUESTIONS: t('settings.aiGovernance.useCases.suggestedQuestions', 'Suggested questions'),
    RED_FLAG_ASSIST: t('settings.aiGovernance.useCases.redFlagAssist', 'Red-flag assist'),
    REPORT_SUMMARY: t('settings.aiGovernance.useCases.reportSummary', 'Report summary'),
    TIMELINE_SUMMARY: t('settings.aiGovernance.useCases.timelineSummary', 'Timeline summary'),
    DRAFT_NOTE: t('settings.aiGovernance.useCases.draftNote', 'Draft note'),
    PATIENT_INSTRUCTION_DRAFT: t('settings.aiGovernance.useCases.patientInstructionDraft', 'Patient instruction draft'),
    TREATMENT_CHECKLIST_ASSIST: t('settings.aiGovernance.useCases.treatmentChecklistAssist', 'Treatment checklist assist'),
    ANALYTICS_NARRATIVE: t('settings.aiGovernance.useCases.analyticsNarrative', 'Analytics narrative'),
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.aiGovernance.title', 'AI governance')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.aiGovernance.description', 'Every AI output is a labeled suggestion — doctors accept, edit or reject before anything is saved.')}
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{summary.totalRuns}</p><p className="text-sm text-muted-foreground">{t('settings.aiGovernance.stats.totalRuns', 'Total AI runs')}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{(summary.errorRate * 100).toFixed(1)}%</p><p className="text-sm text-muted-foreground">{t('settings.aiGovernance.stats.errorRate', 'Error rate')}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{summary.avgLatencyMs}ms</p><p className="text-sm text-muted-foreground">{t('settings.aiGovernance.stats.avgLatency', 'Avg latency')}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-2xl font-bold">${summary.estimatedCostUsd}</p><p className="text-sm text-muted-foreground">{t('settings.aiGovernance.stats.estCost', 'Est. cost')}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Power className="h-4 w-4" /> {t('settings.aiGovernance.killSwitches.title', 'Use-case kill switches')}</CardTitle>
          <CardDescription>{t('settings.aiGovernance.killSwitches.description', 'Disabling a use case falls back to the normal manual workflow immediately.')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t('settings.aiGovernance.table.useCase', 'Use case')}</TableHead><TableHead>{t('settings.aiGovernance.table.status', 'Status')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.useCase}>
                  <TableCell>{USE_CASE_LABELS[f.useCase] || f.useCase}</TableCell>
                  <TableCell><Badge variant={f.enabled ? 'success' : 'destructive'}>{f.enabled ? t('settings.aiGovernance.status.enabled', 'Enabled') : t('settings.aiGovernance.status.disabled', 'Disabled')}</Badge></TableCell>
                  <TableCell>
                    <PermissionGuard permissions={[PERMISSIONS.AI_GOVERNANCE_MANAGE]}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFlag.mutate({ useCase: f.useCase, payload: { enabled: !f.enabled, disabledReason: !f.enabled ? null : 'Disabled by admin' } })}
                      >
                        {f.enabled ? t('settings.aiGovernance.actions.disable', 'Disable') : t('settings.aiGovernance.actions.enable', 'Enable')}
                      </Button>
                    </PermissionGuard>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> {t('settings.aiGovernance.recentRuns.title', 'Recent runs')}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t('settings.aiGovernance.table.useCase', 'Use case')}</TableHead><TableHead>{t('settings.aiGovernance.table.status', 'Status')}</TableHead><TableHead>{t('settings.aiGovernance.table.disposition', 'Disposition')}</TableHead><TableHead>{t('settings.aiGovernance.table.when', 'When')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {runs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('settings.aiGovernance.recentRuns.empty', 'No AI runs yet.')}</TableCell></TableRow>}
              {runs.slice(0, 20).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{USE_CASE_LABELS[r.useCase] || r.useCase}</TableCell>
                  <TableCell><Badge variant={r.status === 'SUCCESS' ? 'success' : 'warning'}>{r.status}</Badge></TableCell>
                  <TableCell>{r.disposition}</TableCell>
                  <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
