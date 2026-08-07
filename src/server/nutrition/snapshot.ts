export type MacroSnapshot = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type StoredMacroSnapshot = MacroSnapshot & {
  grams: number;
  caloriesPer100?: number;
  proteinPer100?: number;
  carbsPer100?: number;
  fatPer100?: number;
};

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function snapshotPer100(entry: StoredMacroSnapshot): MacroSnapshot {
  const fallbackFactor = entry.grams > 0 ? 100 / entry.grams : 0;
  return {
    calories: entry.caloriesPer100 ?? entry.calories * fallbackFactor,
    protein: entry.proteinPer100 ?? entry.protein * fallbackFactor,
    carbs: entry.carbsPer100 ?? entry.carbs * fallbackFactor,
    fat: entry.fatPer100 ?? entry.fat * fallbackFactor,
  };
}

export function scaleSnapshot(snapshot: MacroSnapshot, grams: number): MacroSnapshot {
  const factor = grams / 100;
  return {
    calories: round(snapshot.calories * factor, 1),
    protein: round(snapshot.protein * factor, 2),
    carbs: round(snapshot.carbs * factor, 2),
    fat: round(snapshot.fat * factor, 2),
  };
}
