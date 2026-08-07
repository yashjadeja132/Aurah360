import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Sparkles, ThumbsUp, ThumbsDown, Pencil } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const USE_CASES = [
  { value: 'SUGGESTED_QUESTIONS', tKey: 'suggestedQuestions', label: 'Suggested questions' },
  { value: 'RED_FLAG_ASSIST', tKey: 'redFlagAssist', label: 'Red-flag check' },
  { value: 'DRAFT_NOTE', tKey: 'draftNote', label: 'Draft SOAP note' },
  { value: 'PATIENT_INSTRUCTION_DRAFT', tKey: 'patientInstructions', label: 'Patient instructions' },
];

/**
 * AI clinical copilot panel (Module 9, §8.2). Every output is labeled "suggestion" and is
 * never auto-saved — the doctor must explicitly accept, edit, or reject before it can influence
 * the record. Sends only the chief complaint / free-text context — the backend de-identification
 * gate (PiiRedactor) strips identity fields before anything reaches the AI provider.
 */
export function AiAssistPanel({ patientId, consultationId, context }) {
  const { t } = useTranslation();
  const [useCase, setUseCase] = useState(USE_CASES[0].value);
  const [result, setResult] = useState(null);

  const runMutation = useMutation({
    mutationFn: () => api.post('/ai/run', { useCase, patientId, consultationId, context }).then((r) => r.data),
    onSuccess: (res) => setResult(res.data),
    onError: (err) => toast.error(err.response?.data?.message || t('consultations.ai.requestFailed', 'AI request failed')),
  });

  const dispositionMutation = useMutation({
    mutationFn: (disposition) => api.post(`/ai/runs/${result.runId}/disposition`, { disposition }).then((r) => r.data),
    onSuccess: (_res, disposition) => {
      toast.success(
        disposition === 'ACCEPTED'
          ? t('consultations.ai.markedAccepted', 'Marked accepted')
          : t('consultations.ai.markedRejected', 'Marked rejected')
      );
      setResult(null);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> {t('consultations.ai.title', 'AI assist')}
        </CardTitle>
        <CardDescription>
          {t('consultations.ai.description', 'Suggestions only — nothing here is saved until you accept it.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {USE_CASES.map((uc) => (
            <button
              key={uc.value}
              type="button"
              onClick={() => setUseCase(uc.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                useCase === uc.value ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-accent'
              }`}
            >
              {t(`consultations.ai.useCases.${uc.tKey}`, uc.label)}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
          <Sparkles className="h-4 w-4" />{' '}
          {runMutation.isPending ? t('consultations.ai.thinking', 'Thinking…') : t('consultations.ai.getSuggestion', 'Get suggestion')}
        </Button>

        {result && (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <Badge variant="info">{t('consultations.ai.suggestionNotSaved', 'Suggestion — not saved')}</Badge>
              {result.status !== 'SUCCESS' && <Badge variant="warning">{result.status}</Badge>}
            </div>
            <pre className="whitespace-pre-wrap text-sm">
              {result.output ? JSON.stringify(result.output, null, 2) : result.error || t('consultations.ai.noOutput', 'No output.')}
            </pre>
            {result.output && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => dispositionMutation.mutate('ACCEPTED')}>
                  <ThumbsUp className="h-3.5 w-3.5" /> {t('consultations.ai.accept', 'Accept')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => dispositionMutation.mutate('EDITED')}>
                  <Pencil className="h-3.5 w-3.5" /> {t('consultations.ai.illEdit', "I'll edit")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => dispositionMutation.mutate('REJECTED')}>
                  <ThumbsDown className="h-3.5 w-3.5" /> {t('consultations.ai.reject', 'Reject')}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AiAssistPanel;
