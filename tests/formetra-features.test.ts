import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildFoodSuggestions, defaultMealForHour } from '../src/client/lib/foodSuggestions.ts';
import { normalizeInterfaceMode, normalizeReminderSettings } from '../src/client/lib/preferences.ts';
import { buildSmartReminder, pressureFreeStatus } from '../src/client/lib/wellbeing.ts';
import type { DayData, Food } from '../src/client/lib/nutrition.ts';

const food = (name: string, calories: number, protein: number, carbs: number, fat: number): Food => ({
  id: name,
  source: 'catalog',
  name,
  category: 'Тест',
  calories,
  protein,
  carbs,
  fat,
  unit: 'г',
  isVerified: true,
});

const foods = [
  food('Куриная грудка, отварная', 137, 29.8, 0, 1.8),
  food('Рис белый отварной', 116, 2.2, 25, 0.5),
  food('Индейка, филе грудки (сырая)', 104, 24, 0, 0.7),
  food('Гречка отварная', 110, 4.2, 21.3, 1.1),
  food('Творог 5%', 121, 17.2, 1.8, 5),
  food('Тунец консервированный в с/с', 116, 25.5, 0, 0.8),
  food('Хлеб цельнозерновой', 247, 13, 41, 3.4),
  food('Греческий йогурт 2%', 73, 10, 3.6, 2),
  food('Банан', 89, 1.1, 22.8, 0.3),
  food('Яйцо куриное целое', 143, 12.6, 0.7, 9.5),
];

const day = (overrides: Partial<DayData> = {}): DayData => ({
  date: '2026-08-06',
  items: [],
  totals: { calories: 800, protein: 55, carbs: 90, fat: 25 },
  targets: { calories: 2200, protein: 150, carbs: 260, fat: 70 },
  ...overrides,
});

test('food navigator returns one confirmed-size option for each usage context', () => {
  const suggestions = buildFoodSuggestions(foods, day().totals, day().targets);
  assert.deepEqual(suggestions.map((item) => item.kind), ['balanced', 'protein', 'quick']);
  assert.ok(suggestions.every((item) => item.parts.length > 0));
  assert.ok(suggestions.every((item) => item.parts.every((part) => part.grams > 0)));
  assert.ok(suggestions.every((item) => item.totals.calories > 0));
});

test('food navigator chooses the current meal without asking unnecessary questions', () => {
  assert.equal(defaultMealForHour(8), 'breakfast');
  assert.equal(defaultMealForHour(13), 'lunch');
  assert.equal(defaultMealForHour(18), 'dinner');
  assert.equal(defaultMealForHour(22), 'snack');
});

test('pressure-free copy treats empty and high-calorie days without judgement', () => {
  assert.match(pressureFreeStatus(day({ items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } })).message, /не плохой результат/);
  const high = pressureFreeStatus(day({
    items: [{ id: '1', meal: 'dinner', foodId: '1', foodName: 'Ужин', unit: 'г', grams: 100, calories: 2600, protein: 130, carbs: 300, fat: 90, caloriesPer100: 2600, proteinPer100: 130, carbsPer100: 300, fatPer100: 90 }],
    totals: { calories: 2600, protein: 130, carbs: 300, fat: 90 },
  }));
  assert.equal(high.title, 'Ничего компенсировать не нужно');
  assert.doesNotMatch(high.message, /срыв|провал|наказ/i);
});

test('smart reminder reacts to context and user-configured times', () => {
  const settings = normalizeReminderSettings({ firstCheckTime: '09:00', eveningCheckTime: '18:00' });
  const empty = buildSmartReminder(day({ items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }), new Date(2026, 7, 6, 10, 0), settings);
  assert.equal(empty?.action, 'add');
  const evening = buildSmartReminder(day({ items: [{ id: '1', meal: 'lunch' } as DayData['items'][number]] }), new Date(2026, 7, 6, 20, 0), settings);
  assert.equal(evening?.action, 'suggest');
});

test('interface and reminder preferences fail safely to beginner-friendly defaults', () => {
  assert.equal(normalizeInterfaceMode('unknown'), 'simple');
  assert.equal(normalizeInterfaceMode('sport'), 'sport');
  const normalized = normalizeReminderSettings({ firstCheckTime: '99:99', weeklyWeighDay: '8' });
  assert.equal(normalized.firstCheckTime, '10:30');
  assert.equal(normalized.weeklyWeighDay, '1');
});

test('PWA manifest exposes standalone install assets and Russian product identity', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/client/public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'FORMETRA');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon: { sizes: string; purpose?: string }) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
});
