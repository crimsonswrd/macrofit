export const DEFAULT_TIME_ZONE = 'UTC';

export function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | undefined): string {
  return value && isSupportedTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}

export function localDateKey(now: Date, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isFutureLocalDate(date: string, now: Date, timeZone: string | undefined): boolean {
  return date > localDateKey(now, timeZone);
}
