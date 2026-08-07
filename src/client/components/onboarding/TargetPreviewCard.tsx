import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/client/components/ui/Button';
import { formatTarget, GOAL_LABELS, type TargetPreview } from '@/client/lib/profile';

const ACTIVITY_LABELS: Record<string, string> = {
  inactive: 'Низкая',
  low_active: 'Невысокая',
  active: 'Активная',
  very_active: 'Очень активная',
};

interface TargetPreviewCardProps {
  preview: TargetPreview;
  isConfirming: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

export function TargetPreviewCard({ preview, isConfirming, onConfirm, onEdit }: TargetPreviewCardProps) {
  if (!preview.eligible) {
    return (
      <section className="animate-slide-up rounded-2xl border border-flame-700 bg-paper p-6">
        <AlertTriangle className="size-8 text-flame-500" aria-hidden="true" />
        <h2 className="mt-4 font-display text-2xl font-bold uppercase">Расчёт недоступен</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          FORMETRA рассчитана на здоровых взрослых от 18 лет. В вашей ситуации безопаснее обсудить питание с врачом или профильным специалистом.
        </p>
        {preview.reasons.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-3">
            {preview.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}
        <Button className="mt-6" variant="outline" onClick={onEdit}>Изменить ответы</Button>
      </section>
    );
  }

  const macros = [
    ['Калории', preview.calories, 'ккал'],
    ['Белки', preview.protein, 'г'],
    ['Углеводы', preview.carbs, 'г'],
    ['Жиры', preview.fat, 'г'],
  ] as const;

  return (
    <section className="animate-slide-up overflow-hidden rounded-2xl border border-mist-2 bg-paper">
      <div className="hatch h-2" aria-hidden="true" />
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-flame-500" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Предварительный расчёт</p>
            <h2 className="mt-1 font-display text-3xl font-bold uppercase">Ваша дневная цель</h2>
            <p className="mt-1 text-sm text-ink-3">Это оценка, а не медицинская рекомендация. Цель ещё не сохранена.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {macros.map(([label, value, unit]) => (
            <div key={label} className="rounded-xl border border-mist-2 bg-mist p-3">
              <p className="text-xs font-semibold text-ink-3">{label}</p>
              <p className="tabnum mt-1 font-display text-2xl font-bold">{formatTarget(value)} <span className="text-sm text-ink-3">{unit}</span></p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-mist-2 p-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-ink-3">Поддержание</dt><dd className="tabnum mt-0.5 font-bold">{formatTarget(preview.maintenanceCalories)} ккал</dd></div>
            <div><dt className="text-ink-3">Цель</dt><dd className="mt-0.5 font-bold">{GOAL_LABELS[preview.goalMode]}</dd></div>
            <div><dt className="text-ink-3">Активность</dt><dd className="mt-0.5 font-bold">{ACTIVITY_LABELS[preview.activityCategory] ?? preview.activityCategory}</dd></div>
          </dl>
          {preview.explanation.length > 0 && (
            <ul className="mt-4 list-disc space-y-1.5 border-t border-mist-2 pt-4 pl-5 text-sm leading-relaxed text-ink-2">
              {preview.explanation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-3">Версия методики: {preview.policyVersion}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onEdit}>Изменить ответы</Button>
          <Button color="primary" loading={isConfirming} onClick={onConfirm}>Подтвердить и сохранить цели</Button>
        </div>
      </div>
    </section>
  );
}
