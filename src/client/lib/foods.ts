import type {
  BarcodeLookupResult,
  Food as SharedFood,
  FoodSource,
  FoodUnit,
  SubmissionStatus,
} from '@/shared/contracts/food';

export type { FoodSource, SubmissionStatus } from '@/shared/contracts/food';

export type FoodRecord = SharedFood;
export type DiaryFoodRecord = FoodRecord & { source: 'catalog' | 'personal' };

export type PersonalFoodInput = {
  name: string;
  brand?: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: FoodUnit;
  barcode?: string;
  /** Opaque server-issued proof for a confirmed Open Food Facts lookup. */
  importToken?: string;
};

export type BarcodeLookup = BarcodeLookupResult;

export type SubmissionFood = Omit<FoodRecord, 'id' | 'source' | 'isVerified' | 'dataSource' | 'dataQualityWarnings'>;

export type FoodSubmission = {
  id: string;
  personalFoodId: string;
  food?: SubmissionFood;
  status: SubmissionStatus;
  submittedAt: string;
  reviewNote?: string;
};

export type ModerationSubmission = FoodSubmission & {
  authorHandle?: string;
};

export const FOOD_SOURCE_LABELS: Record<FoodSource, string> = {
  catalog: 'Каталог',
  personal: 'Личный',
  'open-food-facts': 'Open Food Facts',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'На проверке',
  approved: 'Опубликован',
  rejected: 'Отклонён',
  withdrawn: 'Отозван',
};

export function mergeFoods<T extends FoodRecord>(...groups: T[][]) {
  const byId = new Map<string, T>();
  for (const food of groups.flat()) {
    const key = `${food.source}:${food.id}`;
    if (!byId.has(key)) byId.set(key, food);
  }
  return [...byId.values()];
}

export function formatFoodMeta(food: Pick<FoodRecord, 'brand' | 'category' | 'unit'>) {
  return [food.brand, food.category, `на 100 ${food.unit}`].filter(Boolean).join(' · ');
}

export function isOpenFoodFacts(food?: Pick<FoodRecord, 'source'> | null) {
  return food?.source === 'open-food-facts';
}

export function isModerationAccessError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown };
  if (candidate.status === 401 || candidate.status === 403) return true;
  if (candidate.code === 'FORBIDDEN' || candidate.code === 'UNAUTHORIZED') return true;
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  return message.includes('недостаточно прав')
    || message.includes('требуется вход')
    || message.includes('access denied')
    || message.includes('forbidden')
    || message.includes('unauthorized');
}

/** Build an attributed import only from a fresh, server-issued OFF lookup. */
export function personalFoodInputFromLookup(result: BarcodeLookup): PersonalFoodInput | null {
  const food = result.food;
  if (result.status !== 'found' || food?.source !== 'open-food-facts' || !result.importToken) {
    return null;
  }
  return {
    name: food.name,
    brand: food.brand,
    category: food.category,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    unit: food.unit,
    barcode: result.normalizedBarcode,
    importToken: result.importToken,
  };
}

export function asCatalogFood(food: {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: string;
  isVerified: boolean;
  source?: 'catalog' | 'personal';
}): DiaryFoodRecord {
  return {
    ...food,
    unit: food.unit === 'мл' ? 'мл' : 'г',
    source: food.source === 'personal' ? 'personal' : 'catalog',
  };
}
