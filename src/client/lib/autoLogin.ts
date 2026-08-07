import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { useSession, getConfig, loginWithPassword } from 'modelence/client';
import { isDemoEnvironment, type DemoCredentials } from '@/shared/demoAuth';

const AUTO_LOGIN_DISABLED_KEY = 'modelence:autoLoginDisabled';

export function useAutoLogin() {
  const { user } = useSession();
  const attemptedRef = useRef(false);
  const envType = getConfig('_system.env.type');
  const demoEnabled = isDemoEnvironment(envType, import.meta.env.PROD);
  const { data: credentials } = useQuery({
    ...modelenceQuery<DemoCredentials | null>('demoAuth.getLocalCredentials', {}),
    enabled: demoEnabled && !user,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!demoEnabled || user || !credentials || attemptedRef.current) {
      return;
    }
    if (localStorage.getItem(AUTO_LOGIN_DISABLED_KEY)) {
      return;
    }

    attemptedRef.current = true;
    loginWithPassword(credentials).then(() => {
      localStorage.setItem(AUTO_LOGIN_DISABLED_KEY, '1');
    }).catch(() => {
      attemptedRef.current = false;
    });
  }, [credentials, demoEnabled, user]);
}
