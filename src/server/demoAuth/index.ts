import { getConfig, Module } from 'modelence/server';
import { isDemoEnvironment, type DemoCredentials } from '@/shared/demoAuth';

/**
 * Local convenience only. The credentials are server-only configuration and
 * this query returns nothing in a production environment.
 */
export default new Module('demoAuth', {
  configSchema: {
    email: {
      type: 'string',
      default: 'demo@modelence.dev',
      isPublic: false,
    },
    password: {
      type: 'secret',
      default: '12345678',
      isPublic: false,
    },
  },

  queries: {
    getLocalCredentials: async (): Promise<DemoCredentials | null> => {
      const envType = getConfig('_system.env.type');
      if (!isDemoEnvironment(envType, process.env.NODE_ENV === 'production')) {
        return null;
      }

      const email = String(getConfig('demoAuth.email') ?? '');
      const password = String(getConfig('demoAuth.password') ?? '');
      return email && password ? { email, password } : null;
    },
  },
});
