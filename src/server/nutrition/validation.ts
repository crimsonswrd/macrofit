import z from 'zod';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isCalendarDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

export function isObjectIdString(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value);
}

export const dateSchema = z.string().refine(isCalendarDateKey, 'Invalid calendar date');
export const objectIdSchema = z.string().refine(isObjectIdString, 'Invalid identifier');
