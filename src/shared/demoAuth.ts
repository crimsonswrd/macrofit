export type DemoCredentials = {
  email: string;
  password: string;
};

export function isDemoEnvironment(envType: unknown, isProduction: boolean): boolean {
  return envType === 'sandbox' || !isProduction;
}
