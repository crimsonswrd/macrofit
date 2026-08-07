import { Store, schema } from 'modelence/server';

/**
 * Global food database. All macros are per 100 g (or per 100 ml for liquids).
 */
export const dbFoods = new Store('foods', {
  schema: {
    name: schema.string(),
    brand: schema.string().optional(),
    /** lowercased name, used for prefix/substring search */
    searchName: schema.string(),
    category: schema.string(),
    /** kcal per 100 g */
    calories: schema.number(),
    protein: schema.number(),
    carbs: schema.number(),
    fat: schema.number(),
    /** unit label of the base 100 amount: 'г' or 'мл' */
    unit: schema.string(),
    /** true for curated entries from the built-in database */
    isVerified: schema.boolean(),
    /** provenance for reviewed imports/user submissions */
    dataSource: schema.string().optional(),
    dataQualityWarnings: schema.array(schema.string()).optional(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { searchName: 1 } },
    { key: { category: 1 } },
    { key: { name: 1 }, unique: true },
  ],
});

/**
 * A single logged food item in a user's daily diary.
 * Macro values are snapshotted at log time so edits to the food DB
 * never rewrite history.
 */
export const dbFoodEntries = new Store('foodEntries', {
  schema: {
    userId: schema.userId(),
    /** local calendar date as YYYY-MM-DD */
    date: schema.string(),
    /** breakfast | lunch | dinner | snack */
    meal: schema.string(),
    /** catalog | personal; absent on legacy entries and treated as catalog */
    foodSource: schema.string().optional(),
    foodId: schema.string(),
    foodName: schema.string(),
    unit: schema.string(),
    grams: schema.number(),
    calories: schema.number(),
    protein: schema.number(),
    carbs: schema.number(),
    fat: schema.number(),
    /** immutable per-100 snapshot used for future portion edits */
    caloriesPer100: schema.number().optional(),
    proteinPer100: schema.number().optional(),
    carbsPer100: schema.number().optional(),
    fatPer100: schema.number().optional(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, date: 1 } },
    { key: { userId: 1, foodId: 1, createdAt: -1 } },
  ],
});
