import { useCallback, useEffect, useState } from 'react';
import { logout } from 'modelence/client';
import { ShieldCheck } from 'lucide-react';
import Page from '@/client/components/Page';
import LoadingSpinner from '@/client/components/LoadingSpinner';
import { Button } from '@/client/components/ui/Button';

export default function LogoutPage() {
  const [failed, setFailed] = useState(false);

  const performLogout = useCallback(async () => {
    setFailed(false);
    try {
      await logout();
      window.location.replace('/login');
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void performLogout();
  }, [performLogout]);

  return (
    <Page seo={{ title: 'Выход', noindex: true }}>
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center animate-slide-up" aria-live="polite">
        <ShieldCheck className="size-10 text-flame-500" aria-hidden="true" />
        <h1 className="mt-4 font-display text-3xl font-bold uppercase">
          {failed ? 'Не удалось завершить сеанс' : 'Завершаем сеанс'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          {failed
            ? 'Попробуйте ещё раз. Ваши записи не изменены.'
            : 'Выходим из аккаунта на этом устройстве. Записи дневника останутся в аккаунте.'}
        </p>
        {failed ? (
          <Button className="mt-6" color="primary" onClick={() => void performLogout()}>
            Повторить выход
          </Button>
        ) : (
          <div className="mt-6"><LoadingSpinner /></div>
        )}
      </div>
    </Page>
  );
}
