import type { LifeStage } from '@/shared/contracts/profile';
import { localDateKey } from './timezone';

export type EligibilityInput = {
  birthDate: string;
  lifeStage: LifeStage;
  requiresSpecializedGuidance: boolean;
  acknowledgedEstimate: boolean;
  timeZone?: string;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  age: number | null;
};

export function ageOnDate(birthDate: string, onDate: Date, timeZone?: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  const [currentYear, currentMonth, currentDay] = localDateKey(onDate, timeZone).split('-').map(Number);
  let age = currentYear - year;
  const beforeBirthday =
    currentMonth < month ||
    (currentMonth === month && currentDay < day);
  if (beforeBirthday) age -= 1;
  return age;
}

export function evaluateEligibility(input: EligibilityInput, now = new Date()): EligibilityResult {
  const reasons: string[] = [];
  const age = ageOnDate(input.birthDate, now, input.timeZone);

  if (age === null) reasons.push('Укажите корректную дату рождения.');
  else if (age < 18) reasons.push('Расчёт доступен только пользователям от 18 лет.');
  else if (age > 120) reasons.push('Дата рождения находится вне поддерживаемого диапазона.');

  if (input.lifeStage !== 'general') {
    reasons.push('Беременность и грудное вскармливание требуют индивидуальной рекомендации специалиста.');
  }
  if (input.requiresSpecializedGuidance) {
    reasons.push('Указанные особенности требуют индивидуальной рекомендации специалиста.');
  }

  return { eligible: reasons.length === 0, reasons, age };
}
