import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseNumberFieldDraft } from '../src/client/lib/profile.ts';

test('number fields preserve an empty editing draft instead of coercing it to zero', async () => {
  assert.equal(parseNumberFieldDraft(''), undefined);
  assert.equal(parseNumberFieldDraft('182'), 182);
  assert.equal(parseNumberFieldDraft('78.4'), 78.4);

  const page = await readFile(new URL('../src/client/pages/OnboardingPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /value=\{draft\}/);
  assert.match(page, /setDraft\(nextDraft\)/);
  assert.doesNotMatch(page, /event\.target\.value === '' \? 0/);
});

test('optional numeric fields clear their model value while required fields remain browser-validated', async () => {
  const page = await readFile(new URL('../src/client/pages/OnboardingPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /onClear=\{\(\) => update\('goalWeightKg', undefined\)\}/);
  assert.match(page, /required=\{required\}/);
});
