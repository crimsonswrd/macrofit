import { BellRing, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/client/components/ui/Button';
import type { SmartReminder } from '@/client/lib/wellbeing';

export function SmartReminderCard({
  reminder,
  onAdd,
  onSuggest,
  onDismiss,
}: {
  reminder: SmartReminder;
  onAdd: () => void;
  onSuggest: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside className="mt-4 rounded-2xl border border-steady-300/40 bg-steady-50 p-4" aria-labelledby="smart-reminder-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-steady-500 text-mist">
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steady-500">Умная подсказка</p>
          <h2 id="smart-reminder-title" className="mt-1 font-display text-xl font-bold uppercase">{reminder.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{reminder.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reminder.action === 'add' && (
              <Button size="sm" color="primary" leftIcon={<Plus className="size-4" />} onClick={onAdd}>Добавить еду</Button>
            )}
            {reminder.action === 'suggest' && (
              <Button size="sm" color="primary" leftIcon={<Sparkles className="size-4" />} onClick={onSuggest}>Подобрать вариант</Button>
            )}
            <Button size="sm" variant="ghost" leftIcon={<X className="size-4" />} onClick={onDismiss}>Скрыть сегодня</Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
