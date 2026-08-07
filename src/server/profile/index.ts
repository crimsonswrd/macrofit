import z from 'zod';
import { AuthError } from 'modelence';
import { Module, ObjectId, type UserInfo } from 'modelence/server';
import {
  EER_SEX_CLASSES,
  GOAL_MODES,
  JOB_ACTIVITIES,
  LIFE_STAGES,
  TRAINING_TYPES,
} from '@/shared/contracts/profile';
import { dbProfiles } from './db';
import { evaluateEligibility } from './eligibility';
import { hasConfirmedTargets } from '@/server/targets/service';
import { isSupportedTimeZone, normalizeTimeZone } from './timezone';

const profileInputSchema = z
  .object({
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    eerSexClass: z.enum(EER_SEX_CLASSES),
    heightCm: z.number().min(120).max(230),
    currentWeightKg: z.number().min(35).max(350),
    goalMode: z.enum(GOAL_MODES),
    goalWeightKg: z.number().min(35).max(350).optional(),
    jobActivity: z.enum(JOB_ACTIVITIES),
    stepsPerDay: z.number().int().min(0).max(100_000),
    trainingSessionsPerWeek: z.number().int().min(0).max(14),
    trainingType: z.enum(TRAINING_TYPES),
    lifeStage: z.enum(LIFE_STAGES),
    requiresSpecializedGuidance: z.boolean(),
    acknowledgedEstimate: z.boolean(),
    timeZone: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((profile, ctx) => {
    if (profile.timeZone && !isSupportedTimeZone(profile.timeZone)) {
      ctx.addIssue({ code: 'custom', path: ['timeZone'], message: 'Укажите поддерживаемый часовой пояс IANA.' });
    }
    if (profile.trainingSessionsPerWeek > 0 && profile.trainingType === 'none') {
      ctx.addIssue({ code: 'custom', path: ['trainingType'], message: 'Укажите тип тренировок.' });
    }
    if (profile.trainingSessionsPerWeek === 0 && profile.trainingType !== 'none') {
      ctx.addIssue({
        code: 'custom',
        path: ['trainingSessionsPerWeek'],
        message: 'Для выбранного типа укажите число тренировок.',
      });
    }
    if (
      (profile.goalMode === 'loss' || profile.goalMode === 'gain' || profile.goalMode === 'muscle') &&
      profile.goalWeightKg === undefined
    ) {
      ctx.addIssue({ code: 'custom', path: ['goalWeightKg'], message: 'Укажите желаемый вес.' });
    }
    if (profile.goalMode === 'loss' && profile.goalWeightKg !== undefined && profile.goalWeightKg >= profile.currentWeightKg) {
      ctx.addIssue({ code: 'custom', path: ['goalWeightKg'], message: 'Для снижения веса цель должна быть ниже текущего веса.' });
    }
    if (
      (profile.goalMode === 'gain' || profile.goalMode === 'muscle') &&
      profile.goalWeightKg !== undefined &&
      profile.goalWeightKg <= profile.currentWeightKg
    ) {
      ctx.addIssue({ code: 'custom', path: ['goalWeightKg'], message: 'Для набора цель должна быть выше текущего веса.' });
    }
  });

function requireUser(user: UserInfo | null): UserInfo {
  if (!user) throw new AuthError('Требуется вход в аккаунт');
  return user;
}

function serializeProfile(profile: typeof dbProfiles._doc) {
  return {
    birthDate: profile.birthDate,
    eerSexClass: profile.eerSexClass,
    heightCm: profile.heightCm,
    currentWeightKg: profile.currentWeightKg,
    goalMode: profile.goalMode,
    goalWeightKg: profile.goalWeightKg,
    jobActivity: profile.jobActivity,
    stepsPerDay: profile.stepsPerDay,
    trainingSessionsPerWeek: profile.trainingSessionsPerWeek,
    trainingType: profile.trainingType,
    lifeStage: profile.lifeStage,
    requiresSpecializedGuidance: profile.requiresSpecializedGuidance,
    acknowledgedEstimate: profile.acknowledgedEstimate,
    timeZone: normalizeTimeZone(profile.timeZone),
    revision: profile.revision,
    updatedAt: profile.updatedAt,
  };
}

export default new Module('profile', {
  stores: [dbProfiles],

  queries: {
    getCurrent: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const profile = await dbProfiles.findOne({ userId: new ObjectId(currentUser.id) });
      return profile ? serializeProfile(profile) : null;
    },

    getOnboardingState: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const userId = new ObjectId(currentUser.id);
      const profile = await dbProfiles.findOne({ userId });
      if (!profile) {
        return {
          hasProfile: false,
          eligible: false,
          reasons: ['Заполните профиль, чтобы рассчитать персональные ориентиры.'],
          acknowledgedEstimate: false,
          canPreview: false,
          hasConfirmedTargets: false,
        };
      }

      const eligibility = evaluateEligibility(profile);
      return {
        hasProfile: true,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
        acknowledgedEstimate: profile.acknowledgedEstimate,
        canPreview: eligibility.eligible,
        hasConfirmedTargets: await hasConfirmedTargets(userId),
      };
    },
  },

  mutations: {
    saveProfile: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const input = profileInputSchema.parse(args);
      const now = new Date();
      const { doc } = await dbProfiles.findOneAndUpsert(
        { userId: new ObjectId(currentUser.id) },
        {
          $set: { ...input, updatedAt: now },
          $setOnInsert: { createdAt: now },
          $inc: { revision: 1 },
        },
        { upsert: true },
      );
      if (!doc) throw new Error('Не удалось сохранить профиль');

      return {
        ...serializeProfile(doc),
        eligibility: evaluateEligibility(doc),
      };
    },
  },
});
