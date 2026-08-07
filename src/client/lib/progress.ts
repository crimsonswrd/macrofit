export interface WeighIn {
  id: string;
  date: string;
  weightKg: number;
}

export interface TrendPoint {
  date: string;
  weightKg: number;
}

export interface WeightTrend {
  status: 'insufficient' | 'ready';
  sampleCount: number;
  spanDays: number;
  actualKgPerWeek?: number;
  actualPercentPerWeek?: number;
  smoothedPoints: TrendPoint[];
  message: string;
  suspectDates: string[];
  excludedSampleCount: number;
  latestSampleSuspect: boolean;
}

export interface TrendQualityNotice {
  title: string;
  message: string;
  dates: string[];
}

export interface WeightGoal {
  mode: string;
  goalWeightKg?: number;
  currentWeightKg?: number;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface AdjustmentProposal {
  id: string;
  reason: string;
  evidence: string[];
  current: MacroTargets;
  proposed: MacroTargets;
  createdAt?: string;
}

export interface ProgressDashboard {
  history: WeighIn[];
  trend: WeightTrend;
  goal: WeightGoal;
  proposal?: AdjustmentProposal;
}

export interface ChartPoint extends TrendPoint {
  x: number;
  y: number;
}

export type ProposalResolution = 'accepted' | 'dismissed' | 'conflict';

type UnknownRecord = Record<string, unknown>;

const EMPTY_TREND: WeightTrend = {
  status: 'insufficient',
  sampleCount: 0,
  spanDays: 0,
  smoothedPoints: [],
  message: 'Добавьте ещё несколько взвешиваний в разные дни — так появится устойчивый тренд.',
  suspectDates: [],
  excludedSampleCount: 0,
  latestSampleSuspect: false,
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? value as UnknownRecord : {};
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function normalizeHistory(value: unknown): WeighIn[] {
  const raw = record(value);
  let source: unknown[] = [];
  if (Array.isArray(value)) {
    source = value;
  } else if (Array.isArray(raw.history)) {
    source = raw.history;
  }
  return source.flatMap((item) => {
    const row = record(item);
    const id = text(row.id) ?? text(row._id);
    const date = text(row.date);
    const weightKg = finite(row.weightKg) ?? finite(row.weight);
    return id && date && weightKg !== undefined ? [{ id, date, weightKg }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export function normalizeTrend(value: unknown): WeightTrend {
  const raw = record(value);
  let rawPoints: unknown[] = [];
  if (Array.isArray(raw.smoothedPoints)) {
    rawPoints = raw.smoothedPoints;
  } else if (Array.isArray(raw.points)) {
    rawPoints = raw.points;
  }
  const smoothedPoints = rawPoints.flatMap((item) => {
    const point = record(item);
    const date = text(point.date);
    const weightKg = finite(point.weightKg) ?? finite(point.weight);
    return date && weightKg !== undefined ? [{ date, weightKg }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  const sampleCount = finite(raw.sampleCount) ?? smoothedPoints.length;
  const status = raw.status === 'ready' && smoothedPoints.length >= 2 ? 'ready' : 'insufficient';
  return {
    status,
    sampleCount,
    spanDays: finite(raw.spanDays) ?? 0,
    actualKgPerWeek: finite(raw.actualKgPerWeek),
    actualPercentPerWeek: finite(raw.actualPercentPerWeek),
    smoothedPoints,
    message: text(raw.message) ?? EMPTY_TREND.message,
    suspectDates: Array.isArray(raw.suspectDates)
      ? raw.suspectDates.map(text).filter((date): date is string => Boolean(date))
      : [],
    excludedSampleCount: finite(raw.excludedSampleCount) ?? 0,
    latestSampleSuspect: raw.latestSampleSuspect === true,
  };
}

export function normalizeTargets(value: unknown): MacroTargets | undefined {
  const raw = record(value);
  const calories = finite(raw.calories);
  const protein = finite(raw.protein);
  const carbs = finite(raw.carbs);
  const fat = finite(raw.fat);
  return calories !== undefined && protein !== undefined && carbs !== undefined && fat !== undefined
    ? { calories, protein, carbs, fat }
    : undefined;
}

export function normalizeProposal(value: unknown): AdjustmentProposal | undefined {
  const raw = record(value);
  const id = text(raw.id) ?? text(raw.proposalId) ?? text(raw._id);
  const current = normalizeTargets(raw.current ?? raw.oldTargets ?? raw.previousTargets);
  const proposed = normalizeTargets(raw.proposed ?? raw.newTargets ?? raw.proposedTargets);
  if (!id || !current || !proposed) return undefined;
  const rawEvidence = raw.evidence;
  const evidence = Array.isArray(rawEvidence)
    ? rawEvidence.map(text).filter((item): item is string => Boolean(item))
    : proposalEvidence(record(rawEvidence));
  return {
    id,
    reason: text(raw.reason) ?? text(raw.explanation) ?? 'Тренд веса отличается от выбранного темпа.',
    evidence,
    current,
    proposed,
    createdAt: text(raw.createdAt),
  };
}

export function normalizeDashboard(value: unknown): ProgressDashboard {
  const raw = record(value);
  const goalRaw = record(raw.goal);
  const history = normalizeHistory(raw.history);
  return {
    history,
    trend: normalizeTrend(raw.trend),
    goal: {
      mode: text(goalRaw.mode) ?? 'maintain',
      goalWeightKg: finite(goalRaw.goalWeightKg) ?? finite(goalRaw.weightKg),
      currentWeightKg: finite(goalRaw.currentWeightKg) ?? history[0]?.weightKg,
    },
    proposal: normalizeProposal(raw.proposal),
  };
}

function proposalEvidence(raw: UnknownRecord): string[] {
  const evidence: string[] = [];
  const sampleCount = finite(raw.sampleCount);
  const spanDays = finite(raw.spanDays);
  if (sampleCount !== undefined && spanDays !== undefined) {
    evidence.push(`${sampleCount} измерений за ${spanDays} дней.`);
  }
  const actual = finite(raw.actualPercentPerWeek);
  const expected = finite(raw.expectedPercentPerWeek);
  if (actual !== undefined && expected !== undefined) {
    const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
    evidence.push(`Фактический темп ${signed(actual)} в неделю, ориентир ${signed(expected)}.`);
  }
  const windowStart = text(raw.windowStart);
  const windowEnd = text(raw.windowEnd);
  if (windowStart && windowEnd) {
    evidence.push(`Период наблюдения: ${formatProgressDate(windowStart)} — ${formatProgressDate(windowEnd)}.`);
  }
  return evidence;
}

export function buildChartPoints(points: TrendPoint[], width = 640, height = 220, padding = 24): ChartPoint[] {
  if (points.length === 0) return [];
  const chronological = [...points].sort((left, right) => calendarDay(left.date) - calendarDay(right.date));
  const weights = chronological.map((point) => point.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const firstDay = calendarDay(chronological[0].date);
  const lastDay = calendarDay(chronological.at(-1)!.date);
  const daySpan = lastDay - firstDay;
  return chronological.map((point) => {
    const day = calendarDay(point.date);
    return {
      ...point,
      x: padding + (daySpan === 0 ? usableWidth / 2 : (day - firstDay) / daySpan * usableWidth),
      y: range === 0 ? height / 2 : padding + (max - point.weightKg) / range * usableHeight,
    };
  });
}

const DAY_MS = 86_400_000;

function calendarDay(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = Date.UTC(year, month - 1, day) / DAY_MS;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function proposalResolution(value: unknown, requested: 'accepted' | 'dismissed'): ProposalResolution {
  const raw = record(value);
  const nested = record(raw.proposal);
  const status = text(raw.status) ?? text(raw.resolution) ?? text(raw.outcome) ?? text(nested.status);
  if (status === 'accepted') return 'accepted';
  if (status === 'dismissed') return 'dismissed';
  if (status) return 'conflict';
  return requested;
}

export function isProposalConflictError(value: unknown): boolean {
  const message = value instanceof Error ? value.message : text(value);
  return Boolean(message && (/(предложен).*(уже|недоступ|устар|конфликт)/i.test(message) || /(stale|conflict|expired).*(proposal)|proposal.*(stale|conflict|expired)/i.test(message)));
}

export function trendSummary(trend: Pick<WeightTrend, 'sampleCount' | 'spanDays' | 'actualKgPerWeek'>): string {
  const rate = trend.actualKgPerWeek;
  let rateText = 'темп пока не рассчитан';
  if (rate !== undefined) {
    let direction = '';
    if (rate > 0) direction = 'плюс ';
    if (rate < 0) direction = 'минус ';
    rateText = `темп ${direction}${formatWeight(Math.abs(rate))} килограмма в неделю`;
  }
  return `${trend.sampleCount} измерений за ${trend.spanDays} дней, ${rateText}.`;
}

export function trendQualityNotice(trend: Pick<WeightTrend, 'suspectDates' | 'excludedSampleCount' | 'latestSampleSuspect'>): TrendQualityNotice | undefined {
  if (trend.suspectDates.length === 0) return undefined;
  const count = Math.max(trend.excludedSampleCount, trend.suspectDates.length);
  return {
    title: trend.latestSampleSuspect ? 'Проверьте последнее измерение' : 'Есть измерения для проверки',
    message: `${count === 1 ? 'Одно измерение заметно отличается' : `${count} измерения заметно отличаются`} от соседних значений. Это может быть обычным колебанием или опечаткой. Пока эти точки не участвуют в расчёте тренда. В истории ниже можно выбрать ту же дату, чтобы обновить вес, или удалить запись.`,
    dates: trend.suspectDates,
  };
}

export function goalProgress(history: WeighIn[], goalWeightKg?: number): number | undefined {
  if (history.length === 0 || goalWeightKg === undefined) return undefined;
  const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const start = chronological[0].weightKg;
  const current = chronological.at(-1)!.weightKg;
  const distance = Math.abs(start - goalWeightKg);
  if (distance < 0.05) return 100;
  const direction = goalWeightKg > start ? 1 : -1;
  const traveled = (current - start) * direction;
  return Math.max(0, Math.min(100, traveled / distance * 100));
}

export function formatWeight(value: number): string {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function formatProgressDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}
