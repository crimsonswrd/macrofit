import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modelenceMutation, modelenceQuery } from '@modelence/react-query';
import { Activity, Scale, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { AdjustmentProposalCard } from '@/client/components/progress/AdjustmentProposalCard';
import { WeighInForm } from '@/client/components/progress/WeighInForm';
import { WeightTrendChart } from '@/client/components/progress/WeightTrendChart';
import { Button } from '@/client/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/client/components/ui/Dialog';
import { Spinner } from '@/client/components/ui/Spinner';
import { InterfaceModeToggle } from '@/client/components/preferences/InterfaceModeToggle';
import { useInterfaceMode } from '@/client/lib/preferences';
import {
  formatProgressDate,
  formatWeight,
  goalProgress,
  normalizeDashboard,
  normalizeHistory,
  normalizeProposal,
  normalizeTrend,
  isProposalConflictError,
  proposalResolution,
  type ProgressDashboard,
  type WeighIn,
} from '@/client/lib/progress';
import { todayKey } from '@/client/lib/nutrition';

export default function ProgressPage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<WeighIn | null>(null);
  const [mode, setMode] = useInterfaceMode();

  const dashboardQuery = useQuery({
    ...modelenceQuery<unknown>('weight.getDashboard', { asOfDate: todayKey() }),
    retry: false,
  });
  const historyQuery = useQuery({
    ...modelenceQuery<unknown>('weight.getHistory', {}),
    retry: false,
  });
  const trendQuery = useQuery({
    ...modelenceQuery<unknown>('weight.getTrend', { asOfDate: todayKey() }),
    retry: false,
  });
  const proposalQuery = useQuery({
    ...modelenceQuery<unknown>('targets.getOpenProposal', {}),
    retry: false,
  });

  const refreshProgress = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['weight.getDashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['weight.getHistory'] }),
    queryClient.invalidateQueries({ queryKey: ['weight.getTrend'] }),
    queryClient.invalidateQueries({ queryKey: ['targets.getOpenProposal'] }),
    queryClient.invalidateQueries({ queryKey: ['targets.listHistory'] }),
    queryClient.invalidateQueries({ queryKey: ['nutrition.getDay'] }),
  ]);

  const upsert = useMutation({
    ...modelenceMutation('weight.upsertWeighIn'),
    onSuccess: () => {
      refreshProgress();
      toast.success('Вес сохранён');
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const remove = useMutation({
    ...modelenceMutation('weight.deleteWeighIn'),
    onSuccess: () => {
      setDeleting(null);
      refreshProgress();
      toast.success('Запись удалена');
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const accept = useMutation({
    ...modelenceMutation('targets.acceptProposal'),
    onSuccess: async (result) => {
      await refreshProgress();
      if (proposalResolution(result, 'accepted') === 'accepted') toast.success('Новые цели подтверждены');
      else toast('Предложение уже было обработано. Данные обновлены.');
    },
    onError: async (error) => {
      if (isProposalConflictError(error)) {
        await refreshProgress();
        toast('Предложение уже было обработано. Данные обновлены.');
      } else toast.error((error as Error).message);
    },
  });
  const dismiss = useMutation({
    ...modelenceMutation('targets.dismissProposal'),
    onSuccess: async (result) => {
      await refreshProgress();
      if (proposalResolution(result, 'dismissed') === 'dismissed') toast.success('Предложение отклонено');
      else toast('Предложение уже было обработано. Данные обновлены.');
    },
    onError: async (error) => {
      if (isProposalConflictError(error)) {
        await refreshProgress();
        toast('Предложение уже было обработано. Данные обновлены.');
      } else toast.error((error as Error).message);
    },
  });

  if (dashboardQuery.isLoading) {
    return <Page seo={{ title: 'Прогресс', noindex: true }}><div className="flex justify-center py-24"><Spinner className="size-8 text-flame-500" /></div></Page>;
  }

  if (dashboardQuery.isError) {
    return (
      <Page seo={{ title: 'Прогресс', noindex: true }}>
        <div className="mx-auto max-w-xl rounded-2xl border border-flame-500/30 bg-paper p-6 text-center">
          <Scale className="mx-auto size-9 text-flame-500" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold uppercase">Не удалось загрузить прогресс</h1>
          <p className="mt-2 text-sm text-ink-3">Обновите страницу или попробуйте чуть позже. Записи дневника не затронуты.</p>
          <Button className="mt-5" color="primary" onClick={() => dashboardQuery.refetch()}>Повторить</Button>
        </div>
      </Page>
    );
  }

  const dashboard = normalizeDashboard(dashboardQuery.data);
  if (historyQuery.data !== undefined) dashboard.history = normalizeHistory(historyQuery.data);
  if (trendQuery.data !== undefined) dashboard.trend = normalizeTrend(trendQuery.data);
  const proposal = normalizeProposal(proposalQuery.data) ?? dashboard.proposal;
  const progress = goalProgress(dashboard.history, dashboard.goal.goalWeightKg);
  const current = dashboard.goal.currentWeightKg ?? dashboard.history[0]?.weightKg;
  const rate = dashboard.trend.actualKgPerWeek;
  const rateIcon = rate === undefined || rate === 0
    ? undefined
    : rate > 0
      ? <TrendingUp className="size-4" aria-hidden="true" />
      : <TrendingDown className="size-4" aria-hidden="true" />;
  const secondaryErrors = [
    historyQuery.isError && { label: 'историю измерений', retry: historyQuery.refetch },
    trendQuery.isError && { label: 'тренд', retry: trendQuery.refetch },
    proposalQuery.isError && { label: 'предложение по целям', retry: proposalQuery.refetch },
  ].filter(Boolean) as Array<{ label: string; retry: () => unknown }>;

  return (
    <Page seo={{ title: 'Прогресс веса', noindex: true }} className="pb-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex animate-slide-down flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-flame-500">Без спешки и оценок</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none">Прогресс веса</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">Смотрите на направление за недели, а не на случайное число утром. Здесь нет «хороших» и «плохих» взвешиваний — только данные для вашего решения.</p>
          </div>
          <InterfaceModeToggle mode={mode} onChange={setMode} compact />
        </header>

        {secondaryErrors.length > 0 && (
          <div role="alert" className="mt-5 rounded-2xl border border-flame-500/30 bg-flame-500/10 p-4 text-sm text-ink-2">
            <p>Не удалось загрузить: {secondaryErrors.map((item) => item.label).join(', ')}. Остальные данные показаны ниже.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {secondaryErrors.map((item) => <Button key={item.label} size="sm" variant="outline" onClick={() => item.retry()}>Повторить: {item.label}</Button>)}
            </div>
          </div>
        )}

        <div className="mt-6"><WeighInForm history={dashboard.history} pending={upsert.isPending} onSubmit={(input) => upsert.mutate(input)} /></div>

        {proposal && (
          <div className="mt-5">
            <AdjustmentProposalCard
              proposal={proposal}
              accepting={accept.isPending}
              dismissing={dismiss.isPending}
              onAccept={() => accept.mutate({ proposalId: proposal.id })}
              onDismiss={() => dismiss.mutate({ proposalId: proposal.id })}
            />
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Metric label="Текущий вес" value={current !== undefined ? `${formatWeight(current)} кг` : '—'} detail={dashboard.history[0] ? `на ${formatProgressDate(dashboard.history[0].date)}` : 'добавьте первое измерение'} />
          <Metric label="Целевой вес" value={dashboard.goal.goalWeightKg !== undefined ? `${formatWeight(dashboard.goal.goalWeightKg)} кг` : 'Без цели'} detail="из подтверждённого профиля" />
          <Metric label="Темп тренда" value={rate !== undefined ? `${rate > 0 ? '+' : ''}${formatWeight(rate)} кг/нед` : 'Формируется'} detail={dashboard.trend.actualPercentPerWeek !== undefined ? `${dashboard.trend.actualPercentPerWeek > 0 ? '+' : ''}${dashboard.trend.actualPercentPerWeek.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}% в неделю` : 'нужно больше данных'} icon={rateIcon} />
        </div>

        {progress !== undefined && (
          <section className="mt-4 rounded-2xl border border-mist-2 bg-paper p-5" aria-labelledby="goal-progress-title">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-ink-3">Путь к цели</p><h2 id="goal-progress-title" className="mt-1 font-display text-2xl font-bold uppercase">{Math.round(progress)}% пути</h2></div>
              <Activity className="size-6 text-flame-500" aria-hidden="true" />
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-mist-2" role="progressbar" aria-label="Прогресс к целевому весу" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <div className="h-full rounded-full bg-flame-500 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-ink-3">Путь считается от первой записи. Колебания и паузы нормальны; важнее устойчивый ритм, который подходит вашей жизни.</p>
          </section>
        )}

        {mode === 'simple' ? (
          <details className="mt-5 rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6">
            <summary className="cursor-pointer font-display text-xl font-bold uppercase text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flame-500">
              График и история измерений
            </summary>
            <p className="mt-2 text-sm text-ink-3">Подробности сохранены, но не мешают основному экрану.</p>
            <ProgressDetails dashboard={dashboard} onDelete={setDeleting} nested />
          </details>
        ) : (
          <ProgressDetails dashboard={dashboard} onDelete={setDeleting} />
        )}
      </div>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogTitle className="font-display text-2xl uppercase">Удалить измерение?</DialogTitle>
          <DialogDescription className="text-ink-3">{deleting ? `${formatProgressDate(deleting.date)} · ${formatWeight(deleting.weightKg)} кг. Тренд будет пересчитан.` : ''}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Отмена</Button>
            <Button color="destructive" loading={remove.isPending} onClick={() => deleting && remove.mutate({ id: deleting.id })}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: React.ReactNode }) {
  return <div className="rounded-2xl border border-mist-2 bg-paper p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-3">{icon}{label}</div><p className="tabnum mt-2 font-display text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-ink-3">{detail}</p></div>;
}

function ProgressDetails({ dashboard, onDelete, nested = false }: {
  dashboard: ProgressDashboard;
  onDelete: (item: WeighIn) => void;
  nested?: boolean;
}) {
  return (
    <div className={nested ? 'mt-4' : undefined}>
      <section className={nested ? 'border-t border-mist-2 pt-5' : 'mt-5 rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6'} aria-labelledby="trend-title">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Сглаженные данные</p>
          <h2 id="trend-title" className="mt-1 font-display text-2xl font-bold uppercase">Тренд</h2>
          <p className="mt-1 text-sm text-ink-3">Сглаживание уменьшает дневной шум от жидкости, пищи, соли и восстановления после нагрузок.</p>
        </div>
        <WeightTrendChart trend={dashboard.trend} />
      </section>

      <section className={nested ? 'mt-5 overflow-hidden border-t border-mist-2 pt-5' : 'mt-5 overflow-hidden rounded-2xl border border-mist-2 bg-paper'} aria-labelledby="history-title">
        <div className={nested ? '' : 'border-b border-mist-2 p-5 sm:p-6'}>
          <h2 id="history-title" className="font-display text-2xl font-bold uppercase">История измерений</h2>
          <p className="mt-1 text-sm text-ink-3">Исходные записи без сглаживания.</p>
        </div>
        {dashboard.history.length === 0 ? (
          <p className="p-8 text-center text-sm text-ink-3">История пуста. Добавьте первое взвешивание выше.</p>
        ) : (
          <ul className={nested ? 'mt-3 overflow-hidden rounded-xl border border-mist-2' : undefined}>
            {dashboard.history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 border-b border-mist-2 px-5 py-3 last:border-b-0">
                <div><p className="font-semibold text-ink">{formatProgressDate(item.date)}</p><p className="tabnum mt-0.5 font-display text-xl font-bold">{formatWeight(item.weightKg)} кг</p></div>
                <Button size="sm" variant="ghost" color="destructive" leftIcon={<Trash2 className="size-4" />} onClick={() => onDelete(item)}>Удалить</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
