import {
  WEIGHT_TREND_POLICY_VERSION,
  type WeightTrend,
} from '@/shared/contracts/weight';

export type DatedWeight = { date: string; weightKg: number };

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;
}

function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/**
 * Uses only the 28 local calendar days ending at `asOfDate`. Daily values are
 * guarded by a window-level median/MAD threshold plus an isolated local-jump
 * check. Flagged samples and adjacent tail clusters are excluded, then the
 * remaining daily values are smoothed with a centered three-point moving
 * average and an OLS slope is fitted over real day spacing. Any suspect evidence
 * suppresses target proposals; the trend remains visible with explicit flags.
 */
export function calculateWeightTrend(weighIns: DatedWeight[], asOfDate: string): WeightTrend {
  const windowStart = shiftDate(asOfDate, -27);
  const rawSamples = weighIns
    .filter(({ date }) => date >= windowStart && date <= asOfDate)
    .sort((left, right) => left.date.localeCompare(right.date));
  const weightMedian = rawSamples.length > 0 ? median(rawSamples.map(({ weightKg }) => weightKg)) : 0;
  const mad = rawSamples.length > 0
    ? median(rawSamples.map(({ weightKg }) => Math.abs(weightKg - weightMedian)))
    : 0;
  const robustThresholdKg = Math.max(5, Math.abs(weightMedian) * 0.1, mad * 1.4826 * 6);
  const suspectDates = rawSamples.flatMap((sample, index) => {
    if (Math.abs(sample.weightKg - weightMedian) > robustThresholdKg) return [sample.date];
    const previous = rawSamples[index - 1];
    const next = rawSamples[index + 1];
    if (!previous && !next) return [];
    const localEstimate = previous && next
      ? previous.weightKg + ((next.weightKg - previous.weightKg) * (dayNumber(sample.date) - dayNumber(previous.date))) /
          (dayNumber(next.date) - dayNumber(previous.date))
      : (previous ?? next)!.weightKg;
    const thresholdKg = Math.max(5, Math.abs(localEstimate) * 0.1);
    const neighborsAgree = !previous || !next ||
      Math.abs(previous.weightKg - next.weightKg) <= Math.max(5, Math.abs(localEstimate) * 0.1);
    return neighborsAgree && Math.abs(sample.weightKg - localEstimate) > thresholdKg ? [sample.date] : [];
  });
  const suspectSet = new Set(suspectDates);
  const samples = rawSamples.filter(({ date }) => !suspectSet.has(date));
  const firstDate = samples[0]?.date ?? windowStart;
  const lastDate = samples.at(-1)?.date ?? asOfDate;
  const spanDays = samples.length > 1 ? dayNumber(lastDate) - dayNumber(firstDate) : 0;
  const base: Pick<WeightTrend, 'policyVersion' | 'sampleCount' | 'spanDays' | 'windowStart' | 'windowEnd' | 'smoothedPoints' | 'suspectDates' | 'excludedSampleCount' | 'latestSampleSuspect'> = {
    policyVersion: WEIGHT_TREND_POLICY_VERSION,
    sampleCount: samples.length,
    spanDays,
    windowStart,
    windowEnd: asOfDate,
    smoothedPoints: [] as { date: string; weightKg: number }[],
    suspectDates,
    excludedSampleCount: suspectDates.length,
    latestSampleSuspect: rawSamples.length > 0 && suspectSet.has(rawSamples.at(-1)!.date),
  };

  if (samples.length < 7) {
    return { ...base, sufficient: false, reason: 'Нужно минимум 7 взвешиваний за последние 28 дней.' };
  }
  if (spanDays < 14) {
    return { ...base, sufficient: false, reason: 'Взвешивания должны охватывать минимум 14 дней.' };
  }

  const smoothed = samples.map((sample, index) => {
    const from = Math.max(0, index - 1);
    const to = Math.min(samples.length - 1, index + 1);
    const neighbors = samples.slice(from, to + 1);
    return {
      date: sample.date,
      day: dayNumber(sample.date),
      weightKg: neighbors.reduce((sum, item) => sum + item.weightKg, 0) / neighbors.length,
    };
  });
  const meanDay = smoothed.reduce((sum, item) => sum + item.day, 0) / smoothed.length;
  const meanWeight = smoothed.reduce((sum, item) => sum + item.weightKg, 0) / smoothed.length;
  const numerator = smoothed.reduce(
    (sum, item) => sum + (item.day - meanDay) * (item.weightKg - meanWeight),
    0,
  );
  const denominator = smoothed.reduce((sum, item) => sum + (item.day - meanDay) ** 2, 0);
  const kgPerWeek = (numerator / denominator) * 7;
  const currentWeightKg = smoothed.at(-1)!.weightKg;

  return {
    ...base,
    smoothedPoints: smoothed.map(({ date, weightKg }) => ({ date, weightKg: round(weightKg, 2) })),
    sufficient: true,
    currentWeightKg: round(currentWeightKg, 2),
    kgPerWeek: round(kgPerWeek, 3),
    percentPerWeek: round((kgPerWeek / currentWeightKg) * 100, 3),
  };
}
