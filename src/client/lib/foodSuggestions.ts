import { scaleMacros, type Food, type Macros } from '@/client/lib/nutrition';

export type SuggestionKind = 'balanced' | 'protein' | 'quick';

export interface SuggestedFoodPart {
  food: Food;
  grams: number;
  macros: Macros;
}

export interface FoodSuggestion {
  id: string;
  title: string;
  kind: SuggestionKind;
  tag: string;
  reason: string;
  parts: SuggestedFoodPart[];
  totals: Macros;
}

interface SuggestionTemplate {
  id: string;
  title: string;
  kind: SuggestionKind;
  parts: Array<{ name: string; grams: number }>;
}

const TEMPLATES: SuggestionTemplate[] = [
  { id: 'chicken-rice', title: 'Курица с рисом', kind: 'balanced', parts: [
    { name: 'Куриная грудка, отварная', grams: 160 }, { name: 'Рис белый отварной', grams: 200 },
  ] },
  { id: 'turkey-buckwheat', title: 'Индейка с гречкой', kind: 'balanced', parts: [
    { name: 'Индейка, филе грудки (сырая)', grams: 170 }, { name: 'Гречка отварная', grams: 220 },
  ] },
  { id: 'cottage-cheese', title: 'Творог', kind: 'protein', parts: [
    { name: 'Творог 5%', grams: 220 },
  ] },
  { id: 'tuna-bread', title: 'Тунец с хлебом', kind: 'protein', parts: [
    { name: 'Тунец консервированный в с/с', grams: 150 }, { name: 'Хлеб цельнозерновой', grams: 70 },
  ] },
  { id: 'yogurt-banana', title: 'Йогурт с бананом', kind: 'quick', parts: [
    { name: 'Греческий йогурт 2%', grams: 250 }, { name: 'Банан', grams: 120 },
  ] },
  { id: 'eggs-bread', title: 'Яйца и цельнозерновой хлеб', kind: 'quick', parts: [
    { name: 'Яйцо куриное целое', grams: 120 }, { name: 'Хлеб цельнозерновой', grams: 60 },
  ] },
];

const KIND_LABEL: Record<SuggestionKind, string> = {
  balanced: 'Сбалансировано',
  protein: 'Больше белка',
  quick: 'Быстрый вариант',
};

function addMacros(values: Macros[]): Macros {
  return values.reduce((sum, value) => ({
    calories: sum.calories + value.calories,
    protein: sum.protein + value.protein,
    carbs: sum.carbs + value.carbs,
    fat: sum.fat + value.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPortion(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

function scoreSuggestion(totals: Macros, remaining: Macros, kind: SuggestionKind) {
  const calorieTarget = clamp(remaining.calories, 180, 650);
  const proteinTarget = clamp(remaining.protein, 15, 55);
  const calorieDistance = Math.abs(totals.calories - calorieTarget) / calorieTarget;
  const proteinDistance = Math.abs(totals.protein - proteinTarget) / proteinTarget;
  const overPenalty = totals.calories > remaining.calories && remaining.calories > 100 ? 0.8 : 0;
  const proteinWeight = kind === 'protein' ? 1.3 : 0.65;
  return calorieDistance + proteinDistance * proteinWeight + overPenalty;
}

export function buildFoodSuggestions(foods: Food[], totals: Macros, targets: Macros): FoodSuggestion[] {
  const byName = new Map(foods.map((food) => [food.name.toLocaleLowerCase('ru-RU'), food]));
  const remaining: Macros = {
    calories: Math.max(0, targets.calories - totals.calories),
    protein: Math.max(0, targets.protein - totals.protein),
    carbs: Math.max(0, targets.carbs - totals.carbs),
    fat: Math.max(0, targets.fat - totals.fat),
  };
  const desiredCalories = clamp(remaining.calories || 220, 180, 650);

  const candidates = TEMPLATES.flatMap((template) => {
    const baseParts = template.parts.flatMap((part) => {
      const food = byName.get(part.name.toLocaleLowerCase('ru-RU'));
      return food ? [{ food, grams: part.grams }] : [];
    });
    if (baseParts.length !== template.parts.length) return [];
    const baseTotals = addMacros(baseParts.map((part) => scaleMacros(part.food, part.grams)));
    const factor = clamp(desiredCalories / Math.max(1, baseTotals.calories), 0.65, 1.3);
    const parts = baseParts.map((part) => {
      const grams = roundPortion(part.grams * factor);
      return { food: part.food, grams, macros: scaleMacros(part.food, grams) };
    });
    const suggestionTotals = addMacros(parts.map((part) => part.macros));
    const proteinText = Math.round(suggestionTotals.protein);
    const reason = template.kind === 'protein'
      ? `Около ${proteinText} г белка — полезно, если белок сегодня отстаёт.`
      : template.kind === 'quick'
        ? `Можно собрать без долгой готовки: примерно ${Math.round(suggestionTotals.calories)} ккал.`
        : `Ровное сочетание белка и углеводов: примерно ${Math.round(suggestionTotals.calories)} ккал.`;
    return [{
      id: template.id,
      title: template.title,
      kind: template.kind,
      tag: KIND_LABEL[template.kind],
      reason,
      parts,
      totals: suggestionTotals,
      score: scoreSuggestion(suggestionTotals, remaining, template.kind),
    }];
  });

  return (['balanced', 'protein', 'quick'] as const).flatMap((kind) => {
    const best = candidates.filter((candidate) => candidate.kind === kind).sort((a, b) => a.score - b.score)[0];
    if (!best) return [];
    const { score: _score, ...suggestion } = best;
    return [suggestion];
  });
}

export function defaultMealForHour(hour: number): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}
