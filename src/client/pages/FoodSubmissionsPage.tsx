import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modelenceQuery } from '@modelence/react-query';
import Page from '@/client/components/Page';
import { Button } from '@/client/components/ui/Button';
import { SubmissionStatusBadge } from '@/client/components/foods/FoodStatusBadge';
import { fmt } from '@/client/lib/nutrition';
import type { FoodSubmission, ModerationSubmission } from '@/client/lib/foods';

export default function FoodSubmissionsPage() {
  const submissions = useQuery({
    ...modelenceQuery<FoodSubmission[]>('foods.getMySubmissions', {}),
    staleTime: 30_000,
  });
  const moderationAccess = useQuery({
    ...modelenceQuery<ModerationSubmission[]>('foods.getModerationQueue', {}),
    retry: false,
    staleTime: 30_000,
  });

  return (
    <Page seo={{ title: 'Мои заявки' }} className="pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none">Мои заявки</h1>
          <p className="mt-2 text-sm text-ink-3">Статус продуктов, предложенных в общий каталог.</p>
        </div>
        {moderationAccess.isSuccess && (
          <Link to="/foods/moderation" className="text-sm font-bold text-flame-500 hover:text-flame-600">
            Модерация
          </Link>
        )}
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-mist-2 pb-2 text-sm font-semibold">
        <Link to="/foods" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Общий каталог</Link>
        <Link to="/foods/mine" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Мои продукты</Link>
        <span className="flex min-h-11 shrink-0 items-center px-2 text-flame-500">Мои заявки</span>
      </div>

      <div className="mt-6">
        {submissions.isLoading ? (
          <p className="py-10 text-center text-sm text-ink-3">Загружаем заявки…</p>
        ) : submissions.isError ? (
          <div role="alert" className="rounded-xl border border-flame-500/30 bg-flame-500/10 p-4 text-sm text-ink-2">
            <p>Не удалось загрузить заявки.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => submissions.refetch()}>Повторить</Button>
          </div>
        ) : submissions.data?.length ? (
          <ul className="space-y-3">
            {submissions.data.map((submission) => (
              <li key={submission.id} className="rounded-2xl border border-mist-2 bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-ink">{submission.food?.name ?? 'Личный продукт'}</h2>
                    <p className="mt-1 text-xs text-ink-3">
                      Отправлено {new Date(submission.submittedAt).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <SubmissionStatusBadge status={submission.status} />
                </div>
                {submission.food && (
                  <p className="tabnum mt-4 text-sm text-ink-3">
                    {fmt(submission.food.calories)} ккал · Б {fmt(submission.food.protein, 1)} · У {fmt(submission.food.carbs, 1)} · Ж {fmt(submission.food.fat, 1)} / 100 {submission.food.unit}
                  </p>
                )}
                {submission.reviewNote && (
                  <div className="mt-4 rounded-lg bg-mist p-3 text-sm text-ink-2">
                    <span className="font-bold">Комментарий модератора:</span> {submission.reviewNote}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-mist-2 bg-paper p-8 text-center">
            <p className="font-bold text-ink">Заявок пока нет</p>
            <p className="mt-1 text-sm text-ink-3">Создайте личный продукт и предложите его в общий каталог.</p>
            <Link to="/foods/mine" className="mt-4 inline-block text-sm font-bold text-flame-500">К моим продуктам</Link>
          </div>
        )}
      </div>
    </Page>
  );
}
