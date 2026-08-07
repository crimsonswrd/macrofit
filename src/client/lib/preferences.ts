import { useCallback, useEffect, useState } from 'react';

export type InterfaceMode = 'simple' | 'sport';

export interface ReminderSettings {
  enabled: boolean;
  firstCheckTime: string;
  eveningCheckTime: string;
  weeklyWeighDay: string;
  weeklyWeighTime: string;
  browserNotifications: boolean;
}

const MODE_KEY = 'formetra:interface-mode';
const REMINDER_KEY = 'formetra:reminders';
const PREFERENCE_EVENT = 'formetra-preference-change';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  firstCheckTime: '10:30',
  eveningCheckTime: '19:30',
  weeklyWeighDay: '1',
  weeklyWeighTime: '08:00',
  browserNotifications: false,
};

function storage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function emitPreferenceChange(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: key }));
  }
}

export function normalizeInterfaceMode(value: unknown): InterfaceMode {
  return value === 'sport' ? 'sport' : 'simple';
}

export function readInterfaceMode(): InterfaceMode {
  return normalizeInterfaceMode(storage()?.getItem(MODE_KEY));
}

export function writeInterfaceMode(mode: InterfaceMode) {
  storage()?.setItem(MODE_KEY, mode);
  emitPreferenceChange(MODE_KEY);
}

function validTime(value: unknown, fallback: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

export function normalizeReminderSettings(value: unknown): ReminderSettings {
  const raw = value && typeof value === 'object' ? value as Partial<ReminderSettings> : {};
  return {
    enabled: raw.enabled !== false,
    firstCheckTime: validTime(raw.firstCheckTime, DEFAULT_REMINDER_SETTINGS.firstCheckTime),
    eveningCheckTime: validTime(raw.eveningCheckTime, DEFAULT_REMINDER_SETTINGS.eveningCheckTime),
    weeklyWeighDay: typeof raw.weeklyWeighDay === 'string' && /^[0-6]$/.test(raw.weeklyWeighDay)
      ? raw.weeklyWeighDay
      : DEFAULT_REMINDER_SETTINGS.weeklyWeighDay,
    weeklyWeighTime: validTime(raw.weeklyWeighTime, DEFAULT_REMINDER_SETTINGS.weeklyWeighTime),
    browserNotifications: raw.browserNotifications === true,
  };
}

export function readReminderSettings(): ReminderSettings {
  const raw = storage()?.getItem(REMINDER_KEY);
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    return normalizeReminderSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export function writeReminderSettings(settings: ReminderSettings) {
  const normalized = normalizeReminderSettings(settings);
  storage()?.setItem(REMINDER_KEY, JSON.stringify(normalized));
  emitPreferenceChange(REMINDER_KEY);
}

function usePreference<T>(key: string, read: () => T) {
  const [value, setValue] = useState<T>(() => read());
  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof StorageEvent && event.key !== key) return;
      if (event instanceof CustomEvent && event.detail !== key) return;
      setValue(read());
    };
    window.addEventListener('storage', sync);
    window.addEventListener(PREFERENCE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PREFERENCE_EVENT, sync);
    };
  }, [key, read]);
  return value;
}

export function useInterfaceMode() {
  const mode = usePreference(MODE_KEY, readInterfaceMode);
  const setMode = useCallback((next: InterfaceMode) => writeInterfaceMode(next), []);
  return [mode, setMode] as const;
}

export function useReminderSettings() {
  const settings = usePreference(REMINDER_KEY, readReminderSettings);
  const setSettings = useCallback((next: ReminderSettings) => writeReminderSettings(next), []);
  return [settings, setSettings] as const;
}
