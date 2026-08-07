import { dbFoodEntries } from '@/server/nutrition/db';
import { snapshotPer100 } from '@/server/nutrition/snapshot';
import { canonicalFoodId } from '@/server/nutrition/recent';

/** Backfills immutable per-100 snapshots for diary entries created before v4. */
export async function backfillFoodEntrySnapshots() {
  const entries = await dbFoodEntries.fetch({});

  for (const entry of entries) {
    if (
      entry.caloriesPer100 !== undefined &&
      entry.proteinPer100 !== undefined &&
      entry.carbsPer100 !== undefined &&
      entry.fatPer100 !== undefined
    ) {
      continue;
    }

    const snapshot = snapshotPer100(entry);
    await dbFoodEntries.updateOne(
      { _id: entry._id },
      {
        $set: {
          caloriesPer100: snapshot.calories,
          proteinPer100: snapshot.protein,
          carbsPer100: snapshot.carbs,
          fatPer100: snapshot.fat,
          foodId: canonicalFoodId(entry.foodId),
        },
      },
    );
  }
}
