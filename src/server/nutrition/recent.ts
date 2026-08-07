export type RecentEntry = {
  foodId: string;
  foodSource?: string;
};

export type RecentFoodRef = {
  id: string;
  source: 'catalog' | 'personal';
};

export function canonicalFoodId(foodId: string): string {
  return foodId.toLowerCase();
}

export function uniqueRecentFoodIds(entries: RecentEntry[], limit = 8): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const entry of entries) {
    const foodId = canonicalFoodId(entry.foodId);
    if (seen.has(foodId)) continue;
    seen.add(foodId);
    ids.push(foodId);
    if (ids.length >= limit) break;
  }

  return ids;
}

export function uniqueRecentFoodRefs(entries: RecentEntry[], limit = 8): RecentFoodRef[] {
  const seen = new Set<string>();
  const refs: RecentFoodRef[] = [];

  for (const entry of entries) {
    const id = canonicalFoodId(entry.foodId);
    const source = entry.foodSource === 'personal' ? 'personal' : 'catalog';
    const key = `${source}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ id, source });
    if (refs.length >= limit) break;
  }

  return refs;
}
