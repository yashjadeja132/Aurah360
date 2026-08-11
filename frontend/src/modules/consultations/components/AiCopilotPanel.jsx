import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Info,
  Languages,
  Pill,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  ThumbsDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { useAiCopilot } from '../hooks/useAiCopilot';
import { INSERT_TARGETS, emitInsert } from '../insertBus';

const LIKELIHOOD_VARIANT = { high: 'warning', medium: 'info', low: 'secondary' };

/**
 * A single, prominent disclaimer for the whole results area — replaces a per-section badge
 * repeated nine times over, which was pure visual noise without adding any real caution (a
 * doctor scanning nine identical pills learns nothing from the 2nd through 9th one).
 */
function VerifyBanner() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-xs font-medium text-info">
      <Sparkles className="h-4 w-4 shrink-0" />
      {t(
        'consultations.copilot.verifyBannerAll',
        'Everything below is an AI suggestion, not a diagnosis — verify before you use any of it.'
      )}
    </div>
  );
}

/**
 * A section that can be collapsed. Sections carrying the most time-critical or highest-signal
 * content default OPEN (defaultOpen=true); longer reference-style lists default CLOSED so the
 * first screenful is short and scannable, with a count badge so nothing feels hidden — the
 * doctor expands what's relevant to this patient instead of scrolling past everything.
 */
function Section({
  icon: Icon,
  title,
  children,
  tone = 'default',
  action,
  count,
  defaultOpen = true,
  openSignal,
  sectionRef,
}) {
  const [open, setOpen] = useState(defaultOpen);

  // openSignal is a changing token bumped by the mode buttons above — when a doctor clicks
  // "Draft note" etc. we need the matching section to expand even if it defaults closed.
  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  return (
    <section
      ref={sectionRef}
      className={cn(
        'rounded-lg border',
        tone === 'danger' ? 'border-destructive/50 bg-destructive/5' : 'border-border/70 bg-background'
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
      >
        <h4
          className={cn(
            'flex items-center gap-2 text-sm font-semibold',
            tone === 'danger' ? 'text-destructive' : 'text-foreground'
          )}
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          {Icon && <Icon className="h-4 w-4" />}
          {title}
          {typeof count === 'number' && (
            <Badge variant={tone === 'danger' ? 'destructive' : 'secondary'}>{count}</Badge>
          )}
        </h4>
        {action && <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>{action}</div>}
      </button>
      {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
    </section>
  );
}

/**
 * Inline "Accept" affordance shared by every AI-suggestion insert point.
 *
 * Clicking the label button expands, in place, a small edit row pre-filled with the AI's
 * suggested text (or, for payloads that aren't a single editable string — a medication with
 * name/dose/frequency, a lab order, a diagnosis — a checkbox that lets the doctor flag that
 * they changed it). Two exits: "Insert as-is" (no change → ACCEPTED) and "Insert with my edits"
 * / a ticked checkbox (→ EDITED, with the edited payload attached so the audit trail reflects
 * what was actually written into the record, not just that a suggestion existed).
 *
 * Nothing here writes to the record on its own — `onAccept` still only calls emitInsert into the
 * doctor's own editable field, exactly like the old single-step accept().
 */
function AcceptControl({ label, payload, textKey = 'text', freeText = true, onAccept }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(payload[textKey] ?? '');
  const [changed, setChanged] = useState(false);

  const originalText = payload[textKey] ?? '';

  const open = () => {
    setText(originalText);
    setChanged(false);
    setEditing(true);
  };

  const close = () => setEditing(false);

  const insert = () => {
    if (freeText) {
      const wasEdited = text !== originalText;
      onAccept({ ...payload, [textKey]: text }, wasEdited);
    } else {
      onAccept(payload, changed);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <Button size="sm" variant="outline" onClick={open}>
        {label}
      </Button>
    );
  }

  return (
    <div className="mt-1.5 w-full rounded-md border border-dashed border-primary/40 bg-primary/[0.04] p-2">
      {freeText ? (
        <textarea
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      ) : (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-3.5 w-3.5"
            checked={changed}
            onChange={(e) => setChanged(e.target.checked)}
          />
          {t(
            'consultations.copilot.iChangedThis',
            "I'm changing this before saving it (record as edited, not accepted verbatim)"
          )}
        </label>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={insert}>
          {freeText && text !== originalText
            ? t('consultations.copilot.insertWithEdits', 'Insert with my edits')
            : t('consultations.copilot.insertAsIs', 'Insert as-is')}
        </Button>
        <Button size="sm" variant="ghost" onClick={close}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}

/** What changed between the previous suggestion and the refined one. */
function useDiff(previous, current) {
  return useMemo(() => {
    if (!previous || !current) return null;
    const names = (list) => (list || []).map((c) => c?.condition).filter(Boolean);
    const before = names(previous.output.possible_conditions);
    const after = names(current.output.possible_conditions);
    const beforeFlags = previous.output.red_flags || [];
    const afterFlags = current.output.red_flags || [];
    const likelihoodBefore = new Map(
      (previous.output.possible_conditions || []).map((c) => [c.condition, c.likelihood])
    );
    return {
      addedConditions: after.filter((c) => !before.includes(c)),
      removedConditions: before.filter((c) => !after.includes(c)),
      reranked: (current.output.possible_conditions || [])
        .filter(
          (c) =>
            likelihoodBefore.has(c.condition) && likelihoodBefore.get(c.condition) !== c.likelihood
        )
        .map((c) => `${c.condition}: ${likelihoodBefore.get(c.condition)} → ${c.likelihood}`),
      addedFlags: afterFlags.filter((f) => !beforeFlags.includes(f)),
      resolvedFlags: beforeFlags.filter((f) => !afterFlags.includes(f)),
      newQuestions: (current.output.follow_up_questions || []).filter(
        (q) => !(previous.output.follow_up_questions || []).includes(q)
      ),
    };
  }, [previous, current]);
}

/**
 * The consultation cockpit's primary section. Lives permanently beside the clinical note (it is
 * NOT a tab), so the doctor reads a suggestion and edits the note without switching views.
 *
 * Every Accept does two things: it inserts editable text into the matching record field via the
 * insert bus, and it records an ACCEPTED disposition against the run for audit. Nothing is saved
 * to the record automatically and nothing is signed — the doctor signs.
 */
export function AiCopilotPanel({ consultationId, patientId, readOnly, chiefComplaint, onInsert }) {
  const { t } = useTranslation();
  const copilot = useAiCopilot({ consultationId, patientId });
  const {
    output,
    current,
    previous,
    degraded,
    reason,
    model,
    answers,
    setAnswer,
    answeredPairs,
    run,
    isRunning,
    refine,
    isRefining,
    recordDisposition,
    versions,
  } = copilot;

  const [includePhotos, setIncludePhotos] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const diff = useDiff(previous, current);

  /**
   * Four distinct entry points instead of one combined "Analyse" button. The backend still runs
   * one full copilot analysis per call (narrowing the prompt per-mode would mean touching the
   * shared JSON-schema contract in clinical-copilot-v1.txt, which is riskier than this pass
   * warrants) — each button fires the same run() and then jumps the doctor straight to the
   * section their chosen action is about, expanding it if it defaults closed. `pendingFocus`
   * survives the async run and is consumed once the matching section mounts.
   */
  const [pendingFocus, setPendingFocus] = useState(null);
  const [focusSignals, setFocusSignals] = useState({});
  const sectionRefs = useRef({});

  const MODE_SECTION = {
    suggest_questions: 'questions',
    summarize_timeline: 'summary',
    summarize_report: 'investigations',
    draft_note: 'patientAdvice',
  };

  const runMode = (mode) => {
    setPendingFocus(MODE_SECTION[mode] || null);
    run({ includePhotos });
  };

  useEffect(() => {
    if (!pendingFocus || !current) return;
    const key = pendingFocus;
    setPendingFocus(null);
    // Bump the section's open signal (forces it open even if defaultOpen=false) and scroll to it
    // once React has had a chance to render the new output.
    setFocusSignals((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    requestAnimationFrame(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [pendingFocus, current]);

  const acceptWithEdit = (finalPayload, wasEdited, target, label) => {
    emitInsert(target, finalPayload);
    onInsert?.(target);
    recordDisposition(wasEdited ? 'EDITED' : 'ACCEPTED', wasEdited ? finalPayload : undefined);
    toast.success(t('consultations.copilot.inserted', 'Inserted into {{field}} — edit before saving', { field: label }));
  };

  const insertQaIntoSubjective = () => {
    if (answeredPairs.length === 0) return;
    const block = [
      t('consultations.copilot.qaHeading', 'Focused history (AI-prompted questions, answers recorded by clinician):'),
      ...answeredPairs.map((p) => `- ${p.question} — ${p.answer}`),
    ].join('\n');
    emitInsert(INSERT_TARGETS.SOAP_SUBJECTIVE, { text: block });
    onInsert?.(INSERT_TARGETS.SOAP_SUBJECTIVE);
    toast.success(t('consultations.copilot.qaInserted', 'Q&A inserted into Subjective'));
  };

  const questions = output?.follow_up_questions || [];
  const answeredCount = answeredPairs.length;

  return (
    <div className="flex h-full flex-col rounded-xl border-2 border-primary/40 bg-primary/[0.03]">
      <header className="space-y-2 border-b border-primary/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-primary">
              <Sparkles className="h-5 w-5" />
              {t('consultations.copilot.title', 'AI clinical copilot')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                'consultations.copilot.subtitle',
                'Decision support only. Not a diagnosis. The clinician verifies, edits and signs everything.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {model && <Badge variant="outline">{model}</Badge>}
            {versions.length > 1 && (
              <Badge variant="secondary">
                {t('consultations.copilot.versionCount', 'v{{n}}', { n: versions.length })}
              </Badge>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
              />
              {t('consultations.copilot.includePhotos', 'Include clinical photos')}
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => runMode('suggest_questions')} disabled={isRunning}>
            <ClipboardList className="h-4 w-4" />
            {t('consultations.copilot.modeSuggestQuestions', 'Suggest questions')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runMode('summarize_timeline')} disabled={isRunning}>
            <RefreshCw className="h-4 w-4" />
            {t('consultations.copilot.modeSummarizeTimeline', 'Summarize timeline')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runMode('summarize_report')} disabled={isRunning}>
            <FlaskConical className="h-4 w-4" />
            {t('consultations.copilot.modeSummarizeReport', 'Summarize report')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runMode('draft_note')} disabled={isRunning}>
            <Languages className="h-4 w-4" />
            {t('consultations.copilot.modeDraftNote', 'Draft note')}
          </Button>
          <Button size="sm" onClick={() => runMode(null)} disabled={isRunning}>
            <Sparkles className="h-4 w-4" />
            {isRunning
              ? t('consultations.copilot.running', 'Analysing…')
              : current
                ? t('consultations.copilot.rerun', 'Re-run')
                : t('consultations.copilot.start', 'Analyse this consultation')}
          </Button>
        </div>
        {chiefComplaint && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{t('consultations.copilot.chiefComplaint', 'Chief complaint')}:</span>{' '}
            {chiefComplaint}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {degraded && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning-soft p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {t('consultations.copilot.degradedTitle', 'AI assistance unavailable')}
              </p>
              <p className="text-xs">
                {reason ||
                  t('consultations.copilot.degradedReason', 'The AI provider is disabled or unreachable.')}
              </p>
              <p className="mt-1 text-xs">
                {t(
                  'consultations.copilot.degradedHint',
                  'Continue documenting normally — every clinical section on the right still works.'
                )}
              </p>
            </div>
          </div>
        )}

        {!current && !isRunning && !degraded && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/60" />
            <p>
              {t(
                'consultations.copilot.emptyState',
                'Run the copilot to get questions to ask the patient, differentials to consider, red flags and draft advice.'
              )}
            </p>
          </div>
        )}

        {isRunning && !current && (
          <p className="text-sm text-muted-foreground">
            {t('consultations.copilot.runningHint', 'Reading the consultation context…')}
          </p>
        )}

        {output && (
          <>
            <VerifyBanner />
            {/* SAFETY FIRST — red flags sit above the differential whenever present. */}
            {output.red_flags.length > 0 && (
              <Section
                icon={ShieldAlert}
                tone="danger"
                count={output.red_flags.length}
                title={t('consultations.copilot.redFlags', 'Red flags — rule out now')}
              >
                <ul className="space-y-1.5">
                  {output.red_flags.map((flag) => (
                    <li key={flag} className="flex items-start gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1">{flag}</span>
                      {!readOnly && (
                        <AcceptControl
                          label={t('consultations.copilot.noteIt', 'Note it')}
                          payload={{ text: `${t('consultations.copilot.redFlagPrefix', 'Red flag considered')}: ${flag}` }}
                          onAccept={(finalPayload, wasEdited) =>
                            acceptWithEdit(
                              finalPayload,
                              wasEdited,
                              INSERT_TARGETS.SOAP_OBJECTIVE,
                              t('consultations.soap.objective', 'Objective')
                            )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {diff && (
              <div className="rounded-lg border border-info/40 bg-info-soft/50 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-info">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('consultations.copilot.whatChanged', 'What changed after the answers')}
                </p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {diff.addedConditions.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">
                        {t('consultations.copilot.diffAdded', 'Now considered')}:
                      </span>{' '}
                      {diff.addedConditions.join(', ')}
                    </li>
                  )}
                  {diff.removedConditions.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">
                        {t('consultations.copilot.diffRemoved', 'No longer listed')}:
                      </span>{' '}
                      {diff.removedConditions.join(', ')}
                    </li>
                  )}
                  {diff.reranked.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">
                        {t('consultations.copilot.diffReranked', 'Likelihood changed')}:
                      </span>{' '}
                      {diff.reranked.join('; ')}
                    </li>
                  )}
                  {diff.addedFlags.length > 0 && (
                    <li className="text-destructive">
                      <span className="font-medium">{t('consultations.copilot.diffNewFlags', 'New red flags')}:</span>{' '}
                      {diff.addedFlags.join(', ')}
                    </li>
                  )}
                  {diff.resolvedFlags.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">
                        {t('consultations.copilot.diffClearedFlags', 'Red flags dropped')}:
                      </span>{' '}
                      {diff.resolvedFlags.join(', ')}
                    </li>
                  )}
                  {diff.newQuestions.length > 0 && (
                    <li>
                      <span className="font-medium text-foreground">
                        {t('consultations.copilot.diffNewQuestions', 'New questions to ask')}:
                      </span>{' '}
                      {diff.newQuestions.length}
                    </li>
                  )}
                  {diff.addedConditions.length === 0 &&
                    diff.removedConditions.length === 0 &&
                    diff.reranked.length === 0 &&
                    diff.addedFlags.length === 0 &&
                    diff.resolvedFlags.length === 0 && (
                      <li>{t('consultations.copilot.diffNone', 'Differential unchanged — wording refined only.')}</li>
                    )}
                </ul>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
                  onClick={() => setShowPrevious((v) => !v)}
                >
                  {showPrevious ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {showPrevious
                    ? t('consultations.copilot.hidePrevious', 'Hide previous version')
                    : t('consultations.copilot.showPrevious', 'Show previous version')}
                </button>
                {showPrevious && (
                  <div className="mt-2 space-y-1 rounded-md border bg-background p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('consultations.copilot.previousVersion', 'Previous suggestion')}
                    </p>
                    <p className="text-xs text-muted-foreground">{previous.output.summary || '—'}</p>
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {previous.output.possible_conditions.map((c) => (
                        <li key={c.condition}>
                          {c.condition} ({c.likelihood})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {output.summary && (
              <Section
                icon={Info}
                title={t('consultations.copilot.summary', 'Context summary')}
                sectionRef={(el) => { sectionRefs.current.summary = el; }}
                openSignal={focusSignals.summary}
              >
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{output.summary}</p>
              </Section>
            )}

            {/* THE LOOP — ask, record the answer, refine. */}
            {questions.length > 0 && (
              <Section
                icon={ClipboardList}
                title={t('consultations.copilot.questions', 'Questions to ask the patient')}
                sectionRef={(el) => { sectionRefs.current.questions = el; }}
                openSignal={focusSignals.questions}
                action={
                  <Badge variant={answeredCount ? 'success' : 'secondary'}>
                    {t('consultations.copilot.answeredCount', '{{answered}} of {{total}} answered', {
                      answered: answeredCount,
                      total: questions.length,
                    })}
                  </Badge>
                }
              >
                <ol className="space-y-3">
                  {questions.map((question, index) => {
                    const value = answers[question] || '';
                    return (
                      <li key={question} className="rounded-md border bg-card p-2.5">
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                              value.trim()
                                ? 'bg-success-soft text-success'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {value.trim() ? '✓' : index + 1}
                          </span>
                          <p className="flex-1 text-sm font-medium">{question}</p>
                        </div>
                        <textarea
                          className="mt-2 min-h-[52px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                          placeholder={t('consultations.copilot.answerPlaceholder', "Patient's answer…")}
                          value={value}
                          onChange={(e) => setAnswer(question, e.target.value)}
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {['Yes', 'No', 'Not sure'].map((quick) => (
                            <button
                              key={quick}
                              type="button"
                              onClick={() => setAnswer(question, quick)}
                              className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent disabled:opacity-50"
                            >
                              {t(`consultations.copilot.quick.${quick.replace(/\s/g, '')}`, quick)}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* NOT gated on readOnly: recording answers and refining are pure analysis and
                      write nothing to the consultation, so they stay available on a signed/locked
                      note — same as the Analyse button. Only the INSERT actions below are locked,
                      since those do modify the record. */}
                  <Button size="sm" onClick={refine} disabled={isRefining || answeredCount === 0}>
                    <ArrowRight className="h-4 w-4" />
                    {isRefining
                      ? t('consultations.copilot.refining', 'Refining…')
                      : t('consultations.copilot.refine', 'Refine with these answers')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={insertQaIntoSubjective}
                    disabled={readOnly || answeredCount === 0}
                  >
                    {t('consultations.copilot.insertQa', 'Insert Q&A into Subjective')}
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t(
                    'consultations.copilot.answersPersist',
                    'Answers are kept for this consultation while it stays open.'
                  )}
                </p>
              </Section>
            )}

            {output.possible_conditions.length > 0 && (
              <Section
                icon={Stethoscope}
                count={output.possible_conditions.length}
                title={t('consultations.copilot.differential', 'Conditions to consider (not a diagnosis)')}
              >
                <ul className="space-y-2">
                  {output.possible_conditions.map((c) => (
                    <li key={c.condition} className="rounded-md border bg-card p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{c.condition}</p>
                        <Badge variant={LIKELIHOOD_VARIANT[c.likelihood] || 'secondary'}>
                          {t(`consultations.copilot.likelihood.${c.likelihood}`, c.likelihood || 'unrated')}
                        </Badge>
                      </div>
                      {c.reasoning && (
                        <p className="mt-1 text-xs text-muted-foreground">{c.reasoning}</p>
                      )}
                      {!readOnly && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <AcceptControl
                            label={t('consultations.copilot.acceptToDiagnosis', 'Accept → Diagnosis')}
                            payload={{ condition: c.condition, reasoning: c.reasoning, likelihood: c.likelihood }}
                            freeText={false}
                            onAccept={(finalPayload, wasEdited) =>
                              acceptWithEdit(
                                finalPayload,
                                wasEdited,
                                INSERT_TARGETS.DIAGNOSIS,
                                t('consultations.diagnosis.title', 'Diagnosis')
                              )
                            }
                          />
                          <AcceptControl
                            label={t('consultations.copilot.acceptToAssessment', 'Add to Assessment')}
                            payload={{
                              text: `${t('consultations.copilot.considering', 'Considering')}: ${c.condition}${
                                c.likelihood ? ` (${c.likelihood})` : ''
                              }${c.reasoning ? ` — ${c.reasoning}` : ''}`,
                            }}
                            onAccept={(finalPayload, wasEdited) =>
                              acceptWithEdit(
                                finalPayload,
                                wasEdited,
                                INSERT_TARGETS.SOAP_ASSESSMENT,
                                t('consultations.soap.assessment', 'Assessment')
                              )
                            }
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {output.investigations.length > 0 && (
              <Section
                icon={FlaskConical}
                count={output.investigations.length}
                defaultOpen={false}
                title={t('consultations.copilot.investigations', 'Investigations to consider')}
                sectionRef={(el) => { sectionRefs.current.investigations = el; }}
                openSignal={focusSignals.investigations}
              >
                <ul className="space-y-2">
                  {output.investigations.map((inv) => (
                    <li
                      key={inv.test}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{inv.test}</p>
                        {inv.reason && <p className="text-xs text-muted-foreground">{inv.reason}</p>}
                      </div>
                      {!readOnly && (
                        <AcceptControl
                          label={t('consultations.copilot.acceptToLab', 'Accept → Lab order')}
                          payload={{ testName: inv.test, reason: inv.reason || '' }}
                          freeText={false}
                          onAccept={(finalPayload, wasEdited) =>
                            acceptWithEdit(
                              finalPayload,
                              wasEdited,
                              INSERT_TARGETS.LAB_ORDER,
                              t('consultations.labs.title', 'Lab orders')
                            )
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {output.medication_suggestions.length > 0 && (
              <Section
                icon={Pill}
                count={output.medication_suggestions.length}
                defaultOpen={false}
                title={t('consultations.copilot.medications', 'Medication options (verify dose, allergy, interactions)')}
              >
                <ul className="space-y-2">
                  {output.medication_suggestions.map((m) => (
                    <li key={`${m.generic_name}-${m.form_strength}`} className="rounded-md border bg-card p-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{m.generic_name}</p>
                        {m.form_strength && (
                          <span className="text-xs text-muted-foreground">{m.form_strength}</span>
                        )}
                      </div>
                      {(m.typical_dosing || m.typical_duration) && (
                        <p className="mt-1 text-sm">
                          {m.typical_dosing}
                          {m.typical_dosing && m.typical_duration && (
                            <span className="text-muted-foreground"> · </span>
                          )}
                          {m.typical_duration && <span className="text-muted-foreground">{m.typical_duration}</span>}
                        </p>
                      )}
                      {(m.composition || m.indian_brand_example) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {m.composition}
                          {m.composition && m.indian_brand_example && ' · '}
                          {m.indian_brand_example && (
                            <>
                              {t('consultations.copilot.med.brand', 'Brand example')}: {m.indian_brand_example}
                            </>
                          )}
                        </p>
                      )}
                      <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-warning">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {t('consultations.copilot.med.cautions', 'Cautions')}:{' '}
                          {m.cautions ||
                            t(
                              'consultations.copilot.med.noCautions',
                              'None returned — check allergies and interactions yourself.'
                            )}
                        </span>
                      </p>
                      {!readOnly && (
                        <div className="mt-2">
                          <AcceptControl
                            label={t('consultations.copilot.acceptToRx', 'Accept → Prescription draft')}
                            payload={m}
                            freeText={false}
                            onAccept={(finalPayload, wasEdited) =>
                              acceptWithEdit(
                                finalPayload,
                                wasEdited,
                                INSERT_TARGETS.PRESCRIPTION_LINE,
                                t('consultations.copilot.rxDraft', 'Prescription draft')
                              )
                            }
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {output.procedural_options_note && (
              <Section
                icon={Info}
                defaultOpen={false}
                title={t('consultations.copilot.procedures', 'Procedural options note')}
              >
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {output.procedural_options_note}
                </p>
                {!readOnly && (
                  <div className="mt-2">
                    <AcceptControl
                      label={t('consultations.copilot.acceptToPlan', 'Add to Plan')}
                      payload={{ text: output.procedural_options_note }}
                      onAccept={(finalPayload, wasEdited) =>
                        acceptWithEdit(
                          finalPayload,
                          wasEdited,
                          INSERT_TARGETS.SOAP_PLAN,
                          t('consultations.soap.plan', 'Plan')
                        )
                      }
                    />
                  </div>
                )}
              </Section>
            )}

            {output.diet_lifestyle_advice.length > 0 && (
              <Section
                icon={ClipboardList}
                count={output.diet_lifestyle_advice.length}
                defaultOpen={false}
                title={t('consultations.copilot.lifestyle', 'Diet and lifestyle advice')}
              >
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {output.diet_lifestyle_advice.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {!readOnly && (
                  <div className="mt-2">
                    <AcceptControl
                      label={t('consultations.copilot.acceptToInstructions', 'Accept → Patient instructions')}
                      payload={{ text: output.diet_lifestyle_advice.map((a) => `• ${a}`).join('\n') }}
                      onAccept={(finalPayload, wasEdited) =>
                        acceptWithEdit(
                          finalPayload,
                          wasEdited,
                          INSERT_TARGETS.FOLLOW_UP_INSTRUCTIONS,
                          t('consultations.followUp.instructions', 'Instructions')
                        )
                      }
                    />
                  </div>
                )}
              </Section>
            )}

            {(output.aftercare_advice_english || output.patient_advice_gujarati) && (
              <Section
                icon={Languages}
                defaultOpen={false}
                title={t('consultations.copilot.patientAdvice', 'Patient advice draft')}
                sectionRef={(el) => { sectionRefs.current.patientAdvice = el; }}
                openSignal={focusSignals.patientAdvice}
              >
                {output.aftercare_advice_english && (
                  <div className="rounded-md border bg-card p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('consultations.copilot.english', 'English')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{output.aftercare_advice_english}</p>
                    {!readOnly && (
                      <div className="mt-2">
                        <AcceptControl
                          label={t('consultations.copilot.acceptToInstructions', 'Accept → Patient instructions')}
                          payload={{ text: output.aftercare_advice_english }}
                          onAccept={(finalPayload, wasEdited) =>
                            acceptWithEdit(
                              finalPayload,
                              wasEdited,
                              INSERT_TARGETS.FOLLOW_UP_INSTRUCTIONS,
                              t('consultations.followUp.instructions', 'Instructions')
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
                {output.patient_advice_gujarati && (
                  <div className="mt-2 rounded-md border bg-card p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t('consultations.copilot.gujarati', 'Gujarati')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{output.patient_advice_gujarati}</p>
                    {!readOnly && (
                      <div className="mt-2">
                        <AcceptControl
                          label={t('consultations.copilot.acceptToInstructions', 'Accept → Patient instructions')}
                          payload={{ text: output.patient_advice_gujarati }}
                          onAccept={(finalPayload, wasEdited) =>
                            acceptWithEdit(
                              finalPayload,
                              wasEdited,
                              INSERT_TARGETS.FOLLOW_UP_INSTRUCTIONS,
                              t('consultations.followUp.instructions', 'Instructions')
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </Section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="max-w-lg text-[11px] text-muted-foreground">
                {output.confidence_note ||
                  t(
                    'consultations.copilot.defaultConfidence',
                    'Confidence not stated by the model. Treat all of the above as prompts for your own judgement.'
                  )}
              </p>
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={() => recordDisposition('REJECTED')}>
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {t('consultations.copilot.rejectRun', 'Mark this run not useful')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AiCopilotPanel;
