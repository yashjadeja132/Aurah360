import { useState } from 'react';
import { Plus, BadgePercent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useOffers, useCreateOffer, useUpdateOffer } from '@/modules/crm/hooks/useCrmExtensions';
import { PERMISSIONS } from '@/constants/rbac';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

const emptyForm = {
  titleEn: '',
  descriptionEn: '',
  validFrom: todayKey(),
  validTo: '',
  bookingCta: 'Book now',
};

/** §12.5, CRM-001 — offer board (was OfferBoardPage). */
export function CrmOffersPanel() {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const { data: offers = [], isLoading } = useOffers();
  const create = useCreateOffer();
  const update = useUpdateOffer();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.titleEn || !form.validTo) return;
    await create.mutateAsync({
      title: { en: form.titleEn },
      description: { en: form.descriptionEn || undefined },
      validFrom: form.validFrom,
      validTo: form.validTo,
      bookingCta: form.bookingCta,
    });
    setForm(emptyForm);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('crm.offers.subtitle', 'Localized offers with validity windows and a booking call-to-action')}
      </p>

      <PermissionGuard permissions={[PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_ALL]}>
        <Card>
          <CardHeader>
            <CardTitle>{t('crm.offers.newOffer', 'New offer')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('crm.offers.titleEn', 'Title (EN)')}</Label>
                <Input
                  value={form.titleEn}
                  onChange={set('titleEn')}
                  placeholder={t('crm.offers.titlePlaceholder', 'e.g. 20% off laser sessions')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('crm.offers.bookingCta', 'Booking CTA')}</Label>
                <Input value={form.bookingCta} onChange={set('bookingCta')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('crm.offers.descriptionEn', 'Description (EN)')}</Label>
                <Input value={form.descriptionEn} onChange={set('descriptionEn')} />
              </div>
              <div className="space-y-2">
                <Label>{t('crm.offers.validFrom', 'Valid from')}</Label>
                <Input type="date" value={form.validFrom} onChange={set('validFrom')} />
              </div>
              <div className="space-y-2">
                <Label>{t('crm.offers.validTo', 'Valid to')}</Label>
                <Input type="date" value={form.validTo} onChange={set('validTo')} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  <Plus className="h-4 w-4" /> {t('crm.offers.createOffer', 'Create offer')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!isLoading && offers.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground">
            {t('crm.offers.noOffers', 'No offers yet.')}
          </p>
        )}
        {offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgePercent className="h-4 w-4 text-primary" /> {offer.title?.en}
              </CardTitle>
              <Badge variant={offer.isCurrentlyValid ? 'success' : 'secondary'}>
                {offer.isCurrentlyValid
                  ? t('crm.offers.live', 'Live')
                  : offer.isActive
                    ? t('crm.offers.scheduledExpired', 'Scheduled / expired')
                    : t('crm.offers.inactive', 'Inactive')}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {offer.description?.en && <p className="text-sm text-muted-foreground">{offer.description.en}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(offer.validFrom).toLocaleDateString()} – {new Date(offer.validTo).toLocaleDateString()}
              </p>
              <PermissionGuard permissions={[PERMISSIONS.CRM_OFFERS_MANAGE, PERMISSIONS.CRM_ALL]}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate({ id: offer.id, payload: { isActive: !offer.isActive } })}
                >
                  {offer.isActive
                    ? t('crm.offers.deactivate', 'Deactivate')
                    : t('crm.offers.reactivate', 'Reactivate')}
                </Button>
              </PermissionGuard>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default CrmOffersPanel;
