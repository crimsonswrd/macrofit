import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/client/components/ui/Button';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import { todayKey } from '@/client/lib/nutrition';
import type { WeighIn } from '@/client/lib/progress';

interface WeighInFormProps {
  history: WeighIn[];
  pending: boolean;
  onSubmit: (input: { date: string; weightKg: number }) => void;
}

export function WeighInForm({ history, pending, onSubmit }: WeighInFormProps) {
  const [date, setDate] = useState(todayKey());
  const existing = history.find((item) => item.date === date);
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const weightRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setWeight(existing ? String(existing.weightKg) : '');
  }, [date, existing?.id, existing?.weightKg]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const weightKg = Number(weight.replace(',', '.'));
    if (!Number.isFinite(weightKg) || weightKg < 35 || weightKg > 350) {
      setError('Укажите вес от 35 до 350 кг');
      weightRef.current?.focus();
      return;
    }
    setError('');
    onSubmit({ date, weightKg });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Измерение</p>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase">{existing ? 'Обновить вес' : 'Записать вес'}</h2>
        <p className="mt-1 text-sm text-ink-3">Одна запись на дату. Повторное сохранение обновит её.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="weigh-in-date">Дата</Label>
          <Input id="weigh-in-date" className="mt-1.5 w-full" type="date" value={date} max={todayKey()} onChange={(event) => setDate(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="weigh-in-weight">Вес, кг</Label>
          <Input ref={weightRef} id="weigh-in-weight" className="mt-1.5 w-full tabnum" inputMode="decimal" type="number" min="35" max="350" step="0.05" value={weight} onChange={(event) => { setWeight(event.target.value); setError(''); }} placeholder="78,4" required aria-invalid={Boolean(error)} aria-describedby={error ? 'weigh-in-error' : undefined} />
          {error && <p id="weigh-in-error" role="alert" className="mt-2 text-sm text-flame-500">{error}</p>}
        </div>
        <Button className="sm:mb-px" type="submit" color="primary" loading={pending} leftIcon={<Save className="size-4" />}>{existing ? 'Обновить' : 'Сохранить'}</Button>
      </div>
    </form>
  );
}
