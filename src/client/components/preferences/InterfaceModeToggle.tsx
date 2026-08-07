import { Dumbbell, Sparkles } from 'lucide-react';
import { cn } from '@/client/lib/utils';
import type { InterfaceMode } from '@/client/lib/preferences';

export function InterfaceModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: InterfaceMode;
  onChange: (mode: InterfaceMode) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-mist-2 bg-paper p-1"
      role="group"
      aria-label="Уровень подробности интерфейса"
    >
      <ModeButton
        active={mode === 'simple'}
        label={compact ? 'Просто' : 'Простой'}
        icon={<Sparkles className="size-3.5" aria-hidden="true" />}
        onClick={() => onChange('simple')}
      />
      <ModeButton
        active={mode === 'sport'}
        label="Спорт"
        icon={<Dumbbell className="size-3.5" aria-hidden="true" />}
        onClick={() => onChange('sport')}
      />
    </div>
  );
}

function ModeButton({ active, label, icon, onClick }: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500',
        active ? 'bg-ink text-mist' : 'text-ink-3 hover:bg-mist hover:text-ink',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
