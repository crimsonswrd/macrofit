import { AuthError, ValidationError } from 'modelence';
import { randomUUID } from 'node:crypto';
import { ObjectId, type UserInfo } from 'modelence/server';
import type { BarcodeLookupResult, Food, SubmissionStatus } from '@/shared/contracts/food';
import { dbFoods } from '@/server/nutrition/db';
import { normalizeBarcode } from './barcode';
import {
  dbBarcodeCache,
  dbBarcodeMappings,
  dbFoodImportGrants,
  dbFoodSubmissions,
  dbPersonalFoods,
} from './db';
import {
  fetchOpenFoodFacts,
  OpenFoodFactsRateLimitError,
  OPEN_FOOD_FACTS_SOURCE,
} from './openFoodFacts';
import { ExternalRequestScheduler } from './requestScheduler';

const FOUND_CACHE_MS = 7 * 24 * 60 * 60 * 1_000;
const INCOMPLETE_CACHE_MS = 24 * 60 * 60 * 1_000;
const NOT_FOUND_CACHE_MS = 6 * 60 * 60 * 1_000;
const externalScheduler = new ExternalRequestScheduler();

export function requireUser(user: UserInfo | null): UserInfo {
  if (!user) throw new AuthError('Требуется вход в аккаунт');
  return user;
}

export function requireFoodModerator(user: UserInfo | null): UserInfo {
  const currentUser = requireUser(user);
  if (!currentUser.hasRole('foodModerator')) {
    throw new AuthError('Недостаточно прав для модерации продуктов', 'FORBIDDEN');
  }
  return currentUser;
}

export function ownerScopedPersonalFoodSelector(
  foodId: ObjectId,
  ownerId: ObjectId,
  activeOnly = true,
) {
  return activeOnly
    ? { _id: foodId, ownerId, deletedAt: { $exists: false as const } }
    : { _id: foodId, ownerId };
}

export function serializeCatalogFood(food: typeof dbFoods._doc, barcode?: string): Food {
  return {
    id: food._id.toString(),
    source: 'catalog',
    name: food.name,
    brand: food.brand,
    category: food.category,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    unit: food.unit === 'мл' ? 'мл' : 'г',
    barcode,
    isVerified: true,
    dataSource: food.dataSource ?? 'Каталог FORMETRA',
    dataQualityWarnings: food.dataQualityWarnings,
  };
}

export function serializePersonalFood(food: typeof dbPersonalFoods._doc): Food {
  return {
    id: food._id.toString(),
    source: 'personal',
    name: food.name,
    brand: food.brand,
    category: food.category,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    unit: food.unit === 'мл' ? 'мл' : 'г',
    barcode: food.barcode,
    isVerified: false,
    dataSource: food.dataSource ?? 'Личный продукт',
    dataQualityWarnings: food.dataQualityWarnings,
  };
}

export function serializeSubmission(submission: typeof dbFoodSubmissions._doc) {
  return {
    id: submission._id.toString(),
    personalFoodId: submission.personalFoodId.toString(),
    status: submission.status as SubmissionStatus,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt,
    reviewNote: submission.reviewNote,
    approvedCatalogFoodId: submission.approvedCatalogFoodId?.toString(),
    food: {
      name: submission.name,
      brand: submission.brand,
      category: submission.category,
      calories: submission.calories,
      protein: submission.protein,
      carbs: submission.carbs,
      fat: submission.fat,
      unit: submission.unit === 'мл' ? 'мл' : 'г',
      barcode: submission.barcode,
      dataSource: submission.dataSource,
      dataQualityWarnings: submission.dataQualityWarnings,
    },
  };
}

function serializeCachedLookup(cache: typeof dbBarcodeCache._doc): BarcodeLookupResult {
  if (
    cache.status !== 'found' ||
    !cache.name ||
    cache.calories === undefined ||
    cache.protein === undefined ||
    cache.carbs === undefined ||
    cache.fat === undefined
  ) {
    return {
      status: cache.status,
      normalizedBarcode: cache.barcode,
      source: 'open-food-facts',
      warnings: cache.warnings,
    };
  }

  const food: Food = {
    id: `off:${cache.barcode}`,
    source: 'open-food-facts',
    name: cache.name,
    brand: cache.brand,
    category: cache.category ?? 'Другое',
    calories: cache.calories,
    protein: cache.protein,
    carbs: cache.carbs,
    fat: cache.fat,
    unit: cache.unit === 'мл' ? 'мл' : 'г',
    barcode: cache.barcode,
    isVerified: false,
    dataSource: cache.dataSource,
    dataQualityWarnings: cache.warnings,
  };
  return {
    status: 'found',
    food,
    normalizedBarcode: cache.barcode,
    source: 'open-food-facts',
    warnings: cache.warnings,
  };
}

async function cacheExternalLookup(result: BarcodeLookupResult, now: Date) {
  let ttl = INCOMPLETE_CACHE_MS;
  if (result.status === 'found') {
    ttl = FOUND_CACHE_MS;
  } else if (result.status === 'not_found') {
    ttl = NOT_FOUND_CACHE_MS;
  }
  const foodFields = result.food
    ? {
        name: result.food.name,
        ...(result.food.brand ? { brand: result.food.brand } : {}),
        category: result.food.category,
        calories: result.food.calories,
        protein: result.food.protein,
        carbs: result.food.carbs,
        fat: result.food.fat,
        unit: result.food.unit,
      }
    : {};
  await dbBarcodeCache.upsertOne(
    { barcode: result.normalizedBarcode },
    {
      $set: {
        status: result.status,
        ...foodFields,
        warnings: result.warnings,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + ttl),
        dataSource: OPEN_FOOD_FACTS_SOURCE,
      },
      $unset: result.food
        ? { importToken: '' }
        : {
            name: '',
            brand: '',
            category: '',
            calories: '',
            protein: '',
            carbs: '',
            fat: '',
            unit: '',
            importToken: '',
          },
    },
  );
}

async function issueOffImportGrant(
  ownerId: ObjectId,
  barcode: string,
  expiresAt: Date,
  now: Date,
): Promise<string> {
  const importToken = randomUUID();
  await dbFoodImportGrants.create({ importToken, ownerId, barcode, expiresAt, createdAt: now });
  return importToken;
}

function fetchExternalDeduplicated(barcode: string): Promise<BarcodeLookupResult> {
  return externalScheduler.schedule(
    barcode,
    () => fetchOpenFoodFacts(barcode),
    (error) => (error instanceof OpenFoodFactsRateLimitError ? error.retryAfterMs : null),
  );
}

export async function lookupBarcodeForUser(
  rawBarcode: string,
  ownerId: ObjectId,
  now = new Date(),
): Promise<BarcodeLookupResult> {
  const normalized = normalizeBarcode(rawBarcode);
  if (!normalized) throw new ValidationError('Некорректный штрихкод EAN-8, UPC-A или EAN-13');
  const barcode = normalized.value;

  const personal = await dbPersonalFoods.findOne({
    ownerId,
    barcode,
    deletedAt: { $exists: false },
  });
  if (personal) {
    return {
      status: 'found',
      food: serializePersonalFood(personal),
      normalizedBarcode: barcode,
      source: 'personal',
      warnings: [],
    };
  }

  const mapping = await dbBarcodeMappings.findOne({ barcode, source: 'catalog' });
  if (mapping) {
    const catalogFood = await dbFoods.findById(mapping.foodId);
    if (catalogFood) {
      return {
        status: 'found',
        food: serializeCatalogFood(catalogFood, barcode),
        normalizedBarcode: barcode,
        source: 'catalog',
        warnings: [],
      };
    }
  }

  const cached = await dbBarcodeCache.findOne({ barcode, expiresAt: { $gt: now } });
  if (cached) {
    const cachedResult = serializeCachedLookup(cached);
    if (cached.status !== 'found' || !cachedResult.food) return cachedResult;
    const importToken = await issueOffImportGrant(ownerId, barcode, cached.expiresAt, now);
    return { ...cachedResult, importToken };
  }

  let result: BarcodeLookupResult;
  try {
    result = await fetchExternalDeduplicated(barcode);
  } catch {
    return {
      status: 'incomplete',
      normalizedBarcode: barcode,
      source: 'open-food-facts',
      warnings: ['Open Food Facts временно недоступен. Введите продукт вручную.'],
    };
  }
  await cacheExternalLookup(result, now);
  if (result.status !== 'found' || !result.food) return result;
  const expiresAt = new Date(now.getTime() + FOUND_CACHE_MS);
  const importToken = await issueOffImportGrant(ownerId, barcode, expiresAt, now);
  return { ...result, importToken };
}

export async function resolveOffImportProvenance(
  barcode: string | undefined,
  importToken: string | undefined,
  ownerId: ObjectId,
  now = new Date(),
): Promise<ConfirmedOffImport | null> {
  if (!barcode || !importToken) return null;
  const [cache, grant] = await Promise.all([
    dbBarcodeCache.findOne({ barcode, status: 'found', expiresAt: { $gt: now } }),
    dbFoodImportGrants.findOne({ importToken, ownerId, barcode, expiresAt: { $gt: now }, usedAt: { $exists: false } }),
  ]);
  const confirmed = confirmedOffImport(cache, grant, barcode, importToken, ownerId, now);
  if (!confirmed || !grant) return null;
  const consumed = await dbFoodImportGrants.findOneAndUpdate(
    { _id: grant._id, importToken, ownerId, barcode, expiresAt: { $gt: now }, usedAt: { $exists: false } },
    { $set: { usedAt: now } },
    { returnDocument: 'after' },
  );
  return consumed ? confirmed : null;
}

type OffImportCache = {
  barcode: string;
  status: string;
  name?: string;
  brand?: string;
  category?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  unit?: string;
  expiresAt: Date;
  dataSource: string;
  warnings: string[];
};

type OffImportGrant = {
  barcode: string;
  importToken: string;
  ownerId: ObjectId;
  expiresAt: Date;
  usedAt?: Date;
};

export type ConfirmedOffImport = {
  food: {
    name: string;
    brand?: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    unit: 'г' | 'мл';
    barcode: string;
  };
  dataSource: string;
  dataQualityWarnings: string[];
};

type EditableFoodInput = Omit<ConfirmedOffImport['food'], 'barcode'> & { barcode?: string };

export function applyConfirmedOffImport(
  input: EditableFoodInput,
  confirmed: ConfirmedOffImport | null,
): EditableFoodInput {
  return confirmed ? { ...input, ...confirmed.food } : input;
}

export function confirmedOffImport(
  cache: OffImportCache | null,
  grant: OffImportGrant | null,
  barcode: string,
  importToken: string,
  ownerId: ObjectId,
  now: Date,
): ConfirmedOffImport | null {
  if (
    !cache ||
    !grant ||
    cache.status !== 'found' ||
    cache.barcode !== barcode ||
    grant.barcode !== barcode ||
    grant.importToken !== importToken ||
    grant.ownerId.toString() !== ownerId.toString() ||
    grant.usedAt ||
    cache.expiresAt <= now ||
    grant.expiresAt <= now ||
    !cache.name ||
    cache.calories === undefined ||
    cache.protein === undefined ||
    cache.carbs === undefined ||
    cache.fat === undefined
  ) {
    return null;
  }
  return {
    food: {
      name: cache.name,
      brand: cache.brand,
      category: cache.category ?? 'Другое',
      calories: cache.calories,
      protein: cache.protein,
      carbs: cache.carbs,
      fat: cache.fat,
      unit: cache.unit === 'мл' ? 'мл' : 'г',
      barcode: cache.barcode,
    },
    dataSource: cache.dataSource,
    dataQualityWarnings: cache.warnings,
  };
}

export function isRetrySafeDecision(
  current: SubmissionStatus,
  requested: 'approved' | 'rejected',
): boolean {
  return current === requested;
}
