import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/modules/auth/api/authApi';
import { forgotPasswordSchema } from '@/modules/users/validation/staffSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_ROUTES } from '@/constants/routes';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (res) =>
      toast.success(res.message || t('auth.forgotPasswordPage.successFallback', 'If the account exists, instructions were sent.')),
    onError: (err) => toast.error(err.response?.data?.message || t('auth.forgotPasswordPage.failed', 'Request failed')),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.forgotPasswordPage.title', 'Forgot password')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.forgotPasswordPage.placeholderNotice', 'Placeholder flow — email delivery will connect in the communications module.')}
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? t('auth.forgotPasswordPage.submitting', 'Submitting…') : t('auth.forgotPasswordPage.submit', 'Send reset link')}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link className="text-primary underline-offset-4 hover:underline" to={APP_ROUTES.LOGIN}>
          {t('auth.forgotPasswordPage.backToSignIn', 'Back to sign in')}
        </Link>
      </p>
    </div>
  );
}
