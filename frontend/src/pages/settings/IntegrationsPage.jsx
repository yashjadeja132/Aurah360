import { Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useProviderStatus } from '@/modules/notifications/hooks/useNotifications';

/**
 * Settings → Integrations (admin flow doc §6). Config-presence only, matching the honest scope
 * already established by the Owner-dashboard provider health strip and the AI Governance
 * provider panel: "is a key present in config" (boolean), never a live connectivity ping and
 * never the secret value itself. A prior pass deliberately avoided a page that *looks* live —
 * this keeps that decision. No "Test connection" button is shown anywhere on this page: none of
 * the provider integrations in this codebase (WhatsApp Cloud, SMS/DLT, Exotel voice, FCM push,
 * SMTP email, Anthropic AI) currently has a cheap, side-effect-free connectivity check wired up
 * — only real send/complete calls that cost money or send a real message — so adding a button
 * here would fake a check that doesn't exist.
 */
const PROVIDER_ROWS = [
  { key: 'whatsapp', labelKey: 'settings.integrations.providers.whatsapp', label: 'WhatsApp BSP' },
  { key: 'sms', labelKey: 'settings.integrations.providers.sms', label: 'SMS / DLT' },
  { key: 'voice', labelKey: 'settings.integrations.providers.voice', label: 'Voice' },
  { key: 'push', labelKey: 'settings.integrations.providers.push', label: 'Push (FCM/APNs)' },
  { key: 'email', labelKey: 'settings.integrations.providers.email', label: 'Email' },
  { key: 'ai', labelKey: 'settings.integrations.providers.ai', label: 'AI provider' },
];

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useProviderStatus();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('settings.integrations.title', 'Integrations')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'settings.integrations.description',
            'Config presence per provider — whether credentials are set, not a live connectivity check. No credential value is ever shown here.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4" /> {t('settings.integrations.table.title', 'Providers')}</CardTitle>
          <CardDescription>
            {t('settings.integrations.table.description', 'Credentials live in server-side config/secret manager. This page only reports whether each is set.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.integrations.table.provider', 'Integration')}</TableHead>
                <TableHead>{t('settings.integrations.table.providerName', 'Configured provider')}</TableHead>
                <TableHead>{t('settings.integrations.table.model', 'Model')}</TableHead>
                <TableHead>{t('settings.integrations.table.status', 'Credential status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t('common.loading', 'Loading…')}</TableCell></TableRow>
              )}
              {!isLoading && PROVIDER_ROWS.map((row) => {
                const info = status?.[row.key];
                return (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{t(row.labelKey, row.label)}</TableCell>
                    <TableCell>{info?.provider || t('settings.integrations.none', 'None')}</TableCell>
                    <TableCell>{info?.model || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={info?.configured ? 'success' : 'destructive'}>
                        {info?.configured
                          ? t('settings.integrations.configured', 'Key configured: yes')
                          : t('settings.integrations.notConfigured', 'Key configured: no')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
