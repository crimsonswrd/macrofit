import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQueryKey, modelenceMutation } from '@modelence/react-query';
import { Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/client/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/client/components/ui/Dialog';
import { Input } from '@/client/components/ui/Input';
import { cn } from '@/client/lib/utils';
import { MEALS, fmt, scaleDiarySnapshot, type DiaryItem, type Meal } from '@/client/lib/nutrition';

export default function EditDiaryEntryDialog({
  item,
  date,
  onOpenChange,
}: {
  item: DiaryItem | null;
  date: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [grams, setGrams] = useState('');
  const [meal, setMeal] = useState<Meal>('breakfast');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gramsError, setGramsError] = useState('');

  useEffect(() => {
    if (!item) return;
    setGrams(String(item.grams));
    setMeal(item.meal);
    setConfirmDelete(false);
    setGramsError('');
  }, [item]);

  const invalidateDay = () =>
    queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getDay', { date }) });

  const updateMutation = useMutation({
    ...modelenceMutation('nutrition.updateEntry'),
    onSuccess: async () => {
      await invalidateDay();
      toast.success('Запись обновлена');
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const deleteMutation = useMutation({
    ...modelenceMutation('nutrition.deleteEntry'),
    onSuccess: async () => {
      await invalidateDay();
      queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getRecentFoods', {}) });
      toast.success('Запись удалена');
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const gramsNumber = Number(grams.replace(',', '.'));
  const preview = useMemo(() => {
    if (!item || !(gramsNumber > 0)) return null;
    return scaleDiarySnapshot(item, gramsNumber);
  }, [gramsNumber, item]);

  if (!item) return null;
  const pending = updateMutation.isPending || deleteMutation.isPending;

  function handleSave() {
    if (!item) return;
    if (!(gramsNumber > 0) || gramsNumber > 5000) {
      setGramsError('Укажите вес от 1 до 5000');
      return;
    }
    setGramsError('');
    updateMutation.mutate({ entryId: item.id, grams: gramsNumber, meal });
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <DialogContent className="max-w-md">
        <div>
          <DialogTitle className="pr-8 font-display text-xl font-semibold uppercase tracking-tight">
            Изменить запись
          </DialogTitle>
          <DialogDescription className="mt-1 text-ink-3">{item.foodName}</DialogDescription>
        </div>

        {confirmDelete ? (
          <div className="animate-fade-in">
            <p className="text-sm leading-relaxed text-ink-2">
              Удалить «{item.foodName}» из дневника? Это действие нельзя отменить.
            </p>
            <DialogFooter className="mt-5">
              <Button variant="outline" disabled={pending} onClick={() => setConfirmDelete(false)}>
                Оставить
              </Button>
              <Button
                color="destructive"
                loading={deleteMutation.isPending}
                leftIcon={<Trash2 className="size-4" />}
                onClick={() => deleteMutation.mutate({ entryId: item.id })}
              >
                Удалить
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="animate-fade-in">
            <fieldset disabled={pending}>
              <legend className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-3">
                Приём пищи
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEALS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setMeal(option.key)}
                    className={cn(
                      'min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                      meal === option.key
                        ? 'border-flame-500 bg-flame-500 text-mist'
                        : 'border-mist-2 bg-paper text-ink-2 hover:border-flame-500 hover:text-ink',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <label
                htmlFor="edit-entry-grams"
                className="mt-5 block font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-3"
              >
                Вес порции ({item.unit})
              </label>
              <Input
                id="edit-entry-grams"
                type="number"
                inputMode="decimal"
                min={1}
                max={5000}
                value={grams}
                onChange={(event) => setGrams(event.target.value)}
                className="tabnum mt-2 h-12 rounded-lg text-xl font-bold"
                aria-invalid={Boolean(gramsError)}
                aria-describedby={gramsError ? 'edit-entry-grams-error' : undefined}
              />
              {gramsError && <p id="edit-entry-grams-error" role="alert" className="mt-2 text-sm text-flame-500">{gramsError}</p>}

              <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg bg-mist p-3 text-center">
                {[
                  ['ккал', preview?.calories ?? 0],
                  ['белки', preview?.protein ?? 0],
                  ['углев.', preview?.carbs ?? 0],
                  ['жиры', preview?.fat ?? 0],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="tabnum font-display text-lg font-bold text-ink">
                      {fmt(value as number, 1)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3">{label}</p>
                  </div>
                ))}
              </div>
            </fieldset>

            <DialogFooter className="mt-5 justify-between sm:justify-between">
              <Button
                color="destructive"
                variant="ghost"
                disabled={pending}
                leftIcon={<Trash2 className="size-4" />}
                onClick={() => setConfirmDelete(true)}
              >
                Удалить
              </Button>
              <Button
                color="primary"
                loading={updateMutation.isPending}
                leftIcon={<Check className="size-4" />}
                onClick={handleSave}
              >
                Сохранить
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
