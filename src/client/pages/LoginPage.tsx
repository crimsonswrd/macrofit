import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { getConfig, loginWithPassword } from 'modelence/client';
import { Link } from 'react-router-dom';
import { Button } from '@/client/components/ui/Button';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import Page from '@/client/components/Page';
import { isDemoEnvironment, type DemoCredentials } from '@/shared/demoAuth';

export default function LoginPage() {
  return (
    <Page seo={{ title: 'Вход', noindex: true }}>
      <div className="flex justify-center py-6 sm:py-12">
        <LoginForm />
      </div>
    </Page>
  );
}

function LoginForm() {
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState('');
  const demoEnabled = isDemoEnvironment(getConfig('_system.env.type'), import.meta.env.PROD);
  const { data: demoCredentials } = useQuery({
    ...modelenceQuery<DemoCredentials | null>('demoAuth.getLocalCredentials', {}),
    enabled: demoEnabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));

    setIsPending(true);
    setFormError('');
    try {
      await loginWithPassword({ email, password });
    } catch (error) {
      const message = (error as Error).message || 'Не удалось войти';
      setFormError(message);
      const emailControl = form.elements.namedItem('email');
      if (emailControl instanceof HTMLElement) emailControl.focus();
    } finally {
      setIsPending(false);
    }
  }, []);

  return (
    <div className="w-full max-w-sm animate-slide-up overflow-hidden rounded-2xl border border-mist-2 bg-paper shadow-sm">
      <div className="hatch h-2 w-full" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-tight">
          Вход
        </h1>
        <p className="mt-1.5 text-sm text-ink-3">Продолжай вести дневник КБЖУ</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email" className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
              Email
            </Label>
            <Input
              type="email"
              name="email"
              id="email"
              autoComplete="email"
              key={`demo-email:${demoCredentials?.email ?? ''}`}
              defaultValue={demoCredentials?.email}
              readOnly={Boolean(demoCredentials)}
              className="h-11 rounded-lg"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'login-error' : undefined}
              onChange={() => setFormError('')}
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
              Пароль
            </Label>
            <Input
              type="password"
              name="password"
              id="password"
              autoComplete="current-password"
              key={`demo-password:${demoCredentials?.password ?? ''}`}
              defaultValue={demoCredentials?.password}
              readOnly={Boolean(demoCredentials)}
              className="h-11 rounded-lg"
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'login-error' : undefined}
              onChange={() => setFormError('')}
              required
            />
          </div>

          {formError && <p id="login-error" role="alert" className="rounded-lg border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-ink-2">{formError}</p>}

          <Button
            type="submit"
            color="primary"
            size="lg"
            loading={isPending}
            className="w-full rounded-lg font-display text-base uppercase tracking-wide"
          >
            Войти
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-3">
          Нет аккаунта?{' '}
          <Link to="/signup" className="font-semibold text-flame-600 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
