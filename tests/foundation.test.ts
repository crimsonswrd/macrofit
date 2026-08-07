import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isDemoEnvironment } from '../src/shared/demoAuth.ts';

test('demo authentication is restricted to sandbox or local development', () => {
  assert.equal(isDemoEnvironment('sandbox', true), true);
  assert.equal(isDemoEnvironment('', false), true);
  assert.equal(isDemoEnvironment('production', true), false);
  assert.equal(isDemoEnvironment(undefined, true), false);
});

test('demo password is never declared as public client configuration', async () => {
  const moduleSource = await readFile(new URL('../src/server/demoAuth/index.ts', import.meta.url), 'utf8');
  const migrationSource = await readFile(
    new URL('../src/server/migrations/demoAuth.ts', import.meta.url),
    'utf8',
  );
  const passwordConfig = moduleSource.match(/password:\s*\{([\s\S]*?)\n\s*\},/);

  assert.ok(passwordConfig, 'demo password config must exist');
  assert.match(passwordConfig[1], /type:\s*'secret'/);
  assert.match(passwordConfig[1], /isPublic:\s*false/);
  assert.match(moduleSource, /new Module\('demoAuth'/);
  assert.match(moduleSource, /if \(!isDemoEnvironment\([\s\S]*?return null;/);
  assert.match(migrationSource, /disableProductionDemoUser/);
  assert.match(migrationSource, /if \(isDemoEnvironment\([\s\S]*?return;/);
});

test('foundation declares a dark color scheme and reduced-motion fallback', async () => {
  const css = await readFile(new URL('../src/client/index.css', import.meta.url), 'utf8');
  const html = await readFile(new URL('../src/client/index.html', import.meta.url), 'utf8');

  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(html, /<html lang="ru"/);
  assert.match(html, /name="theme-color" content="#0d0f0e"/);
});

test('foundation text tokens meet WCAG AA contrast on app surfaces', () => {
  assert.ok(contrastRatio('#f4f1e8', '#0d0f0e') >= 4.5);
  assert.ok(contrastRatio('#a2a69f', '#0d0f0e') >= 4.5);
  assert.ok(contrastRatio('#a2a69f', '#171918') >= 4.5);
  assert.ok(contrastRatio('#e94840', '#171918') >= 4.5);
  assert.ok(contrastRatio('#0d0f0e', '#ff5a4f') >= 4.5);
  assert.ok(contrastRatio('#0d0f0e', '#f4f1e8') >= 4.5);
});

test('selected food controls use high-contrast dark text and touch-safe heights', async () => {
  const [addFood, editEntry, foodsPage, personalFoods, submissions] = await Promise.all([
    readFile(new URL('../src/client/components/nutrition/AddFoodDialog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/components/nutrition/EditDiaryEntryDialog.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/pages/FoodsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/pages/PersonalFoodsPage.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/pages/FoodSubmissionsPage.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(addFood, /tabnum min-h-11 rounded-full/);
  assert.match(addFood, /border-flame-500 bg-flame-500 text-mist/);
  assert.match(editEntry, /min-h-11 rounded-lg/);
  assert.match(editEntry, /border-flame-500 bg-flame-500 text-mist/);
  assert.match(addFood, /border-ink bg-ink text-mist/);
  assert.match(foodsPage, /border-ink bg-ink text-mist/);
  assert.doesNotMatch(`${addFood}\n${editEntry}\n${foodsPage}`, /bg-(?:ink|flame-500) text-white/);
  for (const source of [foodsPage, personalFoods, submissions]) {
    assert.match(source, /overflow-x-auto border-b/);
    assert.match(source, /min-h-11 shrink-0 items-center/);
  }
});

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g);
  assert.ok(channels);
  const [red, green, blue] = channels.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
