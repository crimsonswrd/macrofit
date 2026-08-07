import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { useSession } from 'modelence/client';
import { Search } from 'lucide-react';
import Page from '@/client/components/Page';
import { FoodSourceBadge } from '@/client/components/foods/FoodStatusBadge';
import { OpenFoodFactsAttribution } from '@/client/components/foods/OpenFoodFactsAttribution';
import { Input } from '@/client/components/ui/Input';
import { Spinner } from '@/client/components/ui/Spinner';
import { Button } from '@/client/components/ui/Button';
import { cn } from '@/client/lib/utils';
import { fmt, type Food } from '@/client/lib/nutrition';
import { asCatalogFood, isOpenFoodFacts, mergeFoods, type DiaryFoodRecord } from '@/client/lib/foods';

export default function FoodsPage() {
  const { user } = useSession();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), 180);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const categoriesQuery = useQuery({
    ...modelenceQuery<string[]>('nutrition.getCategories', {}),
    staleTime: Infinity,
  });

  const catalogQuery = useQuery({
    ...modelenceQuery<Food[]>('nutrition.searchFoods', { query, category, limit: 100 }),
    staleTime: 60_000,
  });
  const personalQuery = useQuery({
    ...modelenceQuery<DiaryFoodRecord[]>('foods.searchPersonal', { query, limit: 100 }),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const categories = categoriesQuery.data ?? [];
  const catalogFoods = catalogQuery.data ?? [];
  const personalFoods = personalQuery.data ?? [];
  const isFetching = catalogQuery.isFetching;
  const isFetchingPersonal = personalQuery.isFetching;
  const foods = mergeFoods(personalFoods, catalogFoods.map(asCatalogFood));
  const searchError = catalogQuery.isError;
  const personalError = Boolean(user) && personalQuery.isError;

  return (
    <Page seo={{ title: 'База продуктов' }} className="pb-10">
      <div className="animate-slide-down">
        <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          База продуктов
        </h1>
        <p className="mt-1 text-sm font-medium text-ink-3">
          Общий каталог и ваши личные продукты. КБЖУ указаны на 100 г / 100 мл.
        </p>
      </div>

      {user && (
        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-mist-2 pb-2 text-sm font-semibold">
          <span className="flex min-h-11 shrink-0 items-center px-2 text-flame-500">Общий каталог</span>
          <Link to="/foods/mine" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Мои продукты</Link>
          <Link to="/foods/submissions" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Мои заявки</Link>
        </div>
      )}

      <div className="relative mt-5">
        <label htmlFor="foods-search" className="sr-only">Поиск по базе продуктов</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <Input
          id="foods-search"
          placeholder="Поиск по названию…"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className="h-11 rounded-lg pl-9"
        />
        {(isFetching || isFetchingPersonal) && (
          <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-flame-500" />
        )}
      </div>

      {(categoriesQuery.isError || searchError) && (
        <div role="alert" className="mt-4 rounded-xl border border-flame-500/30 bg-flame-500/10 p-4 text-sm text-ink-2">
          <p>{searchError ? 'Не удалось загрузить продукты.' : 'Не удалось загрузить категории.'}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => Promise.all([categoriesQuery.refetch(), catalogQuery.refetch(), ...(user ? [personalQuery.refetch()] : [])])}>Повторить</Button>
        </div>
      )}
      {personalError && !searchError && (
        <div role="status" className="mt-4 rounded-xl border border-mist-2 bg-paper p-4 text-sm text-ink-2">
          <p>Личные продукты сейчас недоступны, но общий каталог загружен.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => personalQuery.refetch()}>Повторить</Button>
        </div>
      )}

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip label="Все" active={!category} onClick={() => setCategory('')} />
        {categories.map((c) => (
          <Chip
            key={c}
            label={c}
            active={category === c}
            onClick={() => setCategory(category === c ? '' : c)}
          />
        ))}
      </div>

      <div className="mt-4 animate-slide-up overflow-hidden rounded-xl border border-mist-2 bg-paper shadow-sm">
        <div className="hidden grid-cols-[1fr_repeat(4,72px)] gap-2 border-b border-mist-2 bg-mist px-4 py-2.5 font-display text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3 sm:grid">
          <span>Продукт</span>
          <span className="text-right">Ккал</span>
          <span className="text-right">Белки</span>
          <span className="text-right">Углев.</span>
          <span className="text-right">Жиры</span>
        </div>

        {catalogQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-ink-3">Загружаем продукты…</p>
        ) : !searchError && foods.length === 0 && !isFetching ? (
          <p className="p-8 text-center text-sm text-ink-3">Ничего не найдено</p>
        ) : (
          <ul>
            {foods.map((food) => (
              <li
                key={`${food.source}-${food.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-mist-2 px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-flame-50 sm:grid-cols-[1fr_repeat(4,72px)]"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{food.name}</p>
                    <FoodSourceBadge source={food.source} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {[food.brand, food.category, `на 100 ${food.unit}`].filter(Boolean).join(' · ')}
                  </p>
                  {isOpenFoodFacts(food) && <OpenFoodFactsAttribution className="mt-1" />}
                </div>
                <span className="tabnum text-right font-display text-base font-bold text-flame-600 sm:text-sm">
                  {fmt(food.calories)}
                </span>
                <span className="tabnum col-span-2 text-xs text-ink-3 sm:hidden">
                  Б {fmt(food.protein, 1)} · У {fmt(food.carbs, 1)} · Ж {fmt(food.fat, 1)}
                </span>
                <span className="tabnum hidden text-right text-sm font-medium text-ink sm:block">
                  {fmt(food.protein, 1)}
                </span>
                <span className="tabnum hidden text-right text-sm font-medium text-ink sm:block">
                  {fmt(food.carbs, 1)}
                </span>
                <span className="tabnum hidden text-right text-sm font-medium text-ink sm:block">
                  {fmt(food.fat, 1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <OpenFoodFactsAttribution className="mt-4" />
    </Page>
  );
}

function Chip({
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
