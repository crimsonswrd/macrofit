import type { DayData } from '@/client/lib/nutrition';
import type { ReminderSettings } from '@/client/lib/preferences';

export interface PressureFreeStatus {
  tone: 'calm' | 'steady' | 'support';
  eyebrow: string;
  title: string;
  message: string;
}

export interface SmartReminder {
  id: 'first-entry' | 'evening-balance' | 'gentle-overview';
  title: string;
  message: string;
  action: 'add' | 'suggest' | 'none';
}

function ratio(value: number, target: number) {
  return target > 0 ? value / target : 0;
}

export function pressureFreeStatus(day: DayData): PressureFreeStatus {
  if (day.items.length === 0) {
    return {
      tone: 'calm', eyebrow: 'Без оценок', title: 'День только начинается',
      message: 'Добавьте первый приём пищи, когда будет удобно. Нулевой дневник — это не плохой результат.',
    };
  }
  const calories = ratio(day.totals.calories, day.targets.calories);
  const protein = ratio(day.totals.protein, day.targets.protein);
  if (calories > 1.12) {
    return {
      tone: 'support', eyebrow: 'Один день — не тренд', title: 'Ничего компенсировать не нужно',
      message: 'Продолжайте обычный режим завтра. Устойчивый результат формируется неделями, а не одним числом.',
    };
  }
  if (calories >= 0.78 && protein >= 0.75) {
    return {
      tone: 'steady', eyebrow: 'Хороший ритм', title: 'Основной ориентир уже собран',
      message: 'Остановитесь по сытости или добавьте еду по голоду — не обязательно добирать цифры идеально.',
    };
  }
  return {
    tone: 'calm', eyebrow: 'Вы в процессе', title: 'День складывается постепенно',
    message: 'Следующий обычный приём пищи важнее попытки идеально закрыть все показатели сразу.',
  };
}

function minutes(value: string) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

export function buildSmartReminder(day: DayData, now: Date, settings: ReminderSettings): SmartReminder | null {
  if (!settings.enabled) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (day.items.length === 0 && currentMinutes >= minutes(settings.firstCheckTime)) {
    return {
      id: 'first-entry', title: 'Можно начать с факта',
      message: 'Запишите то, что уже съели. Не нужно восстанавливать идеальные граммы — приблизительная запись полезнее пустого дня.',
      action: 'add',
    };
  }
  if (currentMinutes >= minutes(settings.eveningCheckTime)) {
    const proteinLeft = Math.max(0, day.targets.protein - day.totals.protein);
    const caloriesLeft = Math.max(0, day.targets.calories - day.totals.calories);
    if (proteinLeft >= 20 && caloriesLeft >= 140) {
      return {
        id: 'evening-balance', title: 'Есть место для спокойного выбора',
        message: `До ориентира осталось около ${Math.round(proteinLeft)} г белка. FORMETRA может предложить простой вариант.`,
        action: 'suggest',
      };
    }
    return {
      id: 'gentle-overview', title: 'День уже записан',
      message: 'Этого достаточно для анализа. Не нужно менять вечер только ради идеального совпадения с цифрами.',
      action: 'none',
    };
  }
  return null;
}
