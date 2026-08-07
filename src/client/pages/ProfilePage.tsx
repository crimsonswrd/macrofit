import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, History, Settings2 } from 'lucide-react';
import Page from '@/client/components/Page';
import { Button } from '@/client/components/ui/Button';
import { Spinner } from '@/client/components/ui/Spinner';
import { ProductSettings } from '@/client/components/preferences/ProductSettings';
import {
  formatProfileDate,
  formatTarget,
  GOAL_LABELS,
  SEX_CLASS_LABELS,
  type TargetHistoryItem,
  type UserProfile,
} from '@/client/lib/profile';

const JOB_LABELS: Record<UserProfile['jobActivity'], string> = {
  sedentary: 'Сидячая',
  light: 'Лёгкая',
  moderate: 'Подвижная',
  heavy: 'Тяжёлая',
};

const TRAINING_LABELS: Record<UserProfile['trainingType'], string> = {
  none: 'Без тренировок',
  strength: 'Силовые',
  cardio: 'Кардио',
  mixed: 'Смешанные',
};

export default function ProfilePage() {
  const profileQuery = useQuery({
    ...modelenceQuery<UserProfile | null>('profile.getCurrent', {}),
    retry: false,
  });
  const historyQuery = useQuery({
    ...modelenceQuery<TargetHistoryItem[]>('targets.listHistory', {}),
    retry: false,
  });

  if (profileQuery.isLoading) {
    return <Page seo={{ title: 'Профиль', noindex: true }}><div className="flex justify-center py-24"><Spinner className="size-8 text-flame-500" /></div></Page>;
  }

  if (profileQuery.isError) {
    return (
      <Page seo={{ title: 'Профиль', noindex: true }}>
        <section className="mx-auto max-w-xl rounded-2xl border border-flame-400 bg-paper p-7 text-center" role="alert">
          <h1 className="font-display text-3xl font-bold uppercase">Не удалось загрузить профиль</h1>
          <p className="mt-2 text-sm text-ink-2">Проверьте соединение и попробуйте снова.</p>
          <Button className="mt-6" color="primary" loading={profileQuery.isFetching} onClick={() => void profileQuery.refetch()}>
            Повторить
          </Button>
        </section>
      </Page>
    );
  }

  if (!profileQuery.data) {
    return (
      <Page seo={{ title: 'Профиль', noindex: true }}>
        <section className="mx-auto max-w-xl animate-slide-up rounded-2xl border border-mist-2 bg-paper p-7 text-center">
          <Settings2 className="mx-auto size-9 text-flame-500" />
          <h1 className="mt-4 font-display text-3xl font-bold uppercase">Настройте профиль</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">Ответьте на вопросы об образе жизни, чтобы получить понятный предварительный расчёт КБЖУ.</p>
          <Button render={<Link to="/onboarding" />} className="mt-6" color="primary" rightIcon={<ChevronRight className="size-4" />}>Начать настройку</Button>
        </section>
      </Page>
    );
  }

  const profile = profileQuery.data;
  const history = historyQuery.data ?? [];
  const activeTarget = history[0];

  return (
    <Page seo={{ title: 'Профиль и цели', noindex: true }} className="pb-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex animate-slide-down flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-flame-500">Настройки</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none">Профиль и цели</h1>
            <p className="mt-2 text-sm text-ink-3">Цели меняются только после нового расчёта и вашего подтверждения.</p>
          </div>
          <Button render={<Link to="/onboarding" />} variant="outline" leftIcon={<Settings2 className="size-4" />}>Изменить ответы</Button>
        </header>

        {historyQuery.isLoading ? (
          <section className="mt-6 flex min-h-36 items-center justify-center rounded-2xl border border-mist-2 bg-paper" aria-label="Загрузка текущей цели">
            <Spinner className="size-7 text-flame-500" />
          </section>
        ) : historyQuery.isError ? (
          <section className="mt-6 rounded-2xl border border-flame-400 bg-paper p-5 sm:p-6" role="alert">
            <h2 className="font-display text-xl font-bold uppercase">Не удалось загрузить текущую цель</h2>
            <p className="mt-2 text-sm text-ink-2">Повторите запрос, чтобы не принимать решения по устаревшим данным.</p>
            <Button className="mt-4" color="primary" loading={historyQuery.isFetching} onClick={() => void historyQuery.refetch()}>Повторить</Button>
          </section>
        ) : activeTarget ? (
          <section className="mt-6 overflow-hidden rounded-2xl border border-mist-2 bg-paper">
            <div className="hatch h-2" aria-hidden="true" />
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Текущая цель</p>
                  <h2 className="mt-1 font-display text-2xl font-bold uppercase">{GOAL_LABELS[activeTarget.goalMode]}</h2>
                </div>
                <span className="rounded-full bg-flame-100 px-3 py-1.5 text-xs font-bold text-ink">Подтверждена</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TargetMetric label="Калории" value={activeTarget.calories} unit="ккал" />
                <TargetMetric label="Белки" value={activeTarget.protein} unit="г" />
                <TargetMetric label="Углеводы" value={activeTarget.carbs} unit="г" />
                <TargetMetric label="Жиры" value={activeTarget.fat} unit="г" />
              </div>
              {activeTarget.confirmedAt && <p className="mt-4 text-xs text-ink-3">Подтверждено: {formatProfileDate(activeTarget.confirmedAt)}</p>}
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-flame-700 bg-paper p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold uppercase">Цель ещё не подтверждена</h2>
            <p className="mt-2 text-sm text-ink-2">Вернитесь к анкете, проверьте предварительный расчёт и подтвердите его явно.</p>
            <Button render={<Link to="/onboarding" />} className="mt-4" color="primary">Рассчитать цели</Button>
          </section>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold uppercase">Данные расчёта</h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <ProfileValue label="Дата рождения" value={formatProfileDate(profile.birthDate)} />
              <ProfileValue label="Класс формулы" value={SEX_CLASS_LABELS[profile.eerSexClass]} />
              <ProfileValue label="Рост" value={`${profile.heightCm} см`} />
              <ProfileValue label="Текущий вес" value={`${profile.currentWeightKg} кг`} />
              <ProfileValue label="Работа" value={JOB_LABELS[profile.jobActivity]} />
              <ProfileValue label="Шаги" value={`${formatTarget(profile.stepsPerDay)} в день`} />
              <ProfileValue label="Тренировки" value={`${profile.trainingSessionsPerWeek} в неделю`} />
              <ProfileValue label="Тип" value={TRAINING_LABELS[profile.trainingType]} />
            </dl>
          </section>

          <section className="rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6">
            <div className="flex items-center gap-2"><History className="size-5 text-flame-500" /><h2 className="font-display text-xl font-semibold uppercase">История целей</h2></div>
            {historyQuery.isLoading ? (
              <Spinner className="mt-6 size-6 text-flame-500" />
            ) : historyQuery.isError ? (
              <div className="mt-4 rounded-xl border border-flame-400 p-4" role="alert">
                <p className="text-sm text-ink-2">Не удалось загрузить историю целей.</p>
                <Button className="mt-3" size="sm" variant="outline" color="primary" loading={historyQuery.isFetching} onClick={() => void historyQuery.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : history.length === 0 ? (
              <p className="mt-4 text-sm text-ink-3">Подтверждённых целей пока нет.</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {history.map((item, index) => (
                  <li key={item.id ?? `${item.profileRevision}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-mist-2 bg-mist/40 p-3">
                    <div>
                      <p className="text-sm font-bold">{formatTarget(item.calories)} ккал · Б {formatTarget(item.protein)} · У {formatTarget(item.carbs)} · Ж {formatTarget(item.fat)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3"><CalendarDays className="size-3" /> {formatProfileDate(item.effectiveFrom ?? item.confirmedAt ?? item.createdAt)}</p>
                    </div>
                    {index === 0 && <span className="text-xs font-bold text-flame-500">Текущая</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <ProductSettings />
      </div>
    </Page>
  );
}

function TargetMetric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="rounded-xl border border-mist-2 bg-mist p-3"><p className="text-xs font-semibold text-ink-3">{label}</p><p className="tabnum mt-1 font-display text-2xl font-bold">{formatTarget(value)} <span className="text-sm text-ink-3">{unit}</span></p></div>;
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-ink-3">{label}</dt><dd className="mt-0.5 font-semibold text-ink-2">{value}</dd></div>;
}
