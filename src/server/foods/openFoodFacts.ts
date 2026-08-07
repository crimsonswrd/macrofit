import type { BarcodeLookupResult, Food } from '@/shared/contracts/food';

export const OPEN_FOOD_FACTS_SOURCE = 'Open Food Facts (ODbL)';
export const OPEN_FOOD_FACTS_USER_AGENT = 'MacroFit/0.1.1 (https://modelence.com)';
export const OPEN_FOOD_FACTS_TIMEOUT_MS = 4_000;

export class OpenFoodFactsRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Open Food Facts rate limit reached');
  }
}

type FetchLike = typeof fetch;

type OffProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_ru?: unknown;
  brands?: unknown;
  categories?: unknown;
  nutriments?: Record<string, unknown>;
};

type OffResponse = {
  status?: unknown;
  result?: { id?: unknown };
  product?: OffProduct;
};

function finiteNonNegative(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number {
  if (!value) return 4_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - nowMs) : 4_000;
}

export function parseOpenFoodFactsResponse(
  barcode: string,
  payload: unknown,
): BarcodeLookupResult {
  const response = payload && typeof payload === 'object' ? (payload as OffResponse) : {};
  if (response.status === 0 || response.result?.id === 'product_not_found' || !response.product) {
    return { status: 'not_found', normalizedBarcode: barcode, source: 'open-food-facts', warnings: [] };
  }

  const product = response.product;
  const nutriments = product.nutriments ?? {};
  const name = textValue(product.product_name_ru) ?? textValue(product.product_name);
  const caloriesKcal = finiteNonNegative(nutriments['energy-kcal_100g']);
  const energyKj = finiteNonNegative(nutriments['energy-kj_100g']);
  const calories = caloriesKcal ?? (energyKj === null ? null : energyKj / 4.184);
  const protein = finiteNonNegative(nutriments.proteins_100g);
  const carbs = finiteNonNegative(nutriments.carbohydrates_100g);
  const fat = finiteNonNegative(nutriments.fat_100g);

  const warnings: string[] = [];
  if (!name) warnings.push('В Open Food Facts отсутствует название продукта.');
  if (calories === null) warnings.push('В Open Food Facts отсутствует энергетическая ценность на 100 г.');
  if (protein === null) warnings.push('В Open Food Facts отсутствует белок на 100 г.');
  if (carbs === null) warnings.push('В Open Food Facts отсутствуют углеводы на 100 г.');
  if (fat === null) warnings.push('В Open Food Facts отсутствуют жиры на 100 г.');

  if (!name || calories === null || protein === null || carbs === null || fat === null) {
    return {
      status: 'incomplete',
      normalizedBarcode: barcode,
      source: 'open-food-facts',
      warnings,
    };
  }

  const food: Food = {
    id: `off:${barcode}`,
    source: 'open-food-facts',
    name,
    brand: textValue(product.brands),
    category: textValue(product.categories)?.split(',')[0]?.trim() || 'Другое',
    calories: Math.round(calories * 10) / 10,
    protein,
    carbs,
    fat,
    unit: 'г',
    barcode,
    isVerified: false,
    dataSource: OPEN_FOOD_FACTS_SOURCE,
    dataQualityWarnings: warnings,
  };

  return {
    status: 'found',
    food,
    normalizedBarcode: barcode,
    source: 'open-food-facts',
    warnings,
  };
}

export async function fetchOpenFoodFacts(
  barcode: string,
  options: { fetcher?: FetchLike; timeoutMs?: number } = {},
): Promise<BarcodeLookupResult> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? OPEN_FOOD_FACTS_TIMEOUT_MS);
  const fields = 'code,product_name,product_name_ru,brands,categories,nutriments';

  try {
    const response = await fetcher(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=${fields}`,
      {
        headers: { 'User-Agent': OPEN_FOOD_FACTS_USER_AGENT, Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (response.status === 404) {
      return { status: 'not_found', normalizedBarcode: barcode, source: 'open-food-facts', warnings: [] };
    }
    if (response.status === 429) {
      throw new OpenFoodFactsRateLimitError(parseRetryAfterMs(response.headers.get('Retry-After')));
    }
    if (!response.ok) throw new Error(`Open Food Facts responded with HTTP ${response.status}`);
    return parseOpenFoodFactsResponse(barcode, await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
