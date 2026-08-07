import assert from 'node:assert/strict';
import test from 'node:test';
import { isModerationAccessError, personalFoodInputFromLookup, type BarcodeLookup } from '../src/client/lib/foods';

const offLookup: BarcodeLookup = {
  status: 'found',
  normalizedBarcode: '4006381333931',
  source: 'open-food-facts',
  warnings: [],
  importToken: '123e4567-e89b-12d3-a456-426614174000',
  food: {
    id: 'off:4006381333931',
    source: 'open-food-facts',
    name: 'Тестовый продукт',
    category: 'Другое',
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
    unit: 'г',
    barcode: '4006381333931',
    isVerified: false,
  },
};

test('confirmed OFF lookup carries its opaque import token into personal creation', () => {
  assert.deepEqual(personalFoodInputFromLookup(offLookup), {
    name: 'Тестовый продукт',
    brand: undefined,
    category: 'Другое',
    calories: 100,
    protein: 5,
    carbs: 12,
    fat: 3,
    unit: 'г',
    barcode: '4006381333931',
    importToken: '123e4567-e89b-12d3-a456-426614174000',
  });
});

test('OFF-shaped manual data without a server token cannot claim imported provenance', () => {
  assert.equal(personalFoodInputFromLookup({ ...offLookup, importToken: undefined }), null);
});

test('moderation access errors are distinct from retryable transport failures', () => {
  assert.equal(isModerationAccessError(Object.assign(new Error('Недостаточно прав для модерации продуктов'), { status: 403, code: 'FORBIDDEN' })), true);
  assert.equal(isModerationAccessError(new Error('Требуется вход в аккаунт')), true);
  assert.equal(isModerationAccessError(Object.assign(new Error('Service unavailable'), { status: 503 })), false);
  assert.equal(isModerationAccessError(new TypeError('Failed to fetch')), false);
});
