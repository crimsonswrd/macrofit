import type { ObjectId } from 'modelence/server';
import type { NutritionTargets } from '@/shared/contracts/profile';
import { dbProfiles } from '@/server/profile/db';
import { evaluateEligibility } from '@/server/profile/eligibility';
import { TARGET_POLICY_VERSION, calculateTargets, type TargetCalculation } from './calculation';
import { dbTargetHistory } from './db';
import { localDateKey } from '@/server/profile/timezone';
import { withTargetMutationLock } from './mutationLock';

export async function buildPreview(userId: ObjectId, now = new Date()): Promise<
  | ({ eligible: true; reasons: string[]; profileRevision: number } & TargetCalculation)
  | ({ eligible: false; reasons: string[]; profileRevision: number } & Omit<TargetCalculation, 'explanation'> & { explanation: string[] })
> {
  const profile = await dbProfiles.findOne({ userId });
  if (!profile) {
    return {
      eligible: false,
      reasons: ['Заполните профиль, чтобы рассчитать персональные ориентиры.'],
      profileRevision: 0,
      maintenanceCalories: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      activityCategory: 'inactive',
      goalMode: 'maintain',
      explanation: [],
      policyVersion: TARGET_POLICY_VERSION,
    };
  }

  const eligibility = evaluateEligibility(profile, now);
  if (!eligibility.eligible || eligibility.age === null) {
    return {
      eligible: false,
      reasons: eligibility.reasons,
      profileRevision: profile.revision,
      maintenanceCalories: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      activityCategory: 'inactive',
      goalMode: profile.goalMode,
      explanation: [],
      policyVersion: TARGET_POLICY_VERSION,
    };
  }

  const calculation = calculateTargets({
    age: eligibility.age,
    eerSexClass: profile.eerSexClass,
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
    goalMode: profile.goalMode,
    jobActivity: profile.jobActivity,
    stepsPerDay: profile.stepsPerDay,
    trainingSessionsPerWeek: profile.trainingSessionsPerWeek,
    trainingType: profile.trainingType,
  });
  return { eligible: true, reasons: [], profileRevision: profile.revision, ...calculation };
}

async function confirmPreviewUnlocked(userId: ObjectId, profileRevision: number, now: Date) {
  const profile = await dbProfiles.findOne({ userId });
  if (!profile || profile.revision !== profileRevision) {
    throw new Error('Профиль изменился. Обновите предварительный расчёт перед подтверждением.');
  }
  if (!profile.acknowledgedEstimate) {
    throw new Error('Подтвердите, что цели являются приблизительной оценкой.');
  }

  const preview = await buildPreview(userId, now);
  if (!preview.eligible) throw new Error(preview.reasons.join(' '));

  const effectiveFrom = localDateKey(now, profile.timeZone);
  const created = await dbTargetHistory.create({
    userId,
    profileRevision,
    effectiveFrom,
    maintenanceCalories: preview.maintenanceCalories,
    calories: preview.calories,
    protein: preview.protein,
    carbs: preview.carbs,
    fat: preview.fat,
    activityCategory: preview.activityCategory,
    goalMode: preview.goalMode,
    explanation: preview.explanation,
    policyVersion: preview.policyVersion,
    createdAt: now,
  });
  return serializeTarget(created);
}

export async function confirmPreview(userId: ObjectId, profileRevision: number, now = new Date()) {
  return withTargetMutationLock(userId, () => confirmPreviewUnlocked(userId, profileRevision, now));
}

export async function resolveTargetsForDate(userId: ObjectId, date: string): Promise<NutritionTargets | null> {
  const [target] = await dbTargetHistory.fetch(
    { userId, effectiveFrom: { $lte: date } },
    { sort: { effectiveFrom: -1, createdAt: -1 }, limit: 1 },
  );
  return target
    ? { calories: target.calories, protein: target.protein, carbs: target.carbs, fat: target.fat }
    : null;
}

export async function hasConfirmedTargets(userId: ObjectId): Promise<boolean> {
  return (await dbTargetHistory.countDocuments({ userId })) > 0;
}

export function serializeTarget(target: typeof dbTargetHistory._doc) {
  return {
    id: target._id.toString(),
    profileRevision: target.profileRevision,
    effectiveFrom: target.effectiveFrom,
    maintenanceCalories: target.maintenanceCalories,
    calories: target.calories,
    protein: target.protein,
    carbs: target.carbs,
    fat: target.fat,
    activityCategory: target.activityCategory,
    goalMode: target.goalMode,
    explanation: target.explanation,
    policyVersion: target.policyVersion,
    eligible: true,
    reasons: [],
    createdAt: target.createdAt,
    confirmedAt: target.createdAt,
  };
}
