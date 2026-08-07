import { CircleAlert } from 'lucide-react';
import { buildChartPoints, formatProgressDate, formatWeight, trendQualityNotice, trendSummary, type WeightTrend } from '@/client/lib/progress';

const WIDTH = 640;
const HEIGHT = 220;

export function WeightTrendChart({ trend }: { trend: WeightTrend }) {
  const qualityNotice = trendQualityNotice(trend);
  if (trend.status !== 'ready') {
    return (
      <div>
        {qualityNotice && <TrendQualityWarning notice={qualityNotice} />}
        <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed border-mist-2 bg-mist/40 px-5 text-center">
          <div>
            <p className="font-display text-xl font-semibold uppercase text-ink">Тренд ещё формируется</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">{trend.message}</p>
            <p className="mt-3 text-xs text-ink-3">Сейчас записей: {trend.sampleCount}. Вес меняется из-за воды, соли, еды и нагрузки — одна точка ничего не доказывает.</p>
          </div>
        </div>
      </div>
    );
  }

  const points = buildChartPoints(trend.smoothedPoints, WIDTH, HEIGHT);
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const first = points[0];
  const last = points.at(-1)!;
  const summary = trendSummary(trend);

  return (
    <figure>
      {qualityNotice && <TrendQualityWarning notice={qualityNotice} />}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-labelledby="weight-chart-title weight-chart-description"
      >
        <title id="weight-chart-title">Сглаженный тренд веса</title>
        <desc id="weight-chart-description">
          {summary} От {formatWeight(first.weightKg)} килограмма {formatProgressDate(first.date)} до {formatWeight(last.weightKg)} килограмма {formatProgressDate(last.date)}.
        </desc>
        {[0, 1, 2, 3].map((row) => (
          <line key={row} x1="24" x2={WIDTH - 24} y1={24 + row * 57.3} y2={24 + row * 57.3} stroke="currentColor" className="text-mist-2" strokeWidth="1" />
        ))}
        <polyline points={line} fill="none" stroke="currentColor" className="text-flame-500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="5" fill="currentColor" className="text-paper" stroke="currentColor" strokeWidth="3" style={{ color: index === points.length - 1 ? '#ff5a4f' : '#d2d0c8' }} />
        ))}
      </svg>
      <figcaption className="mt-2 flex justify-between gap-4 text-xs text-ink-3">
        <span>{formatProgressDate(first.date)} · {formatWeight(first.weightKg)} кг</span>
        <span className="text-right">{formatProgressDate(last.date)} · {formatWeight(last.weightKg)} кг</span>
      </figcaption>
      <p className="mt-2 text-xs text-ink-3">{summary}</p>
    </figure>
  );
}

function TrendQualityWarning({ notice }: { notice: NonNullable<ReturnType<typeof trendQualityNotice>> }) {
  return (
    <aside className="mb-4 rounded-xl border border-carb/30 bg-carb/10 p-4" aria-label="Проверка измерений">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-carb" aria-hidden="true" />
        <div>
          <p className="font-semibold text-ink">{notice.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{notice.message}</p>
          <p className="mt-2 text-xs text-ink-3">Даты: {notice.dates.map(formatProgressDate).join(', ')}.</p>
        </div>
      </div>
    </aside>
  );
}
