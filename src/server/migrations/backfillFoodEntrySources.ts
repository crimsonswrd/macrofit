import { dbFoodEntries } from '@/server/nutrition/db';

/** Legacy diary rows only referenced the curated catalog. */
export async function backfillFoodEntrySources() {
  const result = await dbFoodEntries.updateMany(
    { foodSource: { $exists: false } },
    { $set: { foodSource: 'catalog' } },
  );
  return `Marked ${result.modifiedCount} legacy diary entries as catalog foods`;
}
