import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useNotificationTemplates,
  useUpdateTemplate,
} from '@/modules/notifications/hooks/useNotifications';

const WHATSAPP_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * Body of the former TemplateManagerPage. That page carried no per-action
 * permission guard of its own (the whole route was gated on
 * notifications.view / notifications.*), so none is added here — gates are
 * preserved, not invented.
 */
export function NotificationTemplatesPanel() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = useNotificationTemplates();
  const update = useUpdateTemplate();
  const [editing, setEditing] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dltHeader, setDltHeader] = useState('');
  const [dltTemplateId, setDltTemplateId] = useState('');
  const [whatsappApprovalStatus, setWhatsappApprovalStatus] = useState('PENDING');

  const startEdit = (tpl) => {
    setEditing(tpl.id);
    setSubject(tpl.subject || '');
    setBody(tpl.body || '');
    setDltHeader(tpl.dltHeader || '');
    setDltTemplateId(tpl.dltTemplateId || '');
    setWhatsappApprovalStatus(tpl.whatsappApprovalStatus || 'PENDING');
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('notifications.templates.placeholderHint', { placeholder: '{{variable}}' })}
      </p>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t('notifications.templates.channelSettings')}</p>
        <p>{t('notifications.templates.channelSettingsBody')}</p>
      </div>

      <div className="space-y-3">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {templates.map((tpl) => (
          <div key={tpl.id} className="space-y-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {tpl.name} <span className="text-xs text-muted-foreground">{tpl.code}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('notifications.templates.event')}: {tpl.eventName || '—'} · {tpl.channel}
                  {tpl.channel === 'SMS' && (tpl.dltHeader || tpl.dltTemplateId) && (
                    <> · DLT {tpl.dltHeader || '—'}/{tpl.dltTemplateId || '—'}</>
                  )}
                  {tpl.channel === 'WHATSAPP' && tpl.whatsappApprovalStatus && (
                    <> · {tpl.whatsappApprovalStatus}</>
                  )}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => startEdit(tpl)}>
                {t('common.edit')}
              </Button>
            </div>
            {editing === tpl.id ? (
              <div className="space-y-2">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('notifications.templates.subjectPlaceholder')}
                />
                <textarea
                  className="min-h-[100px] w-full rounded-md border p-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                {tpl.channel === 'SMS' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={dltHeader}
                      onChange={(e) => setDltHeader(e.target.value)}
                      placeholder={t('notifications.templates.dltHeaderPlaceholder', 'DLT header')}
                    />
                    <Input
                      value={dltTemplateId}
                      onChange={(e) => setDltTemplateId(e.target.value)}
                      placeholder={t(
                        'notifications.templates.dltTemplateIdPlaceholder',
                        'DLT template ID'
                      )}
                    />
                  </div>
                )}
                {tpl.channel === 'WHATSAPP' && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t('notifications.templates.whatsappApprovalStatus', 'WhatsApp approval status')}
                    </p>
                    <Select
                      value={whatsappApprovalStatus}
                      onChange={(e) => setWhatsappApprovalStatus(e.target.value)}
                    >
                      {WHATSAPP_APPROVAL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <Button
                  size="sm"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate(
                      {
                        id: tpl.id,
                        subject,
                        body,
                        ...(tpl.channel === 'SMS' ? { dltHeader, dltTemplateId } : {}),
                        ...(tpl.channel === 'WHATSAPP' ? { whatsappApprovalStatus } : {}),
                      },
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
        {!templates.length && !isLoading && (
          <EmptyState
            icon={FileText}
            title={t('notifications.hub.templates.empty', 'No templates configured.')}
            description={t(
              'notifications.hub.templates.emptyHint',
              'Templates are seeded per notification event and channel.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default NotificationTemplatesPanel;
