import z from 'zod';
import { AuthError, ValidationError } from 'modelence';
import { Module, ObjectId, UserInfo } from 'modelence/server';
import { dbFoods, dbFoodEntries } from './db';
import { FOOD_CATEGORIES } from './foodSeed';
import { resolveTargetsForDate } from '@/server/targets/service';
import { canonicalFoodId, uniqueRecentFoodRefs } from './recent';
import { scaleSnapshot, snapshotPer100, type MacroSnapshot } from './snapshot';
import { dateSchema, isObjectIdString, objectIdSchema } from './validation';
import { dbPersonalFoods } from '@/server/foods/db';
import { serializePersonalFood } from '@/server/foods/service';
import type { Food } from '@/shared/contracts/food';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** Legacy fallback shown only until a user confirms personal targets. */
export const DEFAULT_TARGETS = {
  calories: 2600,
  protein: 165,
  carbs: 300,
  fat: 80,
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round(value: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function requireUser(user: UserInfo | null) {
  if (!user) {
    throw new AuthError('Требуется вход в аккаунт');
  }
  return user;
}

type FoodDoc = {
  _id: ObjectId;
  name: string;
  brand?: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: string;
  isVerified: boolean;
  dataSource?: string;
  dataQualityWarnings?: string[];
};

function serializeFood(food: FoodDoc): Food {
  return {
    id: food._id.toString(),
    source: 'catalog' as const,
    name: food.name,
    brand: food.brand,
    category: food.category,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    unit: food.unit === 'мл' ? 'мл' : 'г',
    isVerified: food.isVerified,
    dataSource: food.dataSource ?? 'Каталог FORMETRA',
    dataQualityWarnings: food.dataQualityWarnings,
  };
}

export default new Module('nutrition', {
  stores: [dbFoods, dbFoodEntries],

  queries: {
    /** Static category list for the food database filter. */
    getCategories: async () => {
      return [...FOOD_CATEGORIES];
    },

    /** Search the food database by name, optionally filtered by category. */
    searchFoods: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const { query, category, limit } = z
        .object({
          query: z.string().optional().default(''),
          category: z.string().optional().default(''),
          limit: z.number().min(1).max(200).optional().default(40),
        })
        .parse(args ?? {});

      const filter: Record<string, unknown> = {};
      const trimmed = query.trim().toLowerCase();
      if (trimmed) {
        filter.searchName = { $regex: escapeRegex(trimmed) };
      }
      if (category) {
        filter.category = category;
      }

      const foods = await dbFoods.fetch(filter, {
        sort: { name: 1 },
        limit,
      });
      const catalogFoods = foods.map((food) => serializeFood(food as unknown as FoodDoc));
      if (!user) return catalogFoods;

      const personalFilter: Parameters<typeof dbPersonalFoods.fetch>[0] = {
        ownerId: new ObjectId(user.id),
        deletedAt: { $exists: false },
      };
      if (trimmed) personalFilter.searchName = { $regex: escapeRegex(trimmed) };
      if (category) personalFilter.category = category;
      const personalFoods = await dbPersonalFoods.fetch(personalFilter, { sort: { name: 1 }, limit });
      return [...catalogFoods, ...personalFoods.map(serializePersonalFood)]
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
        .slice(0, limit);
    },

    /** Most recently logged foods for the current user — for quick re-adding. */
    getRecentFoods: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);

      const userId = new ObjectId(currentUser.id);
      const batchSize = 100;
      const seen = new Set<string>();
      const recent: (ReturnType<typeof serializeFood> & { lastGrams: number })[] = [];
      let skip = 0;

      while (recent.length < 8) {
        const entries = await dbFoodEntries.fetch(
          { userId },
          { sort: { createdAt: -1, _id: -1 }, limit: batchSize, skip },
        );
        if (entries.length === 0) break;

        const candidates = uniqueRecentFoodRefs(entries, entries.length).filter((ref) => {
          if (!isObjectIdString(ref.id)) return false;
          const key = `${ref.source}:${ref.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const catalogIds = candidates.filter((ref) => ref.source === 'catalog').map((ref) => new ObjectId(ref.id));
        const personalIds = candidates.filter((ref) => ref.source === 'personal').map((ref) => new ObjectId(ref.id));
        const foods = catalogIds.length === 0 ? [] : await dbFoods.fetch({
          _id: { $in: catalogIds },
        });
        const personalFoods = personalIds.length === 0 ? [] : await dbPersonalFoods.fetch({
          _id: { $in: personalIds },
          ownerId: userId,
          deletedAt: { $exists: false },
        });
        const foodsByKey = new Map<string, Food>(
          [
            ...foods.map((food) => [`catalog:${food._id.toString()}`, serializeFood(food as unknown as FoodDoc)] as const),
            ...personalFoods.map((food) => [`personal:${food._id.toString()}`, serializePersonalFood(food)] as const),
          ],
        );
        const latestGramsByKey = new Map<string, number>();
        for (const entry of entries) {
          const source = entry.foodSource === 'personal' ? 'personal' : 'catalog';
          const key = `${source}:${canonicalFoodId(entry.foodId)}`;
          if (!latestGramsByKey.has(key)) latestGramsByKey.set(key, entry.grams);
        }

        for (const ref of candidates) {
          const key = `${ref.source}:${ref.id}`;
          const food = foodsByKey.get(key);
          if (food) recent.push({ ...food, lastGrams: latestGramsByKey.get(key) ?? 100 });
          if (recent.length >= 8) break;
        }

        skip += entries.length;
        if (entries.length < batchSize) break;
      }

      return recent;
    },

    /** Full diary for one calendar day: entries grouped by meal + totals. */
    getDay: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { date } = z.object({ date: dateSchema }).parse(args);

      const entries = await dbFoodEntries.fetch(
        { userId: new ObjectId(currentUser.id), date },
        { sort: { createdAt: 1 } }
      );

      const items = entries.map((entry) => {
        const snapshot = snapshotPer100(entry);
        return {
          id: entry._id.toString(),
          meal: entry.meal,
          foodSource: entry.foodSource === 'personal' ? 'personal' : 'catalog',
          foodId: canonicalFoodId(entry.foodId),
          foodName: entry.foodName,
          unit: entry.unit,
          grams: entry.grams,
          calories: round(entry.calories, 0),
          protein: round(entry.protein),
          carbs: round(entry.carbs),
          fat: round(entry.fat),
          caloriesPer100: snapshot.calories,
          proteinPer100: snapshot.protein,
          carbsPer100: snapshot.carbs,
          fatPer100: snapshot.fat,
        };
      });

      const totals = items.reduce(
        (acc, item) => ({
          calories: acc.calories + item.calories,
          protein: acc.protein + item.protein,
          carbs: acc.carbs + item.carbs,
          fat: acc.fat + item.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      return {
        date,
        items,
        totals: {
          calories: round(totals.calories, 0),
          protein: round(totals.protein),
          carbs: round(totals.carbs),
          fat: round(totals.fat),
        },
        targets:
          (await resolveTargetsForDate(new ObjectId(currentUser.id), date)) ?? DEFAULT_TARGETS,
      };
    },
  },

  mutations: {
    /** Log a food into a meal of a given day. */
    addEntry: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { date, meal, foodId, source, grams } = z
        .object({
          date: dateSchema,
          meal: z.enum(MEALS),
          foodId: objectIdSchema,
          source: z.enum(['catalog', 'personal']).optional(),
          grams: z.number().positive().max(5000),
        })
        .parse(args);

      const userId = new ObjectId(currentUser.id);
      const catalogFood = source === 'personal' ? null : await dbFoods.findOne({ _id: new ObjectId(foodId) });
      const personalFood =
        source === 'catalog' || catalogFood
          ? null
          : await dbPersonalFoods.findOne({
              _id: new ObjectId(foodId),
              ownerId: userId,
              deletedAt: { $exists: false },
            });
      const food = catalogFood ?? personalFood;
      if (!food) {
        throw new ValidationError(
          source === 'personal' ? 'Личный продукт не найден' : 'Продукт не найден',
        );
      }
      const resolvedSource = catalogFood ? 'catalog' : 'personal';
      const snapshot: MacroSnapshot = {
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      };
      const scaled = scaleSnapshot(snapshot, grams);

      const { insertedId } = await dbFoodEntries.insertOne({
        userId,
        date,
        meal,
        foodSource: resolvedSource,
        foodId: canonicalFoodId(foodId),
        foodName: food.name,
        unit: food.unit,
        grams,
        calories: scaled.calories,
        protein: scaled.protein,
        carbs: scaled.carbs,
        fat: scaled.fat,
        caloriesPer100: snapshot.calories,
        proteinPer100: snapshot.protein,
        carbsPer100: snapshot.carbs,
        fatPer100: snapshot.fat,
        createdAt: new Date(),
      });

      return { id: insertedId.toString() };
    },

    /** Change portion and/or meal without recreating the historical entry. */
    updateEntry: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { entryId, grams, meal } = z
        .object({
          entryId: objectIdSchema,
          grams: z.number().positive().max(5000),
          meal: z.enum(MEALS),
        })
        .parse(args);

      const userId = new ObjectId(currentUser.id);
      const entry = await dbFoodEntries.requireOne({ _id: new ObjectId(entryId), userId });

      const snapshot = snapshotPer100(entry);
      const scaled = scaleSnapshot(snapshot, grams);

      await dbFoodEntries.updateOne(
        { _id: entry._id, userId },
        {
          $set: {
            grams,
            meal,
            calories: scaled.calories,
            protein: scaled.protein,
            carbs: scaled.carbs,
            fat: scaled.fat,
            caloriesPer100: snapshot.calories,
            proteinPer100: snapshot.protein,
            carbsPer100: snapshot.carbs,
            fatPer100: snapshot.fat,
          },
        }
      );
    },

    /** Backward-compatible grams-only mutation for older clients. */
    updateEntryGrams: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { entryId, grams } = z
        .object({ entryId: objectIdSchema, grams: z.number().positive().max(5000) })
        .parse(args);
      const userId = new ObjectId(currentUser.id);
      const entry = await dbFoodEntries.requireOne({ _id: new ObjectId(entryId), userId });

      const snapshot = snapshotPer100(entry);
      const scaled = scaleSnapshot(snapshot, grams);
      await dbFoodEntries.updateOne(
        { _id: entry._id, userId },
        {
          $set: {
            grams,
            ...scaled,
            caloriesPer100: snapshot.calories,
            proteinPer100: snapshot.protein,
            carbsPer100: snapshot.carbs,
            fatPer100: snapshot.fat,
          },
        },
      );
    },

    deleteEntry: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { entryId } = z.object({ entryId: objectIdSchema }).parse(args);

      const userId = new ObjectId(currentUser.id);
      const entry = await dbFoodEntries.requireOne({ _id: new ObjectId(entryId), userId });
      await dbFoodEntries.deleteOne({ _id: entry._id, userId });
    },
  },
});
