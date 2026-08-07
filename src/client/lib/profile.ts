import type {
  EerSexClass,
  GoalMode,
  JobActivity,
  LifeStage,
  TrainingType,
} from '@/shared/contracts/profile';

export type { EerSexClass, GoalMode, JobActivity, LifeStage, TrainingType };

export interface ProfileDraft {
  birthDate: string;
  eerSexClass: EerSexClass;
  heightCm: number;
  currentWeightKg: number;
  goalMode: GoalMode;
  goalWeightKg?: number;
  jobActivity: JobActivity;
  stepsPerDay: number;
  trainingSessionsPerWeek: number;
  trainingType: TrainingType;
  lifeStage: LifeStage;
  requiresSpecializedGuidance: boolean;
  acknowledgedEstimate: boolean;
}

export interface UserProfile extends ProfileDraft {
  timeZone?: string;
  revision?: number;
  updatedAt?: string;
}

export function browserTimeZone(resolve = () => Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  try {
    return resolve() || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function parseNumberFieldDraft(value: string): number | undefined {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface OnboardingState {
  hasProfile?: boolean;
  hasConfirmedTargets?: boolean;
  needsOnboarding?: boolean;
  completed?: boolean;
}

interface EligibleTargetPreview {
  eligible: true;
  reasons: string[];
  profileRevision: number;
  maintenanceCalories: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  activityCategory: string;
  goalMode: GoalMode;
  explanation: string[];
  policyVersion: string;
  createdAt?: string;
}

interface IneligibleTargetPreview {
  eligible: false;
  reasons: string[];
  profileRevision: number | null;
}

export type TargetPreview = EligibleTargetPreview | IneligibleTargetPreview;

export interface TargetHistoryItem extends Omit<EligibleTargetPreview, 'eligible' | 'reasons'> {
  id?: string;
  effectiveFrom?: string;
  confirmedAt?: string;
}

export const GOAL_LABELS: Record<GoalMode, string> = {
  maintain: 'Поддерживать вес',
  loss: 'Снизить вес',
  gain: 'Набрать вес',
  muscle: 'Набрать мышечную массу',
  strength: 'Повысить силовые показатели',
};

export const SEX_CLASS_LABELS: Record<EerSexClass, string> = {
  male: 'Мужской класс формулы',
  female: 'Женский класс формулы',
};

export function needsOnboarding(state: OnboardingState | null | undefined): boolean {
  if (!state) return false;
  if (typeof state.needsOnboarding === 'boolean') return state.needsOnboarding;
  if (typeof state.completed === 'boolean') return !state.completed;
  return state.hasProfile === false || state.hasConfirmedTargets === false;
}

export type OnboardingAccess = 'loading' | 'error' | 'onboarding' | 'allowed';

export function resolveOnboardingAccess({
  isAuthenticated,
  isExemptRoute,
  isLoading,
  isError,
  state,
}: {
  isAuthenticated: boolean;
  isExemptRoute: boolean;
  isLoading: boolean;
  isError: boolean;
  state: OnboardingState | null | undefined;
}): OnboardingAccess {
  if (!isAuthenticated || isExemptRoute) return 'allowed';
  if (isLoading) return 'loading';
  const hasRecognizedState = state && (
    typeof state.needsOnboarding === 'boolean'
    || typeof state.completed === 'boolean'
    || (typeof state.hasProfile === 'boolean' && typeof state.hasConfirmedTargets === 'boolean')
  );
  if (isError || !hasRecognizedState) return 'error';
  return needsOnboarding(state) ? 'onboarding' : 'allowed';
}

export function formatProfileDate(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU').format(new Date(value));
}

export function formatTarget(value: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}
