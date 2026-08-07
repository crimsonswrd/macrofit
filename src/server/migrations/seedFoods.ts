import { dbFoods } from '@/server/nutrition/db';
import { seedFoods } from '@/server/nutrition/foodSeed';

/**
 * Seeds (and keeps in sync) the curated food database.
 * Idempotent: matches on the unique `name` and upserts the macro values.
 */
export async function seedFoodDatabase() {
  for (const food of seedFoods) {
    await dbFoods.upsertOne(
      { name: food.name },
      {
        $set: {
          name: food.name,
          searchName: food.name.toLowerCase(),
          category: food.category,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          unit: food.unit ?? 'г',
          isVerified: true,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      }
    );
  }
}
