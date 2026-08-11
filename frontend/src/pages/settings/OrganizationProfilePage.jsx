import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization, useOrganizationMutations } from '@/modules/organization/hooks/useOrganization';
import { SUPPORTED_LANGUAGES } from '@/i18n';

/**
 * Settings → Organization profile. Singleton clinic-level profile that branches inherit
 * defaults from (ORG-001, ORG-006 — see backend/src/models/Organization.model.js). Every
 * save produces a new document version plus an audit entry carrying the old->new diff
 * (OrganizationService.update()); this page does not need to render that history itself,
 * the audit log page already covers it.
 */
export default function OrganizationProfilePage() {
  const { t } = useTranslation();
  const { data: org, isLoading, isError } = useOrganization();
  const { update } = useOrganizationMutations();
  const { register, handleSubmit, reset, control } = useForm({
    defaultValues: { languages: [] },
  });

  useEffect(() => {
    if (!org) return;
    reset({
      legalName: org.legalName || '',
      displayName: org.displayName || '',
      logo: org.logo || '',
      contactEmail: org.contactEmail || '',
      contactPhone: org.contactPhone || '',
      privacyContactEmail: org.privacyContactEmail || '',
      grievanceContactEmail: org.grievanceContactEmail || '',
      timezone: org.timezone || 'Asia/Kolkata',
      languages: org.languages || ['en', 'hi', 'gu'],
      financialYearStartMonth: org.financialYearStartMonth ?? 4,
      invoicePrefix: org.invoicePrefix || 'INV',
      invoiceFooterNote: org.invoiceFooterNote || '',
    });
  }, [org, reset]);

  const onSubmit = async (values) => {
    try {
      await update.mutateAsync({
        legalName: values.legalName,
        displayName: values.displayName,
        logo: values.logo || null,
        contactEmail: values.contactEmail || null,
        contactPhone: values.contactPhone || null,
        privacyContactEmail: values.privacyContactEmail || null,
        grievanceContactEmail: values.grievanceContactEmail || null,
        timezone: values.timezone,
        languages: values.languages,
        financialYearStartMonth: Number(values.financialYearStartMonth),
        invoicePrefix: values.invoicePrefix,
        invoiceFooterNote: values.invoiceFooterNote || null,
      });
      toast.success(t('settings.organization.savedToast', 'Organization profile saved'));
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('settings.organization.saveErrorToast', 'Save failed')
      );
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !org) {
    return (
      <p className="text-destructive">
        {t('settings.organization.notFound', 'Organization profile could not be loaded.')}
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('settings.organization.title', 'Organization profile')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'settings.organization.description',
            'Legal identity, contact details, timezone, languages, invoice settings and financial year. Every save is versioned with a full audit entry.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> {t('settings.organization.card.title', 'Profile')}
          </CardTitle>
          <CardDescription>
            {t('settings.organization.card.description', 'Branches inherit these defaults unless individually overridden.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.legalName', 'Legal name')}</Label>
                <Input {...register('legalName')} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.displayName', 'Display name')}</Label>
                <Input {...register('displayName')} required maxLength={200} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.organization.fields.logo', 'Logo URL')}</Label>
              <Input {...register('logo')} placeholder="https://…" maxLength={500} />
              <p className="text-xs text-muted-foreground">
                {t(
                  'settings.organization.fields.logoHint',
                  'Paste a hosted image URL. There is no upload-to-storage flow for this yet — host the file elsewhere and link it here.'
                )}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.contactEmail', 'Contact email')}</Label>
                <Input type="email" {...register('contactEmail')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.contactPhone', 'Contact phone')}</Label>
                <Input {...register('contactPhone')} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.privacyContactEmail', 'Privacy contact email')}</Label>
                <Input type="email" {...register('privacyContactEmail')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.grievanceContactEmail', 'Grievance contact email')}</Label>
                <Input type="email" {...register('grievanceContactEmail')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.timezone', 'Timezone')}</Label>
                <Input {...register('timezone')} placeholder="Asia/Kolkata" maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.financialYearStartMonth', 'Financial year start month (1-12)')}</Label>
                <Input type="number" min={1} max={12} {...register('financialYearStartMonth')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.organization.fields.languages', 'Languages')}</Label>
              <Controller
                control={control}
                name="languages"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const checked = (field.value || []).includes(lang.code);
                      return (
                        <label key={lang.code} className="flex items-center gap-2 text-sm">
                          <Input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(field.value || []);
                              if (e.target.checked) next.add(lang.code);
                              else next.delete(lang.code);
                              field.onChange(Array.from(next));
                            }}
                          />
                          {lang.label} ({lang.code})
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.organization.fields.languagesHint', 'At least one language must stay selected.')}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.invoicePrefix', 'Invoice prefix')}</Label>
                <Input {...register('invoicePrefix')} maxLength={10} />
                <p className="text-xs text-muted-foreground">
                  {t(
                    'settings.organization.fields.invoicePrefixHint',
                    'Changing this does not renumber past invoices — each prefix keeps its own counter.'
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.organization.fields.invoiceFooterNote', 'Invoice footer note')}</Label>
                <Input {...register('invoiceFooterNote')} maxLength={500} />
              </div>
            </div>

            <Button type="submit" disabled={update.isPending}>
              {update.isPending
                ? t('settings.organization.saving', 'Saving…')
                : t('settings.organization.saveAction', 'Save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
