import assert from 'node:assert/strict';
import test from 'node:test';
import {
  partitionFoodSections,
  scaleDiarySnapshot,
  type DiaryItem,
  type Food,
  type RecentFood,
} from '../src/client/lib/nutrition.ts';
import { uniqueRecentFoodIds } from '../src/server/nutrition/recent.ts';
import { scaleSnapshot, snapshotPer100 } from '../src/server/nutrition/snapshot.ts';
import {
  dateSchema,
  isCalendarDateKey,
  isObjectIdString,
  objectIdSchema,
} from '../src/server/nutrition/validation.ts';

test('calendar date validation rejects impossible dates and accepts leap days', () => {
  assert.equal(isCalendarDateKey('2024-02-29'), true);
  assert.equal(isCalendarDateKey('2023-02-29'), false);
  assert.equal(isCalendarDateKey('2026-04-31'), false);
  assert.equal(isCalendarDateKey('2026-13-01'), false);
  assert.equal(isCalendarDateKey('2026-8-05'), false);
  assert.equal(dateSchema.safeParse('2026-08-05').success, true);
  assert.equal(dateSchema.safeParse('2026-02-30').success, false);
});

test('identifier validation accepts only canonical 24-character hex ObjectIds', () => {
  assert.equal(isObjectIdString('507f1f77bcf86cd799439011'), true);
  assert.equal(isObjectIdString('507F1F77BCF86CD799439011'), true);
  assert.equal(isObjectIdString('not-an-object-id'), false);
  assert.equal(isObjectIdString('507f1f77bcf86cd79943901'), false);
  assert.equal(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success, true);
  assert.equal(objectIdSchema.safeParse('507f1f77bcf86cd79943901z').success, false);
});

test('portion edits rescale the immutable entry snapshot, not changed food macros', () => {
  const entry = {
    grams: 150,
    calories: 180,
    protein: 30,
    carbs: 12,
    fat: 6,
    caloriesPer100: 120,
    proteinPer100: 20,
    carbsPer100: 8,
    fatPer100: 4,
  };
  const changedFood = { calories: 999, protein: 99, carbs: 99, fat: 99 };

  const scaled = scaleSnapshot(snapshotPer100(entry), 250);
  assert.deepEqual(scaled, { calories: 300, protein: 50, carbs: 20, fat: 10 });
  assert.notDeepEqual(scaled, scaleSnapshot(changedFood, 250));
});

test('legacy entries derive a stable per-100 snapshot before their first edit', () => {
  const snapshot = snapshotPer100({
    grams: 40,
    calories: 100,
    protein: 8,
    carbs: 12,
    fat: 2,
  });
  assert.deepEqual(snapshot, { calories: 250, protein: 20, carbs: 30, fat: 5 });
  assert.deepEqual(scaleSnapshot(snapshot, 80), { calories: 200, protein: 16, carbs: 24, fat: 4 });
});

test('recent ids are unique, ordered by recency, and bounded', () => {
  assert.deepEqual(
    uniqueRecentFoodIds(
      [
        { foodId: 'b' },
        { foodId: 'a' },
        { foodId: 'b' },
        { foodId: 'c' },
      ],
      2,
    ),
    ['b', 'a'],
  );
});

test('recent dedupe canonicalizes ObjectId case and scans past repeated entries', () => {
  const repeated = Array.from({ length: 75 }, () => ({
    foodId: '507F1F77BCF86CD799439011',
  }));
  const entries = [
    ...repeated,
    { foodId: '507f1f77bcf86cd799439011' },
    { foodId: '507f191e810c19729de860ea' },
  ];
  assert.deepEqual(uniqueRecentFoodIds(entries), [
    '507f1f77bcf86cd799439011',
    '507f191e810c19729de860ea',
  ]);
});

test('edit preview uses the unrounded per-100 snapshot', () => {
  const item: DiaryItem = {
    id: 'entry',
    meal: 'breakfast',
    foodId: 'food',
    foodName: 'Тест',
    unit: 'г',
    grams: 30,
    calories: 37,
    protein: 3.7,
    carbs: 2.3,
    fat: 1.4,
    caloriesPer100: 123.4,
    proteinPer100: 12.34,
    carbsPer100: 7.89,
    fatPer100: 4.56,
  };

  const preview = scaleDiarySnapshot(item, 60);
  assert.equal(preview.calories, 74.04);
  assert.equal(preview.protein, 7.404);
  assert.equal(preview.carbs, 4.734);
  assert.ok(Math.abs(preview.fat - 2.736) < Number.EPSILON * 4);
  assert.notEqual(preview.calories, item.calories * 2);
});

test('recent and search sections never render the same food twice', () => {
  const makeFood = (id: string): Food => ({
    id,
    name: id,
    category: 'Тест',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 2,
    unit: 'г',
    isVerified: true,
  });
  const recent: RecentFood[] = [
    { ...makeFood('outside-first-40'), lastGrams: 75 },
    { ...makeFood('shared'), lastGrams: 100 },
    { ...makeFood('shared'), lastGrams: 150 },
  ];
  const foods = [makeFood('shared'), makeFood('search-only')];

  const sections = partitionFoodSections(recent, foods, true);
  assert.deepEqual(sections.recent.map((food) => food.id), ['outside-first-40', 'shared']);
  assert.deepEqual(sections.foods.map((food) => food.id), ['search-only']);
});
