import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy example backend surface is removed and demo auth stays narrowly scoped', async () => {
  await assert.rejects(access(new URL('../src/server/example/index.ts', import.meta.url)));
  await assert.rejects(access(new URL('../src/server/example/db.ts', import.meta.url)));
  await assert.rejects(access(new URL('../src/server/example/cron.ts', import.meta.url)));

  const [app, demoAuth, autoLogin, login] = await Promise.all([
    source('src/server/app.ts'),
    source('src/server/demoAuth/index.ts'),
    source('src/client/lib/autoLogin.ts'),
    source('src/client/pages/LoginPage.tsx'),
  ]);
  assert.doesNotMatch(app, /exampleModule|server\/example/);
  assert.match(app, /demoAuthModule/);
  assert.doesNotMatch(demoAuth, /stores:|mutations:|cronJobs:|isPublic:\s*true/);
  assert.match(demoAuth, /demoAuth\.getLocalCredentials|getLocalCredentials/);
  assert.match(autoLogin, /demoAuth\.getLocalCredentials/);
  assert.match(login, /demoAuth\.getLocalCredentials/);
  assert.doesNotMatch(`${autoLogin}\n${login}`, /demo@modelence\.dev|12345678/);
});

test('registration requires one explicit consent covering terms and privacy', async () => {
  const signup = await source('src/client/pages/SignupPage.tsx');
  assert.match(signup, /acceptedTerms/);
  assert.match(signup, /href="\/terms"\s+target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(signup, /href="\/privacy"\s+target="_blank"\s+rel="noopener noreferrer"/);
  assert.match(signup, /условия использования и политику конфиденциальности/);
});

test('legal pages explain scope, collected data, visibility, external lookup and retention', async () => {
  const [terms, privacy, router, page] = await Promise.all([
    source('src/client/pages/TermsPage.tsx'),
    source('src/client/pages/PrivacyPage.tsx'),
    source('src/client/router.tsx'),
    source('src/client/components/Page.tsx'),
  ]);

  assert.match(router, /path:\s*'\/privacy'/);
  assert.match(page, /to="\/terms"/);
  assert.match(page, /to="\/privacy"/);
  assert.match(terms, /здоровых взрослых от 18 лет/);
  assert.match(terms, /не ставят диагноз/);
  assert.match(terms, /Личный продукт доступен только владельцу/);
  assert.match(privacy, /параметры профиля и тела/);
  assert.match(privacy, /записи дневника/);
  assert.match(privacy, /историю взвешиваний/);
  assert.match(privacy, /часовой пояс/);
  assert.match(privacy, /Open Food Facts/);
  assert.match(privacy, /Фиксированный универсальный срок[^.]*не установлен/);
  assert.match(privacy, /не является медицинской системой/);
});
