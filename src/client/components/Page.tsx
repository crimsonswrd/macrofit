/**
 * App shell: red/white athletic header + content area.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from 'modelence/client';
import { LogOut } from 'lucide-react';
import LoadingSpinner from '@/client/components/LoadingSpinner';
import { Seo, type SeoProps } from '@/client/components/Seo';
import { Button } from '@/client/components/ui/Button';
import { cn } from '@/client/lib/utils';

interface PageProps {
  children?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  /** Per-page <head> overrides (title, description, OG image, etc). */
  seo?: SeoProps;
}

const NAV = [
  { to: '/', label: 'Дневник' },
  { to: '/foods', label: 'Продукты' },
];

const PERSONAL_FOODS_NAV = { to: '/foods/mine', label: 'Мои продукты' };
const PROGRESS_NAV = { to: '/progress', label: 'Прогресс' };
const PROFILE_NAV = { to: '/profile', label: 'Профиль' };

function isNavItemActive(pathname: string, to: string) {
  if (pathname.startsWith('/foods/')) return to === '/foods';
  return pathname === to;
}

export function Wordmark() {
  return (
    <Link
      to="/"
      className="group flex min-h-11 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
    >
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-lg border border-mist-2 bg-ink text-mist transition-transform duration-200 group-hover:-rotate-3">
        <span className="font-display text-2xl font-bold leading-none" aria-hidden="true">F</span>
        <span className="absolute inset-x-1 bottom-1 h-0.5 rounded-full bg-steady-500" aria-hidden="true" />
      </span>
      <span className="font-display text-[1.35rem] font-bold uppercase leading-none tracking-[0.08em]">
        Formetra
      </span>
    </Link>
  );
}

function Header() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const navItems = user ? [...NAV, PROGRESS_NAV, PERSONAL_FOODS_NAV, PROFILE_NAV] : NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-mist-2 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Wordmark />
          <nav aria-label="Основная навигация" className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500 focus-visible:ring-offset-2 focus-visible:ring-offset-mist',
                    isActive
                      ? 'bg-flame-100 text-ink'
                      : 'text-ink-3 hover:bg-mist hover:text-ink'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-ink-3 lg:block">
              {user.handle}
            </span>
            <Button
              render={<Link to="/logout" />}
              aria-label="Выйти"
              variant="ghost"
              size="sm"
              leftIcon={<LogOut className="size-4" />}
            >
              <span className="hidden lg:inline">Выйти</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button render={<Link to="/login" />} variant="ghost" size="sm">Вход</Button>
            <Button render={<Link to="/signup" />} color="primary" size="sm">Начать</Button>
          </div>
        )}
      </div>
      <div className="hatch h-1 w-full" aria-hidden="true" />
    </header>
  );
}

function MobileNav() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const navItems = user ? [...NAV, PROGRESS_NAV, PROFILE_NAV] : NAV;

  return (
    <nav
      aria-label="Мобильная навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-mist-2 bg-paper/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.28)] backdrop-blur lg:hidden"
    >
      {navItems.map((item) => {
        const isActive = isNavItemActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-h-16 flex-1 flex-col items-center justify-center rounded-md px-1 text-center text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-flame-500 sm:text-sm',
              isActive ? 'bg-flame-100 text-ink' : 'text-ink-3 hover:bg-mist hover:text-ink'
            )}
          >
            {item.label}
            <span
              className={cn(
                'mx-auto mt-1 block h-0.5 w-8 rounded-full transition-colors duration-200',
                isActive ? 'bg-flame-500' : 'bg-transparent'
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-mist-2 bg-paper">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-5 text-xs leading-relaxed text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>FORMETRA — навигатор питания для здоровых взрослых 18+, не медицинская рекомендация.</p>
        <nav aria-label="Правовая информация" className="flex gap-4">
          <Link to="/terms" className="inline-flex min-h-11 items-center rounded-md font-semibold hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500">Условия</Link>
          <Link to="/privacy" className="inline-flex min-h-11 items-center rounded-md font-semibold hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500">Конфиденциальность</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Page({ children, className, isLoading = false, seo }: PageProps) {
  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-mist pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Seo {...seo} />
      <Header />
      <main className={cn('mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8', className)}>
        {isLoading ? (
          <div className="flex h-64 w-full items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          children
        )}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
