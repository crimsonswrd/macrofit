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

test('runtime commands use the pinned package manager and Modelence production server', async () => {
  const packageJson = JSON.parse(await source('package.json')) as {
    scripts?: Record<string, string>;
    packageManager?: string;
    engines?: Record<string, string>;
  };

  assert.equal(packageJson.scripts?.start, 'modelence start');
  assert.equal(packageJson.scripts?.['db:local'], 'mongod --dbpath .local/mongodb-data --bind_ip 127.0.0.1 --port 27017');
  assert.equal(packageJson.scripts?.['dev:mobile'], 'pnpm --dir mobile start');
  assert.equal(packageJson.packageManager, 'pnpm@11.9.0');
  assert.equal(packageJson.engines?.node, '>=22.13');
});

test('root typecheck ignores nested standalone app templates', async () => {
  const tsconfig = await source('tsconfig.json');

  assert.match(tsconfig, /"my-app"/);
});

test('textarea follows FORMETRA dark form tokens', async () => {
  const textarea = await source('src/client/components/ui/Textarea.tsx');

  assert.match(textarea, /rounded-xl border border-mist-2 bg-paper/);
  assert.match(textarea, /text-ink/);
  assert.match(textarea, /placeholder:text-ink-3/);
  assert.match(textarea, /focus-visible:ring-flame-500/);
  assert.doesNotMatch(textarea, /gray-|blue-|bg-white/);
});

test('food search rows and dialogs constrain long text on small screens', async () => {
  const [dialog, addFood, foods, personalFoods, home, input, badge] = await Promise.all([
    source('src/client/components/ui/Dialog.tsx'),
    source('src/client/components/nutrition/AddFoodDialog.tsx'),
    source('src/client/pages/FoodsPage.tsx'),
    source('src/client/pages/PersonalFoodsPage.tsx'),
    source('src/client/pages/HomePage.tsx'),
    source('src/client/components/ui/Input.tsx'),
    source('src/client/components/foods/FoodStatusBadge.tsx'),
  ]);

  assert.match(dialog, /w-\[calc\(100%-2rem\)\] max-w-lg/);
  assert.match(input, /flex min-w-0 w-full/);
  assert.match(badge, /shrink-0 whitespace-nowrap/);
  assert.match(addFood, /min-w-0 flex-1/);
  assert.match(foods, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(foods, /min-w-0 truncate text-sm font-semibold text-ink/);
  assert.match(personalFoods, /min-w-0 truncate font-bold text-ink/);
  assert.match(home, /min-w-0 truncate font-display text-lg/);
});

test('Vite separates shared runtime dependencies from route chunks', async () => {
  const config = await source('vite.config.ts');

  assert.match(config, /manualChunks\(id\)/);
  assert.match(config, /react-vendor/);
  assert.match(config, /data-vendor/);
  assert.match(config, /modelence-vendor/);
  assert.match(config, /ui-vendor/);
  assert.match(config, /return 'icons'/);
});

test('initial app shell avoids unused tooltip and form-control dependencies', async () => {
  const [entry, router] = await Promise.all([
    source('src/client/index.tsx'),
    source('src/client/router.tsx'),
  ]);

  assert.doesNotMatch(entry, /TooltipProvider/);
  assert.doesNotMatch(router, /components\/ui\/Button/);
  assert.match(router, /type="button"/);
  assert.match(router, /Проверяем…/);
});

test('global loading state uses an accessible CSS spinner without loading icon packages', async () => {
  const spinner = await source('src/client/components/LoadingSpinner.tsx');

  assert.match(spinner, /role="status"/);
  assert.match(spinner, /animate-spin rounded-full border-2/);
  assert.doesNotMatch(spinner, /^import\s/m);
});
