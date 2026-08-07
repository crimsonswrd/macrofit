import { cn } from '@/client/lib/utils';
import { fmt, type Macros } from '@/client/lib/nutrition';
import type { InterfaceMode } from '@/client/lib/preferences';

function MacroBar({
  label,
  value,
  target,
  colorClass,
  unit = 'г',
}: {
  label: string;
  value: number;
  target: number;
  colorClass: string;
  unit?: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-display text-xs font-medium uppercase tracking-wider text-ink-3">
          {label}
        </span>
        <span className="tabnum text-sm font-semibold text-ink">
          {fmt(value, 1)}
          <span className="font-normal text-ink-3"> / {fmt(target)} {unit}</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-mist-2"
        role="progressbar"
        aria-label={`${label}: ${fmt(value, 1)} из ${fmt(target)} ${unit}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${fmt(value, 1)} из ${fmt(target)} ${unit}`}
      >
        <div
          className={cn(
            'h-full origin-left rounded-full animate-bar transition-[width] duration-500',
            over ? 'bg-flame-700' : colorClass
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DaySummary({ totals, targets, mode = 'sport' }: { totals: Macros; targets: Macros; mode?: InterfaceMode }) {
  const left = Math.max(0, Math.round(targets.calories - totals.calories));
  const pct = targets.calories > 0 ? Math.min(100, (totals.calories / targets.calories) * 100) : 0;
  const over = totals.calories > targets.calories;

  return (
    <section className="animate-slide-up overflow-hidden rounded-xl border border-mist-2 bg-paper shadow-sm">
      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-8 sm:p-6">
        {/* Calories */}
        <div>
          <p className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-3">
            Калории за день
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span
              className={cn(
                'tabnum font-display text-5xl font-bold leading-none',
                over ? 'text-flame-600' : 'text-ink'
              )}
            >
              {fmt(totals.calories)}
            </span>
            <span className="pb-1 text-sm font-semibold text-ink-3">
              / {fmt(targets.calories)} ккал
            </span>
          </div>

          <div
            className="mt-4 h-3 w-full overflow-hidden rounded-full bg-mist-2"
            role="progressbar"
            aria-label="Калории за день"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={`${fmt(totals.calories)} из ${fmt(targets.calories)} ккал`}
          >
            <div
              className={cn(
                'h-full origin-left rounded-full animate-bar transition-[width] duration-500',
                over ? 'bg-flame-700' : 'bg-flame-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="mt-2 text-sm font-medium text-ink-3">
            {over ? (
              <span className="text-ink-2">
                Выше ориентира на {fmt(totals.calories - targets.calories)} ккал — один день не определяет прогресс
              </span>
            ) : (
              <>Осталось <span className="tabnum font-bold text-ink">{fmt(left)}</span> ккал</>
            )}
          </p>
        </div>

        {/* Macros */}
        <div className="flex flex-col justify-center gap-4 border-t border-mist-2 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <MacroBar label="Белки" value={totals.protein} target={targets.protein} colorClass="bg-protein" />
          {mode === 'sport' && (
            <>
              <MacroBar label="Углеводы" value={totals.carbs} target={targets.carbs} colorClass="bg-carb" />
              <MacroBar label="Жиры" value={totals.fat} target={targets.fat} colorClass="bg-fat" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
