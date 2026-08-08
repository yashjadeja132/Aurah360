import { useTranslation } from 'react-i18next';
import { CrmOffersPanel } from '@/modules/crm/components/CrmOffersPanel';

/** DEPRECATED — superseded by CrmHubPage (`/crm?tab=offers`). Thin wrapper. */
export default function OfferBoardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.offers.title', 'Offer board')}</h1>
      <CrmOffersPanel />
    </section>
  );
}
