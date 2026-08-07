import z from 'zod';
import { AuthError, ValidationError } from 'modelence';
import { Module, ObjectId, type UserInfo } from 'modelence/server';
import { dateSchema, objectIdSchema } from '@/server/nutrition/validation';
import { dbProfiles } from '@/server/profile/db';
import { isFutureLocalDate, localDateKey } from '@/server/profile/timezone';
import { dbTargetAdjustmentProposals, dbWeighIns, dbWeightEvidenceState } from './db';
import { calculateWeightTrend } from './trend';
import {
  bumpEvidenceRevision,
  evaluateAdjustmentProposal,
  getOpenProposal,
  invalidateOpenProposal,
  runProposalEvaluationSafely,
  serializeProposal,
  serializeWeighIn,
} from './service';

const weightInputSchema = z.number().min(35, 'Вес должен быть не меньше 35 кг.').max(350, 'Вес должен быть не больше 350 кг.');

function requireUser(user: UserInfo | null): UserInfo {
  if (!user) throw new AuthError('Требуется вход в аккаунт');
  return user;
}

export function ownerScopedWeighInSelector(id: ObjectId, userId: ObjectId) {
  return { _id: id, userId } as const;
}

async function dashboard(userId: ObjectId, now = new Date()) {
  const profile = await dbProfiles.findOne({ userId });
  const today = localDateKey(now, profile?.timeZone);
  const [history, proposal] = await Promise.all([
    dbWeighIns.fetch({ userId }, { sort: { date: -1 }, limit: 365 }),
    getOpenProposal(userId, now),
  ]);
  const trend = calculateWeightTrend(history, today);
  return {
    history: history.map(serializeWeighIn),
    trend: {
      status: trend.sufficient ? 'ready' : 'collecting',
      sampleCount: trend.sampleCount,
      spanDays: trend.spanDays,
      actualKgPerWeek: trend.kgPerWeek,
      actualPercentPerWeek: trend.percentPerWeek,
      smoothedPoints: trend.smoothedPoints,
      message: trend.sufficient
        ? 'Сглаженный темп веса — это наблюдение по весам, а не измерение обмена веществ.'
        : trend.reason,
      policyVersion: trend.policyVersion,
      suspectDates: trend.suspectDates,
      excludedSampleCount: trend.excludedSampleCount,
      latestSampleSuspect: trend.latestSampleSuspect,
    },
    goal: profile ? { mode: profile.goalMode, weightKg: profile.goalWeightKg } : null,
    proposal: proposal ? serializeProposal(proposal) : null,
  };
}

const dashboardArgsSchema = z.object({ asOfDate: dateSchema.optional() });

export default new Module('weight', {
  stores: [dbWeighIns, dbTargetAdjustmentProposals, dbWeightEvidenceState],
  queries: {
    getDashboard: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      dashboardArgsSchema.parse(args ?? {});
      return dashboard(new ObjectId(currentUser.id));
    },
    getHistory: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const history = await dbWeighIns.fetch(
        { userId: new ObjectId(currentUser.id) },
        { sort: { date: -1 }, limit: 365 },
      );
      return history.map(serializeWeighIn);
    },
    getTrend: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      dashboardArgsSchema.parse(args ?? {});
      return (await dashboard(new ObjectId(currentUser.id))).trend;
    },
  },
  mutations: {
    upsertWeighIn: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { date, weightKg } = z.object({ date: dateSchema, weightKg: weightInputSchema }).parse(args);
      const userId = new ObjectId(currentUser.id);
      const now = new Date();
      const profile = await dbProfiles.findOne({ userId });
      if (isFutureLocalDate(date, now, profile?.timeZone)) {
        throw new ValidationError('Нельзя добавить взвешивание из будущего.');
      }
      await invalidateOpenProposal(userId, now);
      const { doc } = await dbWeighIns.findOneAndUpsert(
        { userId, date },
        {
          $set: { weightKg, updatedAt: now },
          $setOnInsert: { userId, date, createdAt: now },
        },
        { upsert: true },
      );
      if (!doc) throw new Error('Не удалось сохранить взвешивание.');
      const proposalEvaluation = await runProposalEvaluationSafely(async () => {
        await bumpEvidenceRevision(userId, now);
        return evaluateAdjustmentProposal(userId, now);
      });
      return { ...serializeWeighIn(doc), proposalEvaluation };
    },
    deleteWeighIn: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { id } = z.object({ id: objectIdSchema }).parse(args);
      const userId = new ObjectId(currentUser.id);
      const item = await dbWeighIns.requireOne(ownerScopedWeighInSelector(new ObjectId(id), userId));
      const now = new Date();
      await invalidateOpenProposal(userId, now);
      await dbWeighIns.deleteOne(ownerScopedWeighInSelector(item._id, userId));
      const proposalEvaluation = await runProposalEvaluationSafely(async () => {
        await bumpEvidenceRevision(userId, now);
        return evaluateAdjustmentProposal(userId, now);
      });
      return { id: item._id.toString(), proposalEvaluation };
    },
  },
});
