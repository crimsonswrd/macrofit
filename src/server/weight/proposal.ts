import type { GoalMode, NutritionTargets } from '@/shared/contracts/profile';
import {
  TARGET_ADJUSTMENT_POLICY_VERSION,
  type WeightTrend,
} from '@/shared/contracts/weight';
import { calculateMacrosForCalories, type MacroPolicyInput } from '@/server/targets/calculation';

export const PROPOSAL_THRESHOLD_PERCENT_PER_WEEK = 0.25;
export const PROPOSAL_CALORIE_STEP = 100;

export function acceptanceAction(
  status: 'open' | 'accepted' | 'dismissed' | 'expired',
  hasAcceptedTarget: boolean,
): 'claim' | 'return' | 'repair' | 'reject' {
  if (status === 'open') return 'claim';
  if (status === 'accepted') return hasAcceptedTarget ? 'return' : 'repair';
  return 'reject';
}

export function expectedPercentPerWeek(goalMode: GoalMode): number {
  if (goalMode === 'loss') return -0.5;
  if (goalMode === 'gain' || goalMode === 'muscle') return 0.25;
  return 0;
}

export type ProposalDecision = {
  policyVersion: typeof TARGET_ADJUSTMENT_POLICY_VERSION;
  proposed: boolean;
  reason: string;
  expectedPercentPerWeek: number;
  deviationPercentPerWeek?: number;
  calorieDelta?: number;
  newTargets?: NutritionTargets;
};

export function decideTargetAdjustment(input: {
  trend: WeightTrend;
  goalMode: GoalMode;
  currentTargets: NutritionTargets;
  maintenanceCalories: number;
  macroPolicy: MacroPolicyInput;
}): ProposalDecision {
  const expected = expectedPercentPerWeek(input.goalMode);
  if (!input.trend.sufficient || input.trend.percentPerWeek === undefined) {
    return {
      policyVersion: TARGET_ADJUSTMENT_POLICY_VERSION,
      proposed: false,
      reason: input.trend.reason ?? 'Недостаточно данных для предложения.',
      expectedPercentPerWeek: expected,
    };
  }
  if (input.trend.suspectDates.length > 0) {
    return {
      policyVersion: TARGET_ADJUSTMENT_POLICY_VERSION,
      proposed: false,
      reason: 'Есть подозрительное взвешивание; исправьте или подтвердите данные перед изменением цели.',
      expectedPercentPerWeek: expected,
    };
  }

  const deviation = input.trend.percentPerWeek - expected;
  if (Math.abs(deviation) <= PROPOSAL_THRESHOLD_PERCENT_PER_WEEK) {
    return {
      policyVersion: TARGET_ADJUSTMENT_POLICY_VERSION,
      proposed: false,
      reason: 'Фактический темп находится в пределах 0,25% массы тела в неделю от ориентира.',
      expectedPercentPerWeek: expected,
      deviationPercentPerWeek: deviation,
    };
  }

  const requestedDelta = deviation > 0 ? -PROPOSAL_CALORIE_STEP : PROPOSAL_CALORIE_STEP;
  const minimum = Math.round(input.maintenanceCalories * 0.8);
  const maximum = Math.round(input.maintenanceCalories * 1.2);
  const calories = Math.max(minimum, Math.min(maximum, input.currentTargets.calories + requestedDelta));
  const actualDelta = calories - input.currentTargets.calories;
  if (actualDelta === 0) {
    return {
      policyVersion: TARGET_ADJUSTMENT_POLICY_VERSION,
      proposed: false,
      reason: 'Цель уже находится на безопасной границе 80–120% расчётного поддержания.',
      expectedPercentPerWeek: expected,
      deviationPercentPerWeek: deviation,
    };
  }
  const newTargets = calculateMacrosForCalories({ ...input.macroPolicy, calories });
  const direction = actualDelta < 0 ? 'снизить' : 'повысить';
  return {
    policyVersion: TARGET_ADJUSTMENT_POLICY_VERSION,
    proposed: true,
    reason: `Фактический темп ${input.trend.percentPerWeek.toFixed(2)}%/нед отличается от ориентира ${expected.toFixed(2)}%/нед; предлагается ${direction} цель на ${Math.abs(actualDelta)} ккал.`,
    expectedPercentPerWeek: expected,
    deviationPercentPerWeek: deviation,
    calorieDelta: actualDelta,
    newTargets,
  };
}
