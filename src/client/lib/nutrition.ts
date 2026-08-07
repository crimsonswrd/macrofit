export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Завтрак' },
  { key: 'lunch', label: 'Обед' },
  { key: 'dinner', label: 'Ужин' },
  { key: 'snack', label: 'Перекус' },
];

export type Food = {
  id: string;
  source?: 'catalog' | 'personal';
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: string;
  isVerified: boolean;
};

export type RecentFood = Food & {
  lastGrams: number;
};

export type DiaryItem = {
  id: string;
  meal: Meal;
  foodId: string;
  foodName: string;
  unit: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
};

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DayData = {
  date: string;
  items: DiaryItem[];
  totals: Macros;
  targets: Macros;
};

/** YYYY-MM-DD in the user's local timezone. */
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function shiftDateKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatDateKey(key: string) {
  const [, m, d] = key.split('-').map(Number);
  const today = todayKey();
  if (key === today) return 'Сегодня';
  if (key === shiftDateKey(today, -1)) return 'Вчера';
  if (key === shiftDateKey(today, 1)) return 'Завтра';
  return `${d} ${MONTHS[m - 1]}`;
}

export function formatWeekday(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}`;
}

export function fmt(value: number, digits = 0) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function scaleMacros(food: Food, grams: number): Macros {
  const k = grams / 100;
  return {
    calories: Math.round(food.calories * k),
    protein: Math.round(food.protein * k * 10) / 10,
    carbs: Math.round(food.carbs * k * 10) / 10,
    fat: Math.round(food.fat * k * 10) / 10,
  };
}

export function scaleDiarySnapshot(item: DiaryItem, grams: number): Macros {
  const factor = grams / 100;
  return {
    calories: item.caloriesPer100 * factor,
    protein: item.proteinPer100 * factor,
    carbs: item.carbsPer100 * factor,
    fat: item.fatPer100 * factor,
  };
}

export function partitionFoodSections(recent: RecentFood[], foods: Food[], showRecent: boolean) {
  if (!showRecent) return { recent: [] as RecentFood[], foods };

  const seen = new Set<string>();
  const uniqueRecent = recent.filter((food) => {
    const key = `${food.source ?? 'catalog'}:${food.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const recentIds = new Set(uniqueRecent.map((food) => `${food.source ?? 'catalog'}:${food.id}`));
  return {
    recent: uniqueRecent,
    foods: foods.filter((food) => !recentIds.has(`${food.source ?? 'catalog'}:${food.id}`)),
  };
}
