import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSubmitFeedback } from '@/modules/patientPortal/hooks/usePatientPortal';

export default function PatientFeedbackPage() {
  const { t } = useTranslation();
  const submit = useSubmitFeedback();
  const [form, setForm] = useState({
    clinicRating: 5,
    doctorRating: 5,
    comments: '',
    suggestions: '',
  });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.feedback.title', 'Feedback')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.feedback.description', 'Rate your experience and share suggestions.')}</p>
      </div>
      <form
        className="grid max-w-lg gap-3 rounded-xl border bg-white/80 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await submit.mutateAsync({
              clinicRating: Number(form.clinicRating),
              doctorRating: Number(form.doctorRating),
              comments: form.comments || null,
              suggestions: form.suggestions || null,
            });
            toast.success(t('portal.feedback.thankYou', 'Thank you for your feedback'));
            setForm({ clinicRating: 5, doctorRating: 5, comments: '', suggestions: '' });
          } catch (err) {
            toast.error(err?.response?.data?.message || t('portal.feedback.submitFailed', 'Submit failed'));
          }
        }}
      >
        <label className="text-sm">
          {t('portal.feedback.clinicRating', 'Clinic rating (1–5)')}
          <input
            type="number"
            min={1}
            max={5}
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.clinicRating}
            onChange={(e) => setForm({ ...form, clinicRating: e.target.value })}
          />
        </label>
        <label className="text-sm">
          {t('portal.feedback.doctorRating', 'Doctor rating (1–5)')}
          <input
            type="number"
            min={1}
            max={5}
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.doctorRating}
            onChange={(e) => setForm({ ...form, doctorRating: e.target.value })}
          />
        </label>
        <textarea
          className="rounded-md border px-3 py-2 text-sm"
          rows={3}
          placeholder={t('portal.feedback.commentsPlaceholder', 'Comments')}
          value={form.comments}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
        />
        <textarea
          className="rounded-md border px-3 py-2 text-sm"
          rows={3}
          placeholder={t('portal.feedback.suggestionsPlaceholder', 'Suggestions')}
          value={form.suggestions}
          onChange={(e) => setForm({ ...form, suggestions: e.target.value })}
        />
        <Button type="submit" className="bg-teal-800 hover:bg-teal-900" disabled={submit.isPending}>
          {t('portal.feedback.submit', 'Submit feedback')}
        </Button>
      </form>
    </section>
  );
}
