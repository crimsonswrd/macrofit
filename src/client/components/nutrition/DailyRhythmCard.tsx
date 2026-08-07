import { CircleCheck, HeartHandshake, Waves } from 'lucide-react';
import { pressureFreeStatus } from '@/client/lib/wellbeing';
import type { DayData } from '@/client/lib/nutrition';
import { cn } from '@/client/lib/utils';

export function DailyRhythmCard({ day }: { day: DayData }) {
  const status = pressureFreeStatus(day);
  const tone = {
    calm: { icon: Waves, color: 'text-ink-2', surface: 'bg-mist/55' },
    steady: { icon: CircleCheck, color: 'text-steady-500', surface: 'bg-steady-50' },
    support: { icon: HeartHandshake, color: 'text-flame-500', surface: 'bg-flame-50/50' },
  }[status.tone];
  const Icon = tone.icon;
  const meals = new Set(day.items.map((item) => item.meal)).size;

  return (
    <section className={cn('rounded-2xl border border-mist-2 p-5', tone.surface)} aria-labelledby="daily-rhythm-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cn('text-xs font-bold uppercase tracking-[0.16em]', tone.color)}>{status.eyebrow}</p>
          <h2 id="daily-rhythm-title" className="mt-1 font-display text-xl font-bold uppercase">{status.title}</h2>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-mist-2 bg-paper">
          <Icon className={cn('size-5', tone.color)} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{status.message}</p>
      <p className="mt-3 text-xs font-semibold text-ink-3">
        {meals === 0 ? 'Записей пока нет' : `Отмечено приёмов пищи: ${meals}`}
      </p>
    </section>
  );
}
