import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createQueryKey, modelenceMutation, modelenceQuery } from '@modelence/react-query';
import { Check, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { Button } from '@/client/components/ui/Button';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import { fmt } from '@/client/lib/nutrition';
import { isModerationAccessError, type ModerationSubmission } from '@/client/lib/foods';

export default function FoodModerationPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = useQuery({
    ...modelenceQuery<ModerationSubmission[]>('foods.getModerationQueue', {}),
    retry: false,
    staleTime: 15_000,
  });
  const moderate = useMutation({
    ...modelenceMutation('foods.moderateSubmission'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: createQueryKey('foods.getModerationQueue', {}) });
      toast.success('Решение сохранено');
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const accessDenied = queue.isError && isModerationAccessError(queue.error);

  return (
    <Page seo={{ title: 'Модерация продуктов' }} className="pb-12">
      <h1 className="font-display text-3xl font-bold uppercase leading-none">Модерация продуктов</h1>
      <p className="mt-2 text-sm text-ink-3">Проверяйте название, единицы и КБЖУ перед публикацией.</p>
      <Link to="/foods/submissions" className="mt-4 inline-block text-sm font-semibold text-flame-500">← Назад к заявкам</Link>

      {queue.isLoading ? (
        <p className="py-12 text-center text-sm text-ink-3">Проверяем доступ…</p>
      ) : queue.isError ? (
        <div role="alert" className="mt-6 flex gap-3 rounded-2xl border border-mist-2 bg-paper p-5">
          <ShieldAlert className="size-5 shrink-0 text-ink-3" />
          <div>
            <p className="font-bold text-ink">{accessDenied ? 'Нет доступа к очереди' : 'Не удалось загрузить очередь'}</p>
            <p className="mt-1 text-sm text-ink-3">
              {accessDenied
                ? 'Раздел доступен только пользователям с ролью модератора продуктов.'
                : 'Проверьте соединение и повторите запрос. Решения модерации не затронуты.'}
            </p>
            {!accessDenied && <Button size="sm" variant="outline" className="mt-3 min-h-11" onClick={() => queue.refetch()}>Повторить</Button>}
          </div>
        </div>
      ) : queue.data?.length ? (
        <ul className="mt-6 space-y-4">
          {queue.data.map((submission) => (
            <li key={submission.id} className="rounded-2xl border border-mist-2 bg-paper p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold uppercase text-ink">{submission.food?.name ?? 'Без названия'}</h2>
                  <p className="mt-1 text-xs text-ink-3">
                    {submission.authorHandle ? `Автор: ${submission.authorHandle} · ` : ''}
                    {new Date(submission.submittedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
              {submission.food && (
                <>
                  <p className="tabnum mt-4 text-sm text-ink-2">
                    {fmt(submission.food.calories)} ккал · Б {fmt(submission.food.protein, 1)} · У {fmt(submission.food.carbs, 1)} · Ж {fmt(submission.food.fat, 1)} / 100 {submission.food.unit}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {[submission.food.brand, submission.food.category, submission.food.barcode].filter(Boolean).join(' · ')}
                  </p>
                </>
              )}
              <Label htmlFor={`moderation-note-${submission.id}`} className="mt-4 text-sm font-semibold">Комментарий к решению</Label>
              <Input
                id={`moderation-note-${submission.id}`}
                className="mt-2"
                placeholder="Комментарий к решению (для отклонения обязателен)"
                value={notes[submission.id] ?? ''}
                onChange={(event) => setNotes((current) => ({ ...current, [submission.id]: event.target.value }))}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  color="primary"
                  leftIcon={<Check className="size-4" />}
                  loading={moderate.isPending}
                  onClick={() => moderate.mutate({ submissionId: submission.id, decision: 'approved', reviewNote: notes[submission.id]?.trim() || undefined })}
                >
                  Одобрить
                </Button>
                <Button
                  variant="outline"
                  color="destructive"
                  leftIcon={<X className="size-4" />}
                  disabled={moderate.isPending || !notes[submission.id]?.trim()}
                  onClick={() => moderate.mutate({ submissionId: submission.id, decision: 'rejected', reviewNote: notes[submission.id].trim() })}
                >
                  Отклонить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-mist-2 bg-paper p-8 text-center">
          <p className="font-bold text-ink">Очередь пуста</p>
          <p className="mt-1 text-sm text-ink-3">Новые заявки появятся здесь после отправки пользователями.</p>
        </div>
      )}
    </Page>
  );
}
