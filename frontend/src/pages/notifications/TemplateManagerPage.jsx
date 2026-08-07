import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useNotificationTemplates,
  useUpdateTemplate,
} from '@/modules/notifications/hooks/useNotifications';

export default function TemplateManagerPage() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = useNotificationTemplates();
  const update = useUpdateTemplate();
  const [editing, setEditing] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const startEdit = (t) => {
    setEditing(t.id);
    setSubject(t.subject || '');
    setBody(t.body || '');
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('notifications.templates.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('notifications.templates.placeholderHint', { placeholder: '{{variable}}' })}
        </p>
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t('notifications.templates.channelSettings')}</p>
        <p>{t('notifications.templates.channelSettingsBody')}</p>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {templates.map((tpl) => (
          <div key={tpl.id} className="space-y-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {tpl.name}{' '}
                  <span className="text-xs text-muted-foreground">{tpl.code}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t('notifications.templates.event')}: {tpl.eventName || '—'}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => startEdit(tpl)}>
                {t('common.edit')}
              </Button>
            </div>
            {editing === tpl.id ? (
              <div className="space-y-2">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('notifications.templates.subjectPlaceholder')} />
                <textarea
                  className="min-h-[100px] w-full rounded-md border p-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate(
                      { id: tpl.id, subject, body },
                      { onSuccess: () => setEditing(null) }
                    )
                  }
                >
                  {t('common.save')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tpl.body}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
