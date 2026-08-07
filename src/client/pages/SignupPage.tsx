import React, { useCallback, useState } from 'react';
import { signupWithPassword, loginWithPassword } from 'modelence/client';
import { Link } from 'react-router-dom';
import { Button } from '@/client/components/ui/Button';
import { Checkbox } from '@/client/components/ui/Checkbox';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import Page from '@/client/components/Page';

export default function SignupPage() {
  return (
    <Page seo={{ title: 'Регистрация', noindex: true }}>
      <div className="flex justify-center py-6 sm:py-12">
        <SignupForm />
      </div>
    </Page>
  );
}

function SignupForm() {
  const [isPending, setIsPending] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formError, setFormError] = useState<{ field: 'email' | 'password' | 'confirmPassword' | 'terms'; message: string } | null>(null);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email'));
      const password = String(formData.get('password'));
      const confirmPassword = String(formData.get('confirmPassword'));

      const fail = (field: 'email' | 'password' | 'confirmPassword' | 'terms', message: string) => {
        setFormError({ field, message });
        const control = event.currentTarget.elements.namedItem(field === 'terms' ? 'acceptedTerms' : field);
        if (control instanceof HTMLElement) control.focus();
      };

      if (password.length < 8) {
        fail('password', 'Пароль должен быть не короче 8 символов');
        return;
      }
      if (password !== confirmPassword) {
        fail('confirmPassword', 'Пароли не совпадают');
        return;
      }
      if (!acceptedTerms) {
        fail('terms', 'Нужно принять условия использования и политику конфиденциальности');
        return;
      }

      setIsPending(true);
      setFormError(null);
      try {
        await signupWithPassword({ email, password });
        await loginWithPassword({ email, password });
      } catch (error) {
        setFormError({ field: 'email', message: (error as Error).message || 'Не удалось создать аккаунт' });
      } finally {
        setIsPending(false);
      }
    },
    [acceptedTerms]
  );

  return (
    <div className="w-full max-w-sm animate-slide-up overflow-hidden rounded-2xl border border-mist-2 bg-paper shadow-sm">
      <div className="hatch h-2 w-full" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-tight">
          Регистрация
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">Дневник КБЖУ и база продуктов — бесплатно</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label
              htmlFor="email"
              className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"
            >
              Email
            </Label>
            <Input
              type="email"
              name="email"
              id="email"
              autoComplete="email"
              className="h-11 rounded-lg"
              aria-invalid={formError?.field === 'email'}
              aria-describedby={formError?.field === 'email' ? 'signup-error' : undefined}
              onChange={() => setFormError(null)}
              required
            />
          </div>

          <div>
            <Label
              htmlFor="password"
              className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"
            >
              Пароль
            </Label>
            <Input
              type="password"
              name="password"
              id="password"
              autoComplete="new-password"
              className="h-11 rounded-lg"
              aria-invalid={formError?.field === 'password'}
              aria-describedby={formError?.field === 'password' ? 'signup-error' : undefined}
              onChange={() => setFormError(null)}
              required
            />
          </div>

          <div>
            <Label
              htmlFor="confirm-password"
              className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"
            >
              Повторите пароль
            </Label>
            <Input
              type="password"
              name="confirmPassword"
              id="confirm-password"
              autoComplete="new-password"
              className="h-11 rounded-lg"
              aria-invalid={formError?.field === 'confirmPassword'}
              aria-describedby={formError?.field === 'confirmPassword' ? 'signup-error' : undefined}
              onChange={() => setFormError(null)}
              required
            />
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox
              id="consent-terms"
              name="acceptedTerms"
              checked={acceptedTerms}
              aria-invalid={formError?.field === 'terms'}
              aria-describedby={formError?.field === 'terms' ? 'signup-error' : undefined}
              onCheckedChange={(checked) => { setAcceptedTerms(Boolean(checked)); setFormError(null); }}
            />
            <Label htmlFor="consent-terms" className="text-sm font-normal leading-snug text-ink-3">
              Принимаю{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-flame-600 hover:underline">
                условия использования
              </a>{' '}и{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-flame-600 hover:underline">
                политику конфиденциальности
              </a>
            </Label>
          </div>

          {formError && <p id="signup-error" role="alert" className="rounded-lg border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-ink-2">{formError.message}</p>}

          <Button
            type="submit"
            color="primary"
            size="lg"
            loading={isPending}
            className="w-full rounded-lg font-display text-base uppercase tracking-wide"
          >
            Создать аккаунт
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-3">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-semibold text-flame-600 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
