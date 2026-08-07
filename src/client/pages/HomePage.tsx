import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from 'modelence/client';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { ChevronLeft, ChevronRight, Plus, Pencil, Flame, Dumbbell, Database } from 'lucide-react';
import Page from '@/client/components/Page';
import DaySummary from '@/client/components/nutrition/DaySummary';
import AddFoodDialog from '@/client/components/nutrition/AddFoodDialog';
import EditDiaryEntryDialog from '@/client/components/nutrition/EditDiaryEntryDialog';
import { DailyRhythmCard } from '@/client/components/nutrition/DailyRhythmCard';
import { SmartReminderCard } from '@/client/components/nutrition/SmartReminderCard';
import { WhatToEatCard } from '@/client/components/nutrition/WhatToEatCard';
import { InterfaceModeToggle } from '@/client/components/preferences/InterfaceModeToggle';
import { Button } from '@/client/components/ui/Button';
import { IconButton } from '@/client/components/ui/IconButton';
import { Spinner } from '@/client/components/ui/Spinner';
import { useSmartReminderNotifications } from '@/client/hooks/useSmartReminderNotifications';
import { defaultMealForHour } from '@/client/lib/foodSuggestions';
import { useInterfaceMode, useReminderSettings } from '@/client/lib/preferences';
import { buildSmartReminder } from '@/client/lib/wellbeing';
import { cn } from '@/client/lib/utils';
import {
  MEALS,
  fmt,
  formatDateKey,
  formatWeekday,
  shiftDateKey,
  todayKey,
  type DayData,
  type DiaryItem,
  type Meal,
} from '@/client/lib/nutrition';

export default function HomePage() {
  const { user } = useSession();
  return user ? <Diary /> : <Landing />;
}

/* ---------------------------------- Diary --------------------------------- */

function Diary() {
  const [date, setDate] = useState(todayKey());
  const [addMeal, setAddMeal] = useState<Meal | null>(null);
  const [editingItem, setEditingItem] = useState<DiaryItem | null>(null);
  const [whatToEatOpen, setWhatToEatOpen] = useState(false);
  const [dismissedReminder, setDismissedReminder] = useState('');
  const [mode, setMode] = useInterfaceMode();
  const [reminderSettings] = useReminderSettings();

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    ...modelenceQuery<DayData>('nutrition.getDay', { date }),
    placeholderData: (prev) => prev,
    retry: 2,
  });

  const items = data?.items ?? [];
  const isToday = date === todayKey();
  useSmartReminderNotifications(data);
  const reminder = data && isToday
    ? buildSmartReminder(data, new Date(), reminderSettings)
    : null;
  const reminderKey = reminder ? `${date}:${reminder.id}` : '';

  return (
    <Page seo={{ title: 'Дневник питания' }} className="pb-10">
      {/* Date switcher */}
      <div className="mb-5 flex animate-slide-down items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
            {formatDateKey(date)}
          </h1>
          <p className="mt-1 text-sm font-medium text-ink-3">{formatWeekday(date)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <IconButton
              variant="outline"
              aria-label="Предыдущий день"
              onClick={() => setDate(shiftDateKey(date, -1))}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            {!isToday && (
              <Button variant="soft" onClick={() => setDate(todayKey())}>
                Сегодня
              </Button>
            )}
            <IconButton
              variant="outline"
              aria-label="Следующий день"
              onClick={() => setDate(shiftDateKey(date, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
          <InterfaceModeToggle mode={mode} onChange={setMode} compact />
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex justify-center py-20">
          <Spinner className="size-8 text-flame-500" />
        </div>
      ) : isError && !data ? (
        <section className="rounded-2xl border border-flame-400 bg-paper p-6 text-center" role="alert">
          <h2 className="font-display text-2xl font-bold uppercase">Не удалось загрузить дневник</h2>
          <p className="mt-2 text-sm text-ink-2">Проверьте соединение и попробуйте получить записи ещё раз.</p>
          <Button className="mt-5" color="primary" loading={isFetching} onClick={() => void refetch()}>
            Повторить
          </Button>
        </section>
      ) : (
        <>
          {isError && (
            <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-flame-400 bg-paper p-4 sm:flex-row sm:items-center" role="alert">
              <p className="text-sm text-ink-2">Не удалось обновить дневник. Показаны последние загруженные данные.</p>
              <Button size="sm" variant="outline" color="primary" loading={isFetching} onClick={() => void refetch()}>
                Повторить
              </Button>
            </div>
          )}
          {data && <DaySummary totals={data.totals} targets={data.targets} mode={mode} />}

          {data && isToday && (
            <>
              {reminder && dismissedReminder !== reminderKey && (
                <SmartReminderCard
                  reminder={reminder}
                  onAdd={() => setAddMeal(defaultMealForHour(new Date().getHours()))}
                  onSuggest={() => setWhatToEatOpen(true)}
                  onDismiss={() => setDismissedReminder(reminderKey)}
                />
              )}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <WhatToEatCard day={data} mode={mode} open={whatToEatOpen} onOpenChange={setWhatToEatOpen} />
                <DailyRhythmCard day={data} />
              </div>
            </>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {MEALS.map((mealDef, index) => {
              const mealItems = items.filter((item) => item.meal === mealDef.key);
              const mealCalories = mealItems.reduce((sum, item) => sum + item.calories, 0);

              return (
                <section
                  key={mealDef.key}
                  className="animate-slide-up overflow-hidden rounded-xl border border-mist-2 bg-paper shadow-sm"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-mist-2 px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <h2 className="font-display text-lg font-semibold uppercase tracking-tight">
                        {mealDef.label}
                      </h2>
                      <span className="tabnum text-sm font-semibold text-ink-3">
                        {fmt(mealCalories)} ккал
                      </span>
                    </div>
                    <Button
                      size="sm"
                      color="primary"
                      variant="soft"
                      leftIcon={<Plus className="size-4" />}
                      onClick={() => setAddMeal(mealDef.key)}
                    >
                      Добавить
                    </Button>
                  </header>

                  {mealItems.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-ink-3">
                      Пока ничего не добавлено
                    </p>
                  ) : (
                    <ul>
                      {mealItems.map((item) => (
                        <li
                          key={item.id}
                          className="group flex animate-pop items-center justify-between gap-3 border-b border-mist-2 px-4 py-2.5 last:border-b-0 hover:bg-mist/60"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {item.foodName}
                            </p>
                            <p className="tabnum mt-0.5 text-xs text-ink-3">
                              {fmt(item.grams)} {item.unit}
                              {mode === 'sport' && <> · Б {fmt(item.protein, 1)} · У {fmt(item.carbs, 1)} · Ж {fmt(item.fat, 1)}</>}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="tabnum font-display text-base font-bold text-ink">
                              {fmt(item.calories)}
                            </span>
                            <button
                              type="button"
                              aria-label={`Изменить ${item.foodName}`}
                              onClick={() => setEditingItem(item)}
                              className="inline-flex size-11 items-center justify-center rounded-md text-ink-3 transition-all duration-200 hover:bg-flame-50 hover:text-flame-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500 lg:size-8 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
                            >
                              <Pencil className="size-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs text-ink-3">
            Ваш ориентир на эту дату: {fmt(data?.targets.calories ?? 0)} ккал · Б {fmt(data?.targets.protein ?? 0)} г
            {mode === 'sport' && <> · У {fmt(data?.targets.carbs ?? 0)} г · Ж {fmt(data?.targets.fat ?? 0)} г</>}
          </p>
        </>
      )}

      {addMeal && (
        <AddFoodDialog
          open={addMeal !== null}
          onOpenChange={(open) => !open && setAddMeal(null)}
          date={date}
          meal={addMeal}
        />
      )}
      <EditDiaryEntryDialog
        item={editingItem}
        date={date}
        onOpenChange={(open) => !open && setEditingItem(null)}
      />
    </Page>
  );
}

/* --------------------------------- Landing -------------------------------- */

function Landing() {
  const features = [
    {
      icon: Database,
      title: 'Понятный следующий шаг',
      text: 'FORMETRA показывает не только цифры, но и что можно съесть с учётом остатка дня.',
    },
    {
      icon: Dumbbell,
      title: 'Просто или подробно',
      text: 'Начните с калорий и белка, а спортивный режим откроет полный контроль БЖУ.',
    },
    {
      icon: Flame,
      title: 'Прогресс без давления',
      text: 'Спокойные ориентиры и тренд за недели вместо оценок одного дня или одного взвешивания.',
    },
  ];

  return (
    <Page seo={{ title: 'Счётчик калорий и КБЖУ для спортсменов' }}>
      <section className="animate-slide-up overflow-hidden rounded-2xl border border-mist-2 bg-paper shadow-sm">
        <div className="hatch h-2 w-full" aria-hidden="true" />
        <div className="px-6 py-10 text-center sm:px-12 sm:py-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-flame-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-flame-600">
            Ваш навигатор питания
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold uppercase leading-[1.05] tracking-tight sm:text-6xl">
            Меняйте форму <span className="text-flame-500">без лишнего шума</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-2 sm:text-lg">
            FORMETRA рассчитывает персональный ориентир, помогает выбрать следующий приём пищи
            и показывает устойчивый прогресс без чувства вины.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              render={<Link to="/signup" />}
              color="primary"
              size="lg"
              className="w-full rounded-lg px-8 font-display text-base uppercase tracking-wide sm:w-auto"
            >
              Создать аккаунт
            </Button>
            <Button render={<Link to="/foods" />} variant="outline" size="lg" className="w-full rounded-lg px-8 sm:w-auto">
              Смотреть базу продуктов
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className={cn(
              'animate-slide-up rounded-xl border border-mist-2 bg-paper p-5 shadow-sm',
              'transition-transform duration-200 hover:-translate-y-0.5'
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-flame-50 text-flame-600">
              <feature.icon className="size-5" />
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold uppercase tracking-tight">
              {feature.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{feature.text}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}
