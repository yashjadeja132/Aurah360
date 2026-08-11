import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ShieldAlert,
  Stethoscope,
  ClipboardList,
  FlaskConical,
  Pill,
  RefreshCw,
  ImageOff,
  Image as ImageIcon,
  IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { consultationsApi } from '../api/consultationsApi';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { cn } from '@/utils/cn';

/** Map either the real precheck schema or a degraded/mock shape onto one fixed format. */
function normalise(output) {
  if (!output || typeof output !== 'object') return null;
  const likelihoodNum = (v) => {
    if (typeof v === 'number') return Math.max(1, Math.min(100, Math.round(v)));
    const map = { high: 80, medium: 50, low: 25 };
    return map[String(v).toLowerCase()] || 40;
  };
  return {
    summary: output.summary || '',
    conditions: (output.possible_conditions || []).map((c) => ({
      name: c.name || c.condition || '—',
      likelihood: likelihoodNum(c.likelihood),
      reasoning: c.reasoning || '',
    })),
    questions: output.questions_to_ask || output.follow_up_questions || [],
    reports: (output.suggested_reports || output.investigations || []).map((r) => ({
      test: r.test || r.name || String(r),
      reason: r.reason || '',
    })),
    medicines: (output.medicine_suggestions || []).map((m) => ({
      category: m.category || m.generic_name || '—',
      ingredients: m.active_ingredients || [m.composition].filter(Boolean),
      form: m.form || m.form_strength || '',
      caution: m.caution || m.cautions || '',
    })),
    redFlags: output.red_flags || [],
    basedOnPhotos: Boolean(output.based_on_photos),
    confidenceNote: output.confidence_note || '',
  };
}

function Tile({ icon: Icon, title, tone, children }) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-lg border p-2.5',
        tone === 'danger' ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto text-sm">{children}</div>
    </div>
  );
}

/**
 * The doctor's one-glance AI panel (simplified flow): the pre-check the AI prepared while
 * the patient was still in the waiting area — conditions, questions, reports, medicine
 * directions and the visit's payment state, in one fixed layout with no scrolling.
 */
export function AiPrecheckPanel({
  consultationId,
  aiPrecheck,
  billing = [],
  photosCount = 0,
  readOnly,
  onOpenCopilot,
}) {
  const qc = useQueryClient();
  const [requestedAt, setRequestedAt] = useState(null);
  const pollRef = useRef(null);

  const out = useMemo(() => normalise(aiPrecheck?.output), [aiPrecheck]);
  const isSuccess = aiPrecheck?.status === 'SUCCESS' && out;
  const waitingForRun =
    requestedAt && (!aiPrecheck || new Date(aiPrecheck.createdAt) < requestedAt);

  // Poll the workspace while a run is in flight (reception-triggered or doctor-triggered).
  useEffect(() => {
    const shouldPoll = waitingForRun || (!aiPrecheck && !readOnly);
    if (!shouldPoll) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return undefined;
    }
    pollRef.current = setInterval(() => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(consultationId) });
    }, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [waitingForRun, aiPrecheck, readOnly, consultationId, qc]);

  const rerun = async () => {
    try {
      await consultationsApi.runPrecheck(consultationId);
      setRequestedAt(new Date());
      toast.success('AI pre-check queued — the result appears here automatically');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not queue the AI pre-check');
    }
  };

  const paidTotal = billing
    .filter((b) => b.status !== 'VOID' && b.status !== 'CANCELLED')
    .reduce((s, b) => s + (b.paidAmount || 0), 0);
  const dueTotal = billing
    .filter((b) => b.status === 'FINALIZED')
    .reduce((s, b) => s + (b.balanceAmount || 0), 0);
  const methods = [...new Set(billing.flatMap((b) => (b.payments || []).map((p) => p.method)))];

  return (
    <div className="flex h-full flex-col rounded-xl border-2 border-primary/40 bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> AI pre-check
        </span>
        <Badge variant="outline" className="text-[10px]">AI suggestion — verify before use</Badge>
        <span className="ml-auto flex items-center gap-1.5">
          {paidTotal > 0 && (
            <Badge variant="success" title={methods.join(', ')}>
              <IndianRupee className="mr-0.5 h-3 w-3" />Paid {paidTotal}{methods.length ? ` · ${methods.join('/')}` : ''}
            </Badge>
          )}
          {dueTotal > 0 && <Badge variant="warning">Due ₹{dueTotal}</Badge>}
          {paidTotal === 0 && dueTotal === 0 && <Badge variant="secondary">No payment yet</Badge>}
          <Badge variant={photosCount ? 'info' : 'secondary'}>
            {photosCount ? (
              <><ImageIcon className="mr-0.5 h-3 w-3" />{photosCount} photo{photosCount > 1 ? 's' : ''}</>
            ) : (
              <><ImageOff className="mr-0.5 h-3 w-3" />No photos</>
            )}
          </Badge>
          <Button size="sm" variant="outline" onClick={rerun} disabled={Boolean(waitingForRun)}>
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', waitingForRun && 'animate-spin')} />
            {waitingForRun ? 'Analysing…' : isSuccess ? 'Re-run' : 'Analyse now'}
          </Button>
          {onOpenCopilot && (
            <Button size="sm" variant="ghost" onClick={onOpenCopilot}>
              Copilot →
            </Button>
          )}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 gap-2 p-2.5" style={{ gridTemplateRows: 'auto auto 1fr 1fr' }}>
        {out?.redFlags?.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/60 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{out.redFlags.join(' · ')}</span>
          </div>
        )}

        {isSuccess ? (
          <p className="px-1 text-sm font-medium">{out.summary}</p>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            {waitingForRun || (!aiPrecheck && photosCount + 1)
              ? 'The AI is analysing the intake (symptoms + photos)… this panel updates automatically.'
              : aiPrecheck?.status
                ? `Last analysis did not complete (${aiPrecheck.status}). Use "Analyse now" to retry.`
                : 'No intake analysis yet — press "Analyse now".'}
          </div>
        )}

        <div className="grid min-h-0 grid-cols-2 gap-2">
          <Tile icon={Stethoscope} title="Possible conditions">
            {(out?.conditions || []).map((c) => (
              <div key={c.name} className="mb-1.5" title={c.reasoning}>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.likelihood}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-1.5 rounded-full',
                      c.likelihood >= 65 ? 'bg-primary' : c.likelihood >= 40 ? 'bg-primary/70' : 'bg-primary/40'
                    )}
                    style={{ width: `${c.likelihood}%` }}
                  />
                </div>
              </div>
            ))}
            {!out?.conditions?.length && <p className="text-xs text-muted-foreground">—</p>}
          </Tile>

          <Tile icon={ClipboardList} title="Questions to ask">
            <ol className="list-decimal space-y-1 pl-4 text-[13px]">
              {(out?.questions || []).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            {!out?.questions?.length && <p className="text-xs text-muted-foreground">—</p>}
          </Tile>
        </div>

        <div className="grid min-h-0 grid-cols-2 gap-2">
          <Tile icon={FlaskConical} title="Suggested reports">
            {(out?.reports || []).map((r) => (
              <div key={r.test} className="mb-1.5 text-[13px]">
                <span className="font-medium">{r.test}</span>
                {r.reason && <span className="text-muted-foreground"> — {r.reason}</span>}
              </div>
            ))}
            {!out?.reports?.length && (
              <p className="text-xs text-muted-foreground">No tests suggested.</p>
            )}
          </Tile>

          <Tile icon={Pill} title="Medicine directions (ingredients)">
            {(out?.medicines || []).map((m) => (
              <div key={m.category} className="mb-2 text-[13px]">
                <div className="font-medium">
                  {m.category}
                  {m.form && <span className="ml-1 text-xs text-muted-foreground">({m.form})</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(m.ingredients || []).map((ing) => (
                    <span key={ing} className="rounded-full bg-muted px-2 py-0.5 text-xs">{ing}</span>
                  ))}
                </div>
                {m.caution && <div className="mt-0.5 text-xs text-amber-700">⚠ {m.caution}</div>}
              </div>
            ))}
            {!out?.medicines?.length && <p className="text-xs text-muted-foreground">—</p>}
          </Tile>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        {isSuccess && (
          <Badge variant={out.basedOnPhotos ? 'info' : 'secondary'} className="text-[10px]">
            {out.basedOnPhotos ? 'Photos analysed' : 'Symptoms only'}
          </Badge>
        )}
        <span className="truncate">{out?.confidenceNote}</span>
        {aiPrecheck?.model && <span className="ml-auto shrink-0">{aiPrecheck.model}</span>}
      </footer>
    </div>
  );
}
