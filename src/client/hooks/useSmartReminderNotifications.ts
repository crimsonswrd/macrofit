import { useEffect } from 'react';
import { useReminderSettings } from '@/client/lib/preferences';
import { showLocalNotification } from '@/client/lib/pwa';
import { todayKey, type DayData } from '@/client/lib/nutrition';
import { buildSmartReminder } from '@/client/lib/wellbeing';

function passed(time: string, now: Date) {
  const [hours, minutes] = time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

export function useSmartReminderNotifications(day: DayData | undefined) {
  const [settings] = useReminderSettings();

  useEffect(() => {
    if (!day || day.date !== todayKey() || !settings.enabled || !settings.browserNotifications) return;

    const check = async () => {
      const now = new Date();
      const reminder = buildSmartReminder(day, now, settings);
      if (reminder) {
        const key = `formetra:notification:${day.date}:${reminder.id}`;
        if (!localStorage.getItem(key)) {
          const shown = await showLocalNotification(reminder.title, reminder.message, reminder.id);
          if (shown) localStorage.setItem(key, 'shown');
        }
      }
      if (String(now.getDay()) === settings.weeklyWeighDay && passed(settings.weeklyWeighTime, now)) {
        const key = `formetra:notification:${day.date}:weekly-weigh`;
        if (!localStorage.getItem(key)) {
          const shown = await showLocalNotification(
            'Спокойная точка недели',
            'Если удобно, запишите вес. Одна цифра не оценивает прогресс — важен тренд за несколько недель.',
            'weekly-weigh',
          );
          if (shown) localStorage.setItem(key, 'shown');
        }
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(interval);
  }, [day, settings]);
}
