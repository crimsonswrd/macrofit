import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouteObject, useLocation, useSearchParams } from 'react-router-dom';
import { useSession } from 'modelence/client';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import LoadingSpinner from '@/client/components/LoadingSpinner';
import { resolveOnboardingAccess, type OnboardingState } from '@/client/lib/profile';

const HomePage = lazy(() => import('./pages/HomePage'));

// For guest-only routes (login, signup) - redirects to home if already logged in
function GuestRoute() {
  const { user } = useSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const encodedRedirect = searchParams.get('_redirect');
  const redirect = encodedRedirect ? decodeURIComponent(encodedRedirect) : '/';

  if (user) {
    return <Navigate to={redirect} state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// For protected routes - redirects to login if not authenticated
function PrivateRoute() {
  const { user } = useSession();
  const location = useLocation();

  if (!user) {
    const fullPath = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?_redirect=${encodeURIComponent(fullPath)}`}
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
}

const ONBOARDING_EXEMPT_ROUTES = new Set(['/onboarding', '/logout', '/terms', '/privacy']);

function OnboardingGate() {
  const { user } = useSession();
  const location = useLocation();
  const onboardingQuery = useQuery({
    ...modelenceQuery<OnboardingState>('profile.getOnboardingState', {}),
    enabled: Boolean(user),
    retry: 1,
  });
  const access = resolveOnboardingAccess({
    isAuthenticated: Boolean(user),
    isExemptRoute: ONBOARDING_EXEMPT_ROUTES.has(location.pathname),
    isLoading: onboardingQuery.isLoading,
    isError: onboardingQuery.isError,
    state: onboardingQuery.data,
  });

  if (access === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-mist"><LoadingSpinner /></div>;
  }

  if (access === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist px-4 text-ink">
        <div role="alert" className="max-w-md rounded-2xl border border-flame-500/30 bg-paper p-6 text-center">
          <h1 className="font-display text-2xl font-bold uppercase">Не удалось проверить настройку профиля</h1>
          <p className="mt-2 text-sm text-ink-3">Мы не открываем персональные разделы без актуального состояния анкеты. Повторите проверку.</p>
          <button
            type="button"
            className="mt-5 min-h-11 rounded-xl border border-flame-500 bg-flame-500 px-4 py-2 text-sm font-bold text-mist transition-colors hover:bg-flame-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={onboardingQuery.isFetching}
            onClick={() => onboardingQuery.refetch()}
          >
            {onboardingQuery.isFetching ? 'Проверяем…' : 'Повторить'}
          </button>
        </div>
      </main>
    );
  }

  if (access === 'onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

// Public routes (no auth required)
const publicRoutes: RouteObject[] = [
  {
    path: '/',
    Component: HomePage
  },
  {
    path: '/foods',
    Component: lazy(() => import('./pages/FoodsPage'))
  },
  {
    path: '/terms',
    Component: lazy(() => import('./pages/TermsPage'))
  },
  {
    path: '/privacy',
    Component: lazy(() => import('./pages/PrivacyPage'))
  },
  {
    path: '/logout',
    Component: lazy(() => import('./pages/LogoutPage'))
  },
  {
    path: '*',
    Component: lazy(() => import('./pages/NotFoundPage'))
  }
];

// Guest routes (redirect to home if already logged in)
const guestRoutes: RouteObject[] = [
  {
    path: '/login',
    Component: lazy(() => import('./pages/LoginPage'))
  },
  {
    path: '/signup',
    Component: lazy(() => import('./pages/SignupPage'))
  }
];

// Private routes (redirect to login if not authenticated)
const privateRoutes: RouteObject[] = [
  {
    path: '/onboarding',
    Component: lazy(() => import('./pages/OnboardingPage'))
  },
  {
    path: '/profile',
    Component: lazy(() => import('./pages/ProfilePage'))
  },
  {
    path: '/progress',
    Component: lazy(() => import('./pages/ProgressPage'))
  },
  {
    path: '/foods/mine',
    Component: lazy(() => import('./pages/PersonalFoodsPage'))
  },
  {
    path: '/foods/submissions',
    Component: lazy(() => import('./pages/FoodSubmissionsPage'))
  },
  {
    path: '/foods/moderation',
    Component: lazy(() => import('./pages/FoodModerationPage'))
  }
];

export const router = createBrowserRouter([{
  Component: OnboardingGate,
  children: [
    ...publicRoutes,
    { Component: GuestRoute, children: guestRoutes },
    { Component: PrivateRoute, children: privateRoutes },
  ],
}]);
