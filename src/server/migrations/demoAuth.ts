import bcrypt from 'bcrypt';
import { dbUsers, getConfig } from 'modelence/server';
import { isDemoEnvironment } from '@/shared/demoAuth';

const LEGACY_DEMO_EMAIL = 'demo@modelence.dev';

export async function createDemoUser() {
  const envType = getConfig('_system.env.type');
  if (!isDemoEnvironment(envType, process.env.NODE_ENV === 'production')) {
    return;
  }

  const email = String(getConfig('demoAuth.email') ?? '');
  const password = String(getConfig('demoAuth.password') ?? '');
  if (!email || !password) {
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await dbUsers.insertOne({
    handle: email,
    status: 'active',
    emails: [{ address: email, verified: true }],
    createdAt: new Date(),
    authMethods: { password: { hash } },
  });
}

export async function disableProductionDemoUser() {
  const envType = getConfig('_system.env.type');
  if (isDemoEnvironment(envType, process.env.NODE_ENV === 'production')) {
    return;
  }

  await dbUsers.updateOne(
    { handle: LEGACY_DEMO_EMAIL, status: 'active' },
    { $set: { status: 'disabled', disabledAt: new Date() } },
  );
}
