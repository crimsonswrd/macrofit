import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modelenceMutation, modelenceQuery, createQueryKey } from '@modelence/react-query';
import { ArrowLeft, Search, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/client/components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '@/client/components/ui/Dialog';
import { Input } from '@/client/components/ui/Input';
import { Spinner } from '@/client/components/ui/Spinner';
import { cn } from '@/client/lib/utils';
import {
  MEALS,
  fmt,
  partitionFoodSections,
  scaleMacros,
  type Food,
  type Meal,
  type RecentFood,
} from '@/client/lib/nutrition';
import { asCatalogFood, mergeFoods, type DiaryFoodRecord } from '@/client/lib/foods';

const QUICK_GRAMS = [30, 50, 100, 150, 200, 250];

export default function AddFoodDialog({
  open,
  onOpenChange,
  date,
  meal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  meal: Meal;
}) {
  const queryClient = useQueryClient();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
  const [gramsError, setGramsError] = useState('');

  const mealLabel = MEALS.find((m) => m.key === meal)?.label ?? '';

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 180);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  useEffect(() => {
    if (!open) {
      setRawQuery('');
      setQuery('');
      setCategory('');
      setSelected(null);
      setGrams('100');
      setGramsError('');
    }
  }, [open]);

  const categoriesQuery = useQuery({
    ...modelenceQuery<string[]>('nutrition.getCategories', {}),
    staleTime: Infinity,
  });

  const foodsQuery = useQuery({
    ...modelenceQuery<Food[]>('nutrition.searchFoods', { query, category, limit: 40 }),
    enabled: open,
    staleTime: 60_000,
  });

  const personalFoodsQuery = useQuery({
    ...modelenceQuery<DiaryFoodRecord[]>('foods.searchPersonal', { query, limit: 40 }),
    enabled: open,
    staleTime: 30_000,
  });

  const recentQuery = useQuery({
    ...modelenceQuery<RecentFood[]>('nutrition.getRecentFoods', {}),
    enabled: open,
    staleTime: 30_000,
  });

  const { mutate: addEntry, isPending } = useMutation({
    ...modelenceMutation('nutrition.addEntry'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getDay', { date }) });
      queryClient.invalidateQueries({ queryKey: createQueryKey('nutrition.getRecentFoods', {}) });
      toast.success('Добавлено в дневник');
      onOpenChange(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const gramsNumber = Number(grams.replace(',', '.'));
  const categories = categoriesQuery.data ?? [];
  const foods = foodsQuery.data ?? [];
  const personalFoods = personalFoodsQuery.data ?? [];
  const recent = recentQuery.data ?? [];
  const isFetching = foodsQuery.isFetching;
  const searchError = foodsQuery.isError || personalFoodsQuery.isError || recentQuery.isError;
  const preview = useMemo(
    () => (selected && gramsNumber > 0 ? scaleMacros(selected, gramsNumber) : null),
    [selected, gramsNumber]
  );

  const showRecent = !query && !category && recent.length > 0;
  const filteredPersonalFoods = category
    ? personalFoods.filter((food) => food.category === category)
    : personalFoods;
  const availableFoods = mergeFoods(filteredPersonalFoods, foods.map(asCatalogFood));
  const sections = partitionFoodSections(recent, availableFoods, showRecent);

  function handleSubmit() {
    if (!selected || !(gramsNumber > 0)) {
      setGramsError('Укажите вес порции больше нуля');
      return;
    }
    setGramsError('');
    addEntry({
      date,
      meal,
      foodId: selected.id,
      source: selected.source === 'personal' ? 'personal' : 'catalog',
      grams: gramsNumber,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 p-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-mist-2 px-5 py-4">
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="-ml-1 flex size-11 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-mist hover:text-ink"
              aria-label="Назад к поиску"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <div className="min-w-0">
            <DialogTitle className="font-display text-xl font-semibold uppercase tracking-tight">
              {selected ? 'Порция' : 'Добавить продукт'}
            </DialogTitle>
            <p className="mt-0.5 truncate text-sm text-ink-3">
              {selected ? selected.name : mealLabel}
            </p>
          </div>
        </div>

        {selected ? (
          <div className="animate-fade-in p-5">
            <label htmlFor="grams" className="font-display text-xs font-medium uppercase tracking-[0.18em] text-ink-3">
              Вес порции ({selected.unit})
            </label>
            <Input
              id="grams"
              type="number"
              inputMode="decimal"
              min={1}
              value={grams}
              autoFocus
              onChange={(e) => setGrams(e.target.value)}
              className="tabnum mt-2 h-14 rounded-lg text-2xl font-bold"
              aria-invalid={Boolean(gramsError)}
              aria-describedby={gramsError ? 'add-food-grams-error' : undefined}
            />
            {gramsError && <p id="add-food-grams-error" role="alert" className="mt-2 text-sm text-flame-500">{gramsError}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_GRAMS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrams(String(g))}
                  className={cn(
                    'tabnum min-h-11 rounded-full border px-3 py-2 text-sm font-semibold transition-colors duration-200',
                    Number(grams) === g
                      ? 'border-flame-500 bg-flame-500 text-mist'
                      : 'border-mist-2 bg-paper text-ink-2 hover:border-flame-200 hover:bg-flame-50'
                  )}
                >
                  {g} {selected.unit}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg bg-mist p-3 text-center">
              {[
                { label: 'ккал', value: preview?.calories ?? 0, cls: 'text-flame-600' },
                { label: 'белки', value: preview?.protein ?? 0, cls: 'text-ink' },
                { label: 'углев.', value: preview?.carbs ?? 0, cls: 'text-ink' },
                { label: 'жиры', value: preview?.fat ?? 0, cls: 'text-ink' },
              ].map((cell) => (
                <div key={cell.label}>
                  <p className={cn('tabnum font-display text-xl font-bold leading-none', cell.cls)}>
                    {fmt(cell.value, 1)}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
                    {cell.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-ink-3">
              На 100 {selected.unit}: {fmt(selected.calories)} ккал · Б {fmt(selected.protein, 1)} · У{' '}
              {fmt(selected.carbs, 1)} · Ж {fmt(selected.fat, 1)}
            </p>

            <Button
              color="primary"
              size="lg"
              className="mt-5 w-full rounded-lg font-display text-base uppercase tracking-wide"
              loading={isPending}
              leftIcon={<Check className="size-5" />}
              onClick={handleSubmit}
            >
              Добавить в {mealLabel.toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="px-5 pt-4">
              <div className="relative">
                <label htmlFor="add-food-search" className="sr-only">Поиск продуктов</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input
                  id="add-food-search"
                  autoFocus
                  placeholder="Поиск: курица, овсянка, протеин…"
                  value={rawQuery}
                  onChange={(e) => setRawQuery(e.target.value)}
                  className="h-11 rounded-lg pl-9"
                />
                {isFetching && (
                  <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-flame-500" />
                )}
              </div>

              <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
                <CategoryChip active={!category} onClick={() => setCategory('')} label="Все" />
                {categories.map((c) => (
                  <CategoryChip
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(category === c ? '' : c)}
                    label={c}
                  />
                ))}
              </div>
              {(categoriesQuery.isError || searchError) && (
                <div role="alert" className="mt-3 rounded-lg border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-ink-2">
                  <p>Не удалось загрузить продукты для поиска.</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => Promise.all([categoriesQuery.refetch(), foodsQuery.refetch(), personalFoodsQuery.refetch(), recentQuery.refetch()])}>Повторить</Button>
                </div>
              )}
            </div>

            <div className="mt-2 max-h-[46vh] overflow-y-auto border-t border-mist-2">
              {sections.recent.length > 0 && (
                <>
                  <SectionLabel>Недавние</SectionLabel>
                  {sections.recent.map((food) => (
                    <FoodRow
                      key={`recent-${food.source ?? 'catalog'}-${food.id}`}
                      food={food}
                      onSelect={() => {
                        setSelected(food);
                        setGrams(String(food.lastGrams));
                      }}
                    />
                  ))}
                  {sections.foods.length > 0 && <SectionLabel>Все продукты</SectionLabel>}
                </>
              )}

              {!searchError && sections.recent.length === 0 && sections.foods.length === 0 && !isFetching && (
                <p className="p-6 text-center text-sm text-ink-3">
                  Ничего не найдено. Попробуйте другое название.
                </p>
              )}

              {sections.foods.map((food) => (
                <FoodRow key={`${food.source ?? 'catalog'}-${food.id}`} food={food} onSelect={() => setSelected(food)} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-mist px-5 py-1.5 font-display text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">
      {children}
    </p>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-11 shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-200',
        active
          ? 'border-ink bg-ink text-mist'
          : 'border-mist-2 bg-paper text-ink-2 hover:border-flame-200 hover:bg-flame-50'
      )}
    >
      {label}
    </button>
  );
}

function FoodRow({ food, onSelect }: { food: Food; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-mist-2 px-5 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-flame-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{food.name}</p>
        <p className="tabnum mt-0.5 text-xs text-ink-3">
          Б {fmt(food.protein, 1)} · У {fmt(food.carbs, 1)} · Ж {fmt(food.fat, 1)} / 100 {food.unit}
        </p>
      </div>
      <span className="tabnum shrink-0 font-display text-base font-bold text-flame-600">
        {fmt(food.calories)}
        <span className="ml-1 text-[11px] font-medium uppercase text-ink-3">ккал</span>
      </span>
    </button>
  );
}
