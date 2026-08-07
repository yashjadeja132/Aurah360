import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-4xl font-semibold text-primary">{t('notFound.title')}</h1>
      <p className="text-muted-foreground">{t('notFound.description')}</p>
      <Button asChild>
        <Link to={APP_ROUTES.DASHBOARD}>{t('notFound.backToDashboard')}</Link>
      </Button>
    </div>
  );
}
