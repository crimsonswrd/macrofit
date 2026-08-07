import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBarcodeCheckDigit, normalizeBarcode } from '../src/server/foods/barcode.ts';
import {
  fetchOpenFoodFacts,
  OPEN_FOOD_FACTS_SOURCE,
  OPEN_FOOD_FACTS_USER_AGENT,
  OpenFoodFactsRateLimitError,
  parseRetryAfterMs,
  parseOpenFoodFactsResponse,
} from '../src/server/foods/openFoodFacts.ts';
import {
  applyConfirmedOffImport,
  confirmedOffImport,
  isRetrySafeDecision,
  requireFoodModerator,
  ownerScopedPersonalFoodSelector,
} from '../src/server/foods/service.ts';
import { uniqueRecentFoodRefs } from '../src/server/nutrition/recent.ts';
import { ExternalRequestScheduler, OFF_MAX_RETRY_AFTER_MS } from '../src/server/foods/requestScheduler.ts';
import { pendingSubmissionUpsert, resolveApprovedRetry } from '../src/server/foods/submission.ts';
import type { UserInfo } from 'modelence/server';
import { ObjectId } from 'modelence/server';

test('barcode validation accepts EAN-8/EAN-13 and canonicalizes UPC-A', () => {
  assert.deepEqual(normalizeBarcode('9638 5074'), { value: '96385074', kind: 'ean-8' });
  assert.deepEqual(normalizeBarcode('4006381333931'), { value: '4006381333931', kind: 'ean-13' });
  assert.deepEqual(normalizeBarcode('036000-291452'), { value: '0036000291452', kind: 'upc-a' });
  assert.equal(normalizeBarcode('4006381333932'), null);
  assert.equal(normalizeBarcode('1234567'), null);
  assert.equal(normalizeBarcode('40063813339x1'), null);
  assert.equal(calculateBarcodeCheckDigit('400638133393'), 1);
});

test('Open Food Facts parser returns a complete attributed food', () => {
  const result = parseOpenFoodFactsResponse('4006381333931', {
    status: 'success',
    product: {
      product_name_ru: 'Тестовый батончик',
      product_name: 'Test bar',
      brands: 'Example',
      categories: 'Снэки, Батончики',
      nutriments: {
        'energy-kcal_100g': 412,
        proteins_100g: 8.2,
        carbohydrates_100g: 64,
        fat_100g: 14.5,
      },
    },
  });

  assert.equal(result.status, 'found');
  assert.equal(result.food?.name, 'Тестовый батончик');
  assert.equal(result.food?.dataSource, OPEN_FOOD_FACTS_SOURCE);
  assert.equal(result.food?.isVerified, false);
  assert.equal(result.food?.source, 'open-food-facts');
});

test('Open Food Facts parser distinguishes not-found and incomplete products', () => {
  assert.equal(
    parseOpenFoodFactsResponse('4006381333931', { result: { id: 'product_not_found' } }).status,
    'not_found',
  );
  const incomplete = parseOpenFoodFactsResponse('4006381333931', {
    product: { product_name: 'Без макросов', nutriments: { proteins_100g: 2 } },
  });
  assert.equal(incomplete.status, 'incomplete');
  assert.equal(incomplete.food, undefined);
  assert.ok(incomplete.warnings.some((warning) => warning.includes('энергетическая')));
});

test('Open Food Facts fetch uses v3, minimal fields, custom User-Agent and parses JSON', async () => {
  let requestedUrl = '';
  let requestedHeaders: HeadersInit | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedHeaders = init?.headers;
    return new Response(
      JSON.stringify({
        product: {
          product_name: 'Mock product',
          nutriments: {
            'energy-kcal_100g': 100,
            proteins_100g: 10,
            carbohydrates_100g: 12,
            fat_100g: 2,
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const result = await fetchOpenFoodFacts('4006381333931', { fetcher, timeoutMs: 100 });
  assert.equal(result.status, 'found');
  assert.match(requestedUrl, /\/api\/v3\/product\/4006381333931\?fields=/);
  assert.match(requestedUrl, /product_name/);
  assert.doesNotMatch(requestedUrl, /images/);
  assert.equal(new Headers(requestedHeaders).get('User-Agent'), OPEN_FOOD_FACTS_USER_AGENT);
});

test('Open Food Facts fetch returns explicit not-found for HTTP 404', async () => {
  const fetcher: typeof fetch = async () => new Response('', { status: 404 });
  const result = await fetchOpenFoodFacts('4006381333931', { fetcher });
  assert.deepEqual(result, {
    status: 'not_found',
    normalizedBarcode: '4006381333931',
    source: 'open-food-facts',
    warnings: [],
  });
});

test('Open Food Facts exposes bounded Retry-After data for scheduler retry', async () => {
  const fetcher: typeof fetch = async () =>
    new Response('', { status: 429, headers: { 'Retry-After': '9' } });
  await assert.rejects(
    fetchOpenFoodFacts('4006381333931', { fetcher }),
    (error: unknown) =>
      error instanceof OpenFoodFactsRateLimitError && error.retryAfterMs === 9_000,
  );
});

test('OFF scheduler spaces uncached requests by four seconds and deduplicates the same barcode', async () => {
  let now = 0;
  const sleeps: number[] = [];
  const starts: number[] = [];
  const scheduler = new ExternalRequestScheduler(
    {
      now: () => now,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        now += milliseconds;
      },
    },
    4_000,
  );
  let duplicateRan = false;
  const first = scheduler.schedule('barcode-a', async () => {
    starts.push(now);
    return 'first';
  });
  const duplicate = scheduler.schedule('barcode-a', async () => {
    duplicateRan = true;
    return 'duplicate';
  });
  const second = scheduler.schedule('barcode-b', async () => {
    starts.push(now);
    return 'second';
  });

  assert.deepEqual(await Promise.all([first, duplicate, second]), ['first', 'first', 'second']);
  assert.equal(duplicateRan, false);
  assert.deepEqual(starts, [0, 4_000]);
  assert.deepEqual(sleeps, [4_000]);
});

test('OFF scheduler retries 429 once with bounded Retry-After handling', async () => {
  let now = 0;
  const starts: number[] = [];
  const scheduler = new ExternalRequestScheduler({
    now: () => now,
    sleep: async (milliseconds) => {
      now += milliseconds;
    },
  });
  let attempts = 0;
  const result = await scheduler.schedule(
    'rate-limited',
    async () => {
      starts.push(now);
      attempts += 1;
      if (attempts === 1) throw new OpenFoodFactsRateLimitError(120_000);
      return 'ok';
    },
    (error) => (error instanceof OpenFoodFactsRateLimitError ? error.retryAfterMs : null),
  );
  assert.equal(result, 'ok');
  assert.deepEqual(starts, [0, OFF_MAX_RETRY_AFTER_MS]);
  assert.equal(parseRetryAfterMs('7', 0), 7_000);
  assert.equal(parseRetryAfterMs('invalid', 0), 4_000);
});

test('personal and catalog recent references remain separate and legacy defaults to catalog', () => {
  const sharedId = '507f1f77bcf86cd799439011';
  assert.deepEqual(
    uniqueRecentFoodRefs([
      { foodId: sharedId, foodSource: 'personal' },
      { foodId: sharedId },
      { foodId: sharedId.toUpperCase(), foodSource: 'personal' },
    ]),
    [
      { id: sharedId, source: 'personal' },
      { id: sharedId, source: 'catalog' },
    ],
  );
});

test('moderation retries are idempotent only for the same terminal decision', () => {
  assert.equal(isRetrySafeDecision('approved', 'approved'), true);
  assert.equal(isRetrySafeDecision('rejected', 'rejected'), true);
  assert.equal(isRetrySafeDecision('approved', 'rejected'), false);
  assert.equal(isRetrySafeDecision('withdrawn', 'approved'), false);
  assert.equal(isRetrySafeDecision('pending', 'approved'), false);
});

test('fully published approval retry is a true no-op preserving all fields', async () => {
  const approved = {
    status: 'approved' as const,
    approvedCatalogFoodId: 'catalog-id',
    reviewNote: 'original',
    reviewedBy: 'first-moderator',
  };
  let writes = 0;
  const result = await resolveApprovedRetry(approved, async (submission) => {
    writes += 1;
    return { ...submission, reviewNote: 'changed' };
  });
  assert.equal(result, approved);
  assert.equal(writes, 0);
  assert.equal(result.reviewNote, 'original');
  assert.equal(result.reviewedBy, 'first-moderator');
});

test('approved submission missing publication uses the repair seam exactly once', async () => {
  const incomplete: {
    status: 'approved';
    reviewNote: string;
    approvedCatalogFoodId?: string;
  } = { status: 'approved', reviewNote: 'kept' };
  let writes = 0;
  const result = await resolveApprovedRetry(incomplete, async (submission) => {
    writes += 1;
    return { ...submission, approvedCatalogFoodId: 'repaired' };
  });
  assert.equal(writes, 1);
  assert.equal(result.approvedCatalogFoodId, 'repaired');
  assert.equal(result.reviewNote, 'kept');
});

test('pending submission upsert is deterministic and immutable after insertion', () => {
  const first = pendingSubmissionUpsert('507F1F77BCF86CD799439011', { name: 'Snapshot', calories: 100 });
  const second = pendingSubmissionUpsert('507f1f77bcf86cd799439011', { name: 'Changed', calories: 200 });
  assert.deepEqual(first.selector, second.selector);
  assert.equal('$set' in first.update, false);
  assert.equal(first.update.$setOnInsert.name, 'Snapshot');
  assert.equal(first.update.$setOnInsert.status, 'pending');
});

test('OFF import requires an owner-bound unexpired unused token', () => {
  const now = new Date('2026-08-05T12:00:00Z');
  const ownerId = new ObjectId('507f191e810c19729de860ea');
  const cache = {
    barcode: '4006381333931',
    status: 'found',
    name: 'Канонический продукт',
    category: 'Батончики',
    calories: 412,
    protein: 8.2,
    carbs: 64,
    fat: 14.5,
    unit: 'г',
    expiresAt: new Date('2026-08-06T12:00:00Z'),
    dataSource: OPEN_FOOD_FACTS_SOURCE,
    warnings: ['Проверить этикетку'],
  };
  const grant = {
    barcode: cache.barcode,
    importToken: 'trusted-token',
    ownerId,
    expiresAt: cache.expiresAt,
  };
  assert.equal(confirmedOffImport(cache, grant, cache.barcode, 'wrong-token', ownerId, now), null);
  assert.equal(
    confirmedOffImport(cache, { ...grant, usedAt: now }, cache.barcode, grant.importToken, ownerId, now),
    null,
  );
  assert.ok(confirmedOffImport(cache, grant, cache.barcode, grant.importToken, ownerId, now));
});

test('OFF import uses the owner-bound canonical cache snapshot instead of fabricated macros', () => {
  const now = new Date('2026-08-05T12:00:00Z');
  const ownerId = new ObjectId('507f191e810c19729de860ea');
  const cache = {
    barcode: '4006381333931',
    status: 'found',
    name: 'Канонический продукт',
    brand: 'OFF Brand',
    category: 'Батончики',
    calories: 412,
    protein: 8.2,
    carbs: 64,
    fat: 14.5,
    unit: 'г',
    expiresAt: new Date('2026-08-06T12:00:00Z'),
    dataSource: OPEN_FOOD_FACTS_SOURCE,
    warnings: ['Проверить этикетку'],
  };
  const grant = {
    barcode: cache.barcode,
    importToken: 'trusted-token',
    ownerId,
    expiresAt: cache.expiresAt,
  };

  const confirmed = confirmedOffImport(cache, grant, cache.barcode, grant.importToken, ownerId, now);
  const fabricated = {
    name: 'Поддельный продукт',
    brand: 'Fake Brand',
    category: 'Другое',
    calories: 1,
    protein: 99,
    carbs: 0,
    fat: 0,
    unit: 'мл' as const,
    barcode: cache.barcode,
  };
  assert.deepEqual(applyConfirmedOffImport(fabricated, confirmed), {
    name: cache.name,
    brand: cache.brand,
    category: cache.category,
    calories: cache.calories,
    protein: cache.protein,
    carbs: cache.carbs,
    fat: cache.fat,
    unit: cache.unit,
    barcode: cache.barcode,
  });
  assert.equal(
    confirmedOffImport(
      cache,
      grant,
      cache.barcode,
      grant.importToken,
      new ObjectId('507f1f77bcf86cd799439011'),
      now,
    ),
    null,
  );
});

test('food moderator authorization uses the installed Modelence role API', () => {
  const user = (roles: string[]): UserInfo => ({
    id: '507f1f77bcf86cd799439011',
    handle: 'tester',
    roles,
    hasRole: (role) => roles.includes(role),
    requireRole: () => undefined,
  });
  assert.equal(requireFoodModerator(user(['foodModerator'])).handle, 'tester');
  assert.throws(() => requireFoodModerator(user([])), /Недостаточно прав/);
  assert.throws(() => requireFoodModerator(null), /Требуется вход/);
});

test('personal-food selectors always carry the authenticated owner boundary', () => {
  const foodId = new ObjectId('507f1f77bcf86cd799439011');
  const ownerId = new ObjectId('507f191e810c19729de860ea');
  const active = ownerScopedPersonalFoodSelector(foodId, ownerId);
  assert.equal(active._id, foodId);
  assert.equal(active.ownerId, ownerId);
  assert.deepEqual(active.deletedAt, { $exists: false });
  const includingArchived = ownerScopedPersonalFoodSelector(foodId, ownerId, false);
  assert.equal(includingArchived.ownerId, ownerId);
  assert.equal('deletedAt' in includingArchived, false);
});
