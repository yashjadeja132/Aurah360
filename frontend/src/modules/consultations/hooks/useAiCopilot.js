import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiCopilotApi } from '../api/aiCopilotApi';

/** Backend responses are enveloped ({ success, data }); tolerate both shapes. */
function unwrap(res) {
  if (res && typeof res === 'object' && 'data' in res && res.data && typeof res.data === 'object') {
    return res.data;
  }
  return res;
}

const EMPTY_OUTPUT = Object.freeze({
  summary: '',
  possible_conditions: [],
  follow_up_questions: [],
  red_flags: [],
  investigations: [],
  diet_lifestyle_advice: [],
  medication_suggestions: [],
  procedural_options_note: '',
  aftercare_advice_english: '',
  patient_advice_gujarati: '',
  confidence_note: '',
});

/** Normalise whatever the provider returned into the full contract shape. */
export function normaliseOutput(output) {
  const o = output || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (typeof v === 'string' ? v : '');
  return {
    summary: str(o.summary),
    possible_conditions: arr(o.possible_conditions),
    follow_up_questions: arr(o.follow_up_questions).filter((q) => typeof q === 'string' && q.trim()),
    red_flags: arr(o.red_flags).filter(Boolean),
    investigations: arr(o.investigations),
    diet_lifestyle_advice: arr(o.diet_lifestyle_advice).filter(Boolean),
    medication_suggestions: arr(o.medication_suggestions),
    procedural_options_note: str(o.procedural_options_note),
    aftercare_advice_english: str(o.aftercare_advice_english),
    patient_advice_gujarati: str(o.patient_advice_gujarati),
    confidence_note: str(o.confidence_note),
  };
}

export { EMPTY_OUTPUT };

const answersStorageKey = (consultationId) => `aurah360.consultation.${consultationId}.aiAnswers`;

function readStoredAnswers(consultationId) {
  if (!consultationId || typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(answersStorageKey(consultationId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Drives the copilot loop for one consultation:
 *   run() -> suggestions + follow_up_questions
 *   the doctor asks the patient and records answers (kept in sessionStorage, so they survive a
 *   reload and are still there when the note tab changes)
 *   refine() -> re-runs against the recorded Q&A, keeping the previous version for comparison.
 */
export function useAiCopilot({ consultationId, patientId }) {
  const [versions, setVersions] = useState([]); // oldest -> newest
  const [degraded, setDegraded] = useState(false);
  const [reason, setReason] = useState('');
  const [model, setModel] = useState('');
  const [answers, setAnswers] = useState(() => readStoredAnswers(consultationId));

  // Reload persisted answers when the workspace switches consultation.
  useEffect(() => {
    setAnswers(readStoredAnswers(consultationId));
    setVersions([]);
    setDegraded(false);
    setReason('');
  }, [consultationId]);

  useEffect(() => {
    if (!consultationId || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(answersStorageKey(consultationId), JSON.stringify(answers));
    } catch {
      /* sessionStorage full or blocked — answers simply stay in memory. */
    }
  }, [answers, consultationId]);

  const setAnswer = useCallback((question, answer) => {
    setAnswers((prev) => ({ ...prev, [question]: answer }));
  }, []);

  const clearAnswers = useCallback(() => setAnswers({}), []);

  const applyResult = useCallback((raw, kind, usedAnswers) => {
    const payload = unwrap(raw) || {};
    setDegraded(Boolean(payload.degraded));
    setReason(payload.reason || '');
    setModel(payload.model || '');
    setVersions((prev) => [
      ...prev,
      {
        runId: payload.runId || null,
        output: normaliseOutput(payload.output),
        kind,
        answers: usedAnswers || [],
        at: new Date().toISOString(),
      },
    ]);
    return payload;
  }, []);

  const runMutation = useMutation({
    mutationFn: (vars = {}) =>
      aiCopilotApi.run({ consultationId, patientId, includePhotos: vars.includePhotos }),
    onSuccess: (raw) => {
      const payload = applyResult(raw, 'initial');
      if (payload.degraded) {
        toast.warning(payload.reason || 'AI is unavailable — continue documenting manually.');
      }
    },
    onError: (e) => {
      const status = e?.response?.status;
      setDegraded(true);
      setReason(
        status === 404
          ? 'AI copilot endpoint is not available on this server.'
          : e?.response?.data?.message || 'AI copilot request failed.'
      );
    },
  });

  const refineMutation = useMutation({
    mutationFn: ({ runId, answers: pairs }) => aiCopilotApi.refine(runId, pairs),
    onSuccess: (raw, vars) => {
      applyResult(raw, 'refined', vars.answers);
      toast.success('Suggestions narrowed from the recorded answers');
    },
    onError: (e) => {
      const status = e?.response?.status;
      toast.error(
        status === 404
          ? 'Refine endpoint is not available on this server.'
          : e?.response?.data?.message || 'Refine failed.'
      );
    },
  });

  const dispositionMutation = useMutation({
    mutationFn: ({ runId, disposition, editedOutput }) =>
      aiCopilotApi.disposition(runId, disposition, editedOutput),
    // Disposition is an audit side-effect; a failure must never block the insert the doctor
    // already saw happen, so it is reported quietly.
    onError: () => toast.warning('Insert done, but the AI audit record could not be written.'),
  });

  const current = versions.length ? versions[versions.length - 1] : null;
  const previous = versions.length > 1 ? versions[versions.length - 2] : null;

  /** Q&A pairs the doctor has actually answered, for the current question list. */
  const answeredPairs = useMemo(() => {
    const questions = current?.output?.follow_up_questions || [];
    return questions
      .map((question) => ({ question, answer: (answers[question] || '').trim() }))
      .filter((pair) => pair.answer.length > 0);
  }, [current, answers]);

  const refine = useCallback(() => {
    if (!current?.runId || answeredPairs.length === 0) return;
    refineMutation.mutate({ runId: current.runId, answers: answeredPairs });
  }, [current, answeredPairs, refineMutation]);

  const recordDisposition = useCallback(
    (disposition, editedOutput) => {
      if (!current?.runId) return;
      dispositionMutation.mutate({ runId: current.runId, disposition, editedOutput });
    },
    [current, dispositionMutation]
  );

  return {
    versions,
    current,
    previous,
    output: current?.output || null,
    runId: current?.runId || null,
    model,
    degraded,
    reason,
    answers,
    setAnswer,
    clearAnswers,
    answeredPairs,
    run: runMutation.mutate,
    isRunning: runMutation.isPending,
    hasRun: runMutation.isSuccess || runMutation.isError || versions.length > 0,
    refine,
    isRefining: refineMutation.isPending,
    recordDisposition,
  };
}

export default useAiCopilot;
