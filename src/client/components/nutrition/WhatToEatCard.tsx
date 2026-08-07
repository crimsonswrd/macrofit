import { useEffect, useMemo, useState } from 'react';
import { createQueryKey, modelenceMutation, modelenceQuery } from '@modelence/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChefHat, Sparkles, Utensils } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/client/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/client/components/ui/Dialog';
import { Select } from '@/client/components/ui/Select';
import { Spinner } from '@/client/components/ui/Spinner';
import { buildFoodSuggestions, defaultMealForHour } from '@/client/lib/foodSuggestions';
import { MEALS, fmt, type DayData, type Food, type Meal } from '@/client/lib/nutrition';
import type { InterfaceMode } from '@/client/lib/preferences';
import { cn } from '@/client/lib/utils';

export function WhatToEatCard({
  day,
  mode,
  open,
  onOpenChange,
}: {
  day: DayData;
  mode: InterfaceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [meal, setMeal] = useState<Meal>(() => defaultMealForHour(new Date().getHours()));

  const foodsQuery = useQuery({
    ...modelenceQuery<Food[]>('nutrition.searchFoods', { query: '', category: '', limit: 180 }),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const suggestions = useMemo(
    () => buildFoodSuggestions(foodsQuery.data ?? [], day.totals, day.targets),
    [foodsQuery.data, day.totals, day.targets],
  );
  const selected = suggestions.find((suggestion) => suggestion.id === selectedId) ?? suggestions[0];

  useEffect(() => {
    if (open) {
      setMeal(defaultMealForHour(new Date().getHours()));
      setSelectedId('');
    }
  }, [open]);

  const addMutation = useMutation({
    ...modelenceMutation('nutrition.addEntry'),
  });

  async function addSuggestion() {
    if (!selected) return;
    try {
      for (const part of selected.parts) {
        await addMutation.mutateAsync({
          date: day.date,
          meal,
          foodId: part.food.id,
          source: part.food.source === 'personal' ? 'personal' : 'catalog',
          grams: part.grams,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getDay', { date: day.date }) }),
        queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getRecentFoods', {}) }),
      ]);
      toast.success(`${selected.title} добавлено в дневник`);
      onOpenChange(false);
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getDay', { date: day.date }) });
      toast.error((error as Error).message || 'Не удалось добавить вариант');
    }
  }

  const caloriesLeft = Math.max(0, day.targets.calories - day.totals.calories);
  const proteinLeft = Math.max(0, day.targets.protein - day.totals.protein);

  return (
    <>
      <section className="formetra-grid relative overflow-hidden rounded-2xl border border-mist-2 bg-paper p-5" aria-labelledby="what-to-eat-title">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Следующий шаг</p>
              <h2 id="what-to-eat-title" className="mt-1 font-display text-xl font-bold uppercase">Что мне съесть сейчас?</h2>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flame-500 text-mist">
              <ChefHat className="size-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Подберём три понятных варианта под остаток дня. Вы увидите состав и сами подтвердите добавление.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-3">
            <span className="rounded-full border border-mist-2 bg-mist px-2.5 py-1">Осталось {fmt(caloriesLeft)} ккал</span>
            <span className="rounded-full border border-mist-2 bg-mist px-2.5 py-1">Белок {fmt(proteinLeft)} г</span>
          </div>
          <Button className="mt-4" color="primary" leftIcon={<Sparkles className="size-4" />} onClick={() => onOpenChange(true)}>
            Подобрать вариант
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">FORMETRA советует</p>
            <DialogTitle className="mt-1 font-display text-2xl font-bold uppercase">Выберите удобный вариант</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-ink-3">
              Это ориентир, а не обязанность. Порции рассчитаны по остатку дня и всегда добавляются только после подтверждения.
            </DialogDescription>
          </div>

          {foodsQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center"><Spinner className="size-7 text-flame-500" /></div>
          ) : foodsQuery.isError ? (
            <div className="rounded-xl border border-flame-500/30 bg-flame-50 p-4" role="alert">
              <p className="text-sm text-ink-2">Не удалось загрузить продукты для подбора.</p>
              <Button className="mt-3" size="sm" variant="outline" loading={foodsQuery.isFetching} onClick={() => foodsQuery.refetch()}>Повторить</Button>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="rounded-xl border border-mist-2 bg-mist p-5 text-sm text-ink-2">
              Для готовых сочетаний не хватает продуктов в базе. Можно добавить еду вручную из дневника.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Варианты еды">
                {suggestions.map((suggestion) => {
                  const active = selected?.id === suggestion.id;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedId(suggestion.id)}
                      className={cn(
                        'rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500',
                        active ? 'border-steady-500 bg-steady-50' : 'border-mist-2 bg-mist/50 hover:border-flame-300',
                      )}
                    >
                      <span className={cn('text-[11px] font-bold uppercase tracking-wider', active ? 'text-steady-500' : 'text-flame-500')}>{suggestion.tag}</span>
                      <span className="mt-2 block font-display text-lg font-bold uppercase leading-tight">{suggestion.title}</span>
                      <span className="mt-2 block text-xs leading-relaxed text-ink-3">{suggestion.reason}</span>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div className="rounded-2xl border border-mist-2 bg-mist/45 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Будет добавлено</p>
                      <ul className="mt-2 space-y-1.5">
                        {selected.parts.map((part) => (
                          <li key={part.food.id} className="flex items-center gap-2 text-sm text-ink-2">
                            <Check className="size-4 text-steady-500" aria-hidden="true" />
                            <span>{part.food.name} — <strong className="text-ink">{part.grams} {part.food.unit}</strong></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="tabnum rounded-xl bg-paper px-4 py-3 text-sm font-semibold text-ink-2">
                      {fmt(selected.totals.calories)} ккал · Б {fmt(selected.totals.protein, 1)}
                      {mode === 'sport' && <> · У {fmt(selected.totals.carbs, 1)} · Ж {fmt(selected.totals.fat, 1)}</>}
                    </div>
                  </div>
                  <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-ink-3" htmlFor="suggestion-meal">Добавить в приём пищи</label>
                  <Select
                    value={meal}
                    onValueChange={(value) => setMeal(value as Meal)}
                    options={MEALS.map((item) => ({ value: item.key, label: item.label }))}
                    className="mt-2"
                  />
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Не сейчас</Button>
            <Button color="primary" loading={addMutation.isPending} disabled={!selected} leftIcon={<Utensils className="size-4" />} onClick={() => void addSuggestion()}>
              Добавить выбранное
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
