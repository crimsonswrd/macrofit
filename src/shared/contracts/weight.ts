import type { GoalMode, NutritionTargets } from './profile';

export const WEIGHT_TREND_POLICY_VERSION = 'plausible-jump-moving-average-regression-v2';
export const TARGET_ADJUSTMENT_POLICY_VERSION = 'weight-trend-adjustment-v2';
export const ADJUSTMENT_PROPOSAL_STATUSES = ['open', 'accepted', 'dismissed', 'expired'] as const;
export type AdjustmentProposalStatus = (typeof ADJUSTMENT_PROPOSAL_STATUSES)[number];

export type WeightTrend = {
  policyVersion: typeof WEIGHT_TREND_POLICY_VERSION;
  sufficient: boolean;
  reason?: string;
  sampleCount: number;
  spanDays: number;
  windowStart: string;
  windowEnd: string;
  currentWeightKg?: number;
  kgPerWeek?: number;
  percentPerWeek?: number;
  smoothedPoints: { date: string; weightKg: number }[];
  suspectDates: string[];
  excludedSampleCount: number;
  latestSampleSuspect: boolean;
};

export type AdjustmentEvidence = {
  trendPolicyVersion: typeof WEIGHT_TREND_POLICY_VERSION;
  adjustmentPolicyVersion: typeof TARGET_ADJUSTMENT_POLICY_VERSION;
  sampleCount: number;
  spanDays: number;
  windowStart: string;
  windowEnd: string;
  currentWeightKg: number;
  actualKgPerWeek: number;
  actualPercentPerWeek: number;
  expectedPercentPerWeek: number;
  deviationPercentPerWeek: number;
  goalMode: GoalMode;
  targetId: string;
  oldTargets: NutritionTargets;
  newTargets: NutritionTargets;
  maintenanceCalories: number;
};
