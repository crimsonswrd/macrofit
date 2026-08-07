import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('responsive shell keeps mobile navigation fixed, safe and route-aware', async () => {
  const page = await source('src/client/components/Page.tsx');

  assert.match(page, /pathname\.startsWith\('\/foods\/'\)/);
  assert.match(page, /className="fixed inset-x-0 bottom-0[^"]*safe-area-inset-bottom[^"]*lg:hidden"/);
  assert.match(page, /pb-\[calc\(4rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-0/);
  assert.match(page, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(page, /focus-visible:ring-flame-500/);
});

test('owned navigation buttons use polymorphic rendering instead of nested controls', async () => {
  const paths = [
    'src/client/components/Page.tsx',
    'src/client/pages/HomePage.tsx',
    'src/client/pages/ProfilePage.tsx',
    'src/client/pages/LogoutPage.tsx',
    'src/client/pages/NotFoundPage.tsx',
  ];
  const combined = (await Promise.all(paths.map(source))).join('\n');

  assert.doesNotMatch(combined, /<Link[^>]*>\s*<Button/);
  assert.match(combined, /render=\{<Link to="\/signup"/);
});

test('dark controls and diary/profile failure states remain accessible', async () => {
  const [select, dialog, sizes, home, summary, profile, logout] = await Promise.all([
    source('src/client/components/ui/Select.tsx'),
    source('src/client/components/ui/Dialog.tsx'),
    source('src/client/components/ui/_shared/sizes.ts'),
    source('src/client/pages/HomePage.tsx'),
    source('src/client/components/nutrition/DaySummary.tsx'),
    source('src/client/pages/ProfilePage.tsx'),
    source('src/client/pages/LogoutPage.tsx'),
  ]);

  assert.match(select, /border-mist-2 bg-paper text-left text-ink/);
  assert.match(dialog, /aria-label="Закрыть"/);
  assert.match(sizes, /sm: "h-11[^"]*lg:h-8"/);
  assert.match(home, /retry: 2/);
  assert.match(home, /Не удалось загрузить дневник/);
  assert.match(home, /Ваш ориентир на эту дату/);
  assert.match(summary, /role="progressbar"/);
  assert.match(summary, /aria-valuetext/);
  assert.match(profile, /Не удалось загрузить профиль/);
  assert.match(profile, /Не удалось загрузить историю целей/);
  assert.match(logout, /Повторить выход/);
  assert.match(logout, /onClick=\{\(\) => void performLogout\(\)\}/);
});

test('bcrypt is declared as a direct runtime dependency', async () => {
  const packageJson = JSON.parse(await source('package.json')) as {
    dependencies?: Record<string, string>;
  };
  const packageLock = JSON.parse(await source('package-lock.json')) as {
    packages?: Record<string, { dependencies?: Record<string, string> }>;
  };

  assert.equal(packageJson.dependencies?.bcrypt, '^6.0.0');
  assert.equal(packageLock.packages?.['']?.dependencies?.bcrypt, '^6.0.0');
});
