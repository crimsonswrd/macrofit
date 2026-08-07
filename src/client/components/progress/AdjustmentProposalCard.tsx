import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/client/components/ui/Button';
import { formatTarget } from '@/client/lib/profile';
import type { AdjustmentProposal, MacroTargets } from '@/client/lib/progress';

interface AdjustmentProposalCardProps {
  proposal: AdjustmentProposal;
  accepting: boolean;
  dismissing: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

const METRICS: { key: keyof MacroTargets; label: string; unit: string }[] = [
  { key: 'calories', label: 'Калории', unit: 'ккал' },
  { key: 'protein', label: 'Белки', unit: 'г' },
  { key: 'carbs', label: 'Углеводы', unit: 'г' },
  { key: 'fat', label: 'Жиры', unit: 'г' },
];

export function AdjustmentProposalCard({ proposal, accepting, dismissing, onAccept, onDismiss }: AdjustmentProposalCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-flame-500/40 bg-paper" aria-labelledby="proposal-title">
      <div className="hatch h-2" aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-flame-500/10 text-flame-500"><Info className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Предложение, не автоматическое изменение</p>
            <h2 id="proposal-title" className="mt-1 font-display text-2xl font-bold uppercase">Скорректировать КБЖУ?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{proposal.reason}</p>
          </div>
        </div>

        {proposal.evidence.length > 0 && (
          <div className="mt-4 rounded-xl border border-mist-2 bg-mist/50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">На чём основано</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              {proposal.evidence.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}
            </ul>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METRICS.map(({ key, label, unit }) => (
            <div key={key} className="rounded-xl border border-mist-2 bg-mist p-3">
              <p className="text-xs font-semibold text-ink-3">{label}</p>
              <div className="mt-2 flex items-center gap-1.5 font-display font-bold tabnum">
                <span className="text-sm text-ink-3 line-through">{formatTarget(proposal.current[key])}</span>
                <ArrowRight className="size-3 text-ink-3" aria-hidden="true" />
                <span className="text-lg text-ink">{formatTarget(proposal.proposed[key])}</span>
              </div>
              <p className="text-[11px] text-ink-3">{unit} в день</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-3">Ничего не изменится, пока вы явно не примете предложение. Это оценка по тренду, а не медицинская рекомендация.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button color="primary" loading={accepting} disabled={dismissing} onClick={onAccept}>Принять новые цели</Button>
          <Button variant="outline" loading={dismissing} disabled={accepting} onClick={onDismiss}>Отклонить</Button>
        </div>
      </div>
    </section>
  );
}

