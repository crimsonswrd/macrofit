import { createHash } from 'node:crypto';
import type { ObjectId } from 'modelence/server';
import { dbProfiles } from '@/server/profile/db';
import { localDateKey } from '@/server/profile/timezone';
import { dbTargetHistory } from '@/server/targets/db';
import { TARGET_POLICY_VERSION } from '@/server/targets/calculation';
import { withTargetMutationLock } from '@/server/targets/mutationLock';
import { dbTargetAdjustmentProposals, dbWeighIns, dbWeightEvidenceState } from './db';
import { calculateWeightTrend, type DatedWeight } from './trend';
import { acceptanceAction, decideTargetAdjustment } from './proposal';

const DAY_MS = 86_400_000;
const PROPOSAL_LIFETIME_MS = 14 * DAY_MS;

function windowStart(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00.000Z`) - 27 * DAY_MS).toISOString().slice(0, 10);
}

export function evidenceFingerprint(history: DatedWeight[]): string {
  const canonical = [...history]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ date, weightKg }) => [date, weightKg]);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export type ProposalFreshnessInput = {
  status: 'open' | 'accepted' | 'dismissed' | 'expired';
  expiresAt: Date;
  sourceTargetId: string;
  evidenceRevision: number;
  evidenceFingerprint: string;
  evidenceDate: string;
};

export function proposalFreshnessConflict(
  proposal: ProposalFreshnessInput,
  current: { now: Date; sourceTargetId: string; evidenceRevision: number; evidenceFingerprint: string; evidenceDate: string },
): string | null {
  if (proposal.status !== 'open') return 'Предложение уже недоступно.';
  if (proposal.expiresAt <= current.now) return 'Срок действия предложения истёк.';
  if (proposal.sourceTargetId !== current.sourceTargetId) return 'Текущая цель изменилась; предложение устарело.';
  if (proposal.evidenceDate !== current.evidenceDate) {
    return 'Локальный день изменился; предложение устарело.';
  }
  if (proposal.evidenceRevision !== current.evidenceRevision || proposal.evidenceFingerprint !== current.evidenceFingerprint) {
    return 'История веса изменилась; предложение устарело.';
  }
  return null;
}

export function ownerScopedProposalSelector(id: ObjectId, userId: ObjectId) {
  return { _id: id, userId } as const;
}

export function openProposalAcceptanceSelector(
  proposalId: ObjectId,
  userId: ObjectId,
  current: { now: Date; sourceTargetId: ObjectId; evidenceRevision: number; evidenceFingerprint: string },
) {
  return {
    _id: proposalId,
    userId,
    status: 'open' as const,
    expiresAt: { $gt: current.now },
    sourceTargetId: current.sourceTargetId,
    evidenceRevision: current.evidenceRevision,
    evidenceFingerprint: current.evidenceFingerprint,
  };
}

export function serializeWeighIn(item: typeof dbWeighIns._doc) {
  return { id: item._id.toString(), date: item.date, weightKg: item.weightKg, updatedAt: item.updatedAt };
}

export function serializeProposal(item: typeof dbTargetAdjustmentProposals._doc) {
  return {
    id: item._id.toString(),
    status: item.status,
    reason: item.reason,
    oldTargets: { calories: item.oldCalories, protein: item.oldProtein, carbs: item.oldCarbs, fat: item.oldFat },
    newTargets: { calories: item.newCalories, protein: item.newProtein, carbs: item.newCarbs, fat: item.newFat },
    calorieDelta: item.newCalories - item.oldCalories,
    evidence: {
      revision: item.evidenceRevision,
      fingerprint: item.evidenceFingerprint,
      trendPolicyVersion: item.trendPolicyVersion,
      adjustmentPolicyVersion: item.adjustmentPolicyVersion,
      targetPolicyVersion: item.targetPolicyVersion,
      sampleCount: item.sampleCount,
      spanDays: item.spanDays,
      windowStart: item.windowStart,
      windowEnd: item.windowEnd,
      currentWeightKg: item.currentWeightKg,
      actualKgPerWeek: item.actualKgPerWeek,
      actualPercentPerWeek: item.actualPercentPerWeek,
      expectedPercentPerWeek: item.expectedPercentPerWeek,
      deviationPercentPerWeek: item.deviationPercentPerWeek,
      goalMode: item.goalMode,
      sourceTargetId: item.sourceTargetId.toString(),
      maintenanceCalories: item.maintenanceCalories,
    },
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    resolvedAt: item.resolvedAt,
    acceptedTargetId: item.acceptedTargetId?.toString(),
  };
}

type EvidenceContext = {
  today: string;
  profile: NonNullable<Awaited<ReturnType<typeof dbProfiles.findOne>>>;
  currentTarget: (typeof dbTargetHistory._doc) | null;
  history: (typeof dbWeighIns._doc)[];
  evidenceRevision: number;
  fingerprint: string;
};

async function loadEvidenceContext(userId: ObjectId, now: Date): Promise<EvidenceContext | null> {
  const profile = await dbProfiles.findOne({ userId });
  if (!profile) return null;
  const today = localDateKey(now, profile.timeZone);
  const [targets, history, state] = await Promise.all([
    dbTargetHistory.fetch(
      { userId, effectiveFrom: { $lte: today } },
      { sort: { effectiveFrom: -1, createdAt: -1 }, limit: 1 },
    ),
    dbWeighIns.fetch(
      { userId, date: { $gte: windowStart(today), $lte: today } },
      { sort: { date: 1 }, limit: 28 },
    ),
    dbWeightEvidenceState.findOne({ userId }),
  ]);
  return {
    today,
    profile,
    currentTarget: targets[0] ?? null,
    history,
    evidenceRevision: state?.revision ?? 0,
    fingerprint: evidenceFingerprint(history),
  };
}

async function expireOpenProposal(proposal: typeof dbTargetAdjustmentProposals._doc, userId: ObjectId, now: Date) {
  return dbTargetAdjustmentProposals.findOneAndUpdate(
    { _id: proposal._id, userId, status: 'open' },
    { $set: { status: 'expired', resolvedAt: now }, $unset: { openProposalKey: '' } },
    { returnDocument: 'after' },
  );
}

export async function invalidateOpenProposal(userId: ObjectId, now = new Date()) {
  const proposal = await dbTargetAdjustmentProposals.findOne({ userId, status: 'open' });
  return proposal ? expireOpenProposal(proposal, userId, now) : null;
}

export async function bumpEvidenceRevision(userId: ObjectId, now = new Date()): Promise<number> {
  const { doc } = await dbWeightEvidenceState.findOneAndUpsert(
    { userId },
    { $set: { updatedAt: now }, $setOnInsert: { userId }, $inc: { revision: 1 } },
    { upsert: true },
  );
  if (!doc) throw new Error('Не удалось обновить ревизию истории веса.');
  return doc.revision;
}

function freshnessInput(proposal: typeof dbTargetAdjustmentProposals._doc): ProposalFreshnessInput {
  return {
    status: proposal.status,
    expiresAt: proposal.expiresAt,
    sourceTargetId: proposal.sourceTargetId.toString(),
    evidenceRevision: proposal.evidenceRevision,
    evidenceFingerprint: proposal.evidenceFingerprint,
    evidenceDate: proposal.windowEnd,
  };
}

function contextFreshness(context: EvidenceContext, now: Date) {
  return {
    now,
    sourceTargetId: context.currentTarget?._id.toString() ?? '',
    evidenceRevision: context.evidenceRevision,
    evidenceFingerprint: context.fingerprint,
    evidenceDate: context.today,
  };
}

export async function getOpenProposal(userId: ObjectId, now = new Date()) {
  const proposal = await dbTargetAdjustmentProposals.findOne({ userId, status: 'open' });
  if (!proposal) return null;
  const context = await loadEvidenceContext(userId, now);
  const conflict = context
    ? proposalFreshnessConflict(freshnessInput(proposal), contextFreshness(context, now))
    : 'Профиль недоступен.';
  if (!conflict) return proposal;
  await expireOpenProposal(proposal, userId, now);
  return null;
}

export async function evaluateAdjustmentProposal(userId: ObjectId, now = new Date()) {
  const context = await loadEvidenceContext(userId, now);
  if (!context?.currentTarget) return null;
  const existing = await dbTargetAdjustmentProposals.findOne({ userId, status: 'open' });
  if (existing) {
    const conflict = proposalFreshnessConflict(freshnessInput(existing), contextFreshness(context, now));
    if (!conflict) return existing;
    await expireOpenProposal(existing, userId, now);
  }

  const trend = calculateWeightTrend(context.history, context.today);
  const currentTarget = context.currentTarget;
  const decision = decideTargetAdjustment({
    trend,
    goalMode: currentTarget.goalMode,
    currentTargets: currentTarget,
    maintenanceCalories: currentTarget.maintenanceCalories,
    macroPolicy: {
      currentWeightKg: trend.currentWeightKg ?? context.profile.currentWeightKg,
      goalMode: currentTarget.goalMode,
      activityCategory: currentTarget.activityCategory,
      calories: currentTarget.calories,
    },
  });
  if (!decision.proposed || !decision.newTargets || trend.kgPerWeek === undefined || trend.percentPerWeek === undefined || trend.currentWeightKg === undefined || decision.deviationPercentPerWeek === undefined) return null;

  const { doc } = await dbTargetAdjustmentProposals.findOneAndUpsert(
    { openProposalKey: userId.toString() },
    { $setOnInsert: {
      userId,
      openProposalKey: userId.toString(),
      status: 'open',
      reason: decision.reason,
      trendPolicyVersion: trend.policyVersion,
      adjustmentPolicyVersion: decision.policyVersion,
      targetPolicyVersion: currentTarget.policyVersion,
      evidenceRevision: context.evidenceRevision,
      evidenceFingerprint: context.fingerprint,
      sampleCount: trend.sampleCount,
      spanDays: trend.spanDays,
      windowStart: trend.windowStart,
      windowEnd: trend.windowEnd,
      currentWeightKg: trend.currentWeightKg,
      actualKgPerWeek: trend.kgPerWeek,
      actualPercentPerWeek: trend.percentPerWeek,
      expectedPercentPerWeek: decision.expectedPercentPerWeek,
      deviationPercentPerWeek: decision.deviationPercentPerWeek,
      goalMode: currentTarget.goalMode,
      sourceTargetId: currentTarget._id,
      maintenanceCalories: currentTarget.maintenanceCalories,
      activityCategory: currentTarget.activityCategory,
      oldCalories: currentTarget.calories,
      oldProtein: currentTarget.protein,
      oldCarbs: currentTarget.carbs,
      oldFat: currentTarget.fat,
      newCalories: decision.newTargets.calories,
      newProtein: decision.newTargets.protein,
      newCarbs: decision.newTargets.carbs,
      newFat: decision.newTargets.fat,
      createdAt: now,
      expiresAt: new Date(now.getTime() + PROPOSAL_LIFETIME_MS),
    } },
    { upsert: true },
  );
  return doc;
}

export type ProposalEvaluationResult =
  | { proposed: true; proposal: ReturnType<typeof serializeProposal> }
  | { proposed: false; reason: string };

export async function runProposalEvaluationSafely(
  evaluate: () => Promise<typeof dbTargetAdjustmentProposals._doc | null>,
): Promise<ProposalEvaluationResult> {
  try {
    const proposal = await evaluate();
    return proposal
      ? { proposed: true, proposal: serializeProposal(proposal) }
      : { proposed: false, reason: 'По текущим данным изменение цели не требуется.' };
  } catch (error) {
    return {
      proposed: false,
      reason: error instanceof Error ? `Предложение не рассчитано: ${error.message}` : 'Предложение не рассчитано.',
    };
  }
}

async function acceptAdjustmentProposalUnlocked(userId: ObjectId, proposalId: ObjectId, now: Date) {
  const existing = await dbTargetAdjustmentProposals.requireOne(ownerScopedProposalSelector(proposalId, userId));
  const action = acceptanceAction(existing.status, Boolean(existing.acceptedTargetId));
  if (action === 'return' && existing.acceptedTargetId) {
    return dbTargetHistory.requireOne({ _id: existing.acceptedTargetId, userId });
  }
  if (action === 'reject') throw new Error('Предложение уже недоступно.');

  const context = await loadEvidenceContext(userId, now);
  if (!context?.currentTarget) throw new Error('Текущая цель недоступна.');
  if (action === 'claim') {
    const conflict = proposalFreshnessConflict(freshnessInput(existing), contextFreshness(context, now));
    if (conflict) {
      await expireOpenProposal(existing, userId, now);
      throw new Error(conflict);
    }
  }
  const claimed = action === 'claim'
    ? await dbTargetAdjustmentProposals.findOneAndUpdate(
        openProposalAcceptanceSelector(proposalId, userId, {
          now,
          sourceTargetId: context.currentTarget._id,
          evidenceRevision: context.evidenceRevision,
          evidenceFingerprint: context.fingerprint,
        }),
        { $set: { status: 'accepted', resolvedAt: now }, $unset: { openProposalKey: '' } },
        { returnDocument: 'after' },
      )
    : existing;
  if (!claimed || claimed.status !== 'accepted') throw new Error('Предложение было изменено другим запросом.');

  const sourceTarget = await dbTargetHistory.requireOne({ _id: claimed.sourceTargetId, userId });
  const { doc: target } = await dbTargetHistory.findOneAndUpsert(
    { sourceProposalId: claimed._id, userId },
    { $setOnInsert: {
      userId,
      profileRevision: sourceTarget.profileRevision,
      effectiveFrom: claimed.windowEnd,
      maintenanceCalories: claimed.maintenanceCalories,
      calories: claimed.newCalories,
      protein: claimed.newProtein,
      carbs: claimed.newCarbs,
      fat: claimed.newFat,
      activityCategory: sourceTarget.activityCategory,
      goalMode: claimed.goalMode,
      explanation: [...sourceTarget.explanation, claimed.reason, `Изменение: ${claimed.oldCalories} → ${claimed.newCalories} ккал; подтверждено пользователем.`],
      policyVersion: TARGET_POLICY_VERSION,
      sourceProposalId: claimed._id,
      sourceReason: claimed.reason,
      createdAt: now,
    } },
    { upsert: true },
  );
  if (!target) throw new Error('Не удалось применить предложение.');
  await dbTargetAdjustmentProposals.updateOne(
    { _id: claimed._id, userId, status: 'accepted' },
    { $set: { acceptedTargetId: target._id } },
  );
  return target;
}

export async function acceptAdjustmentProposal(userId: ObjectId, proposalId: ObjectId, now = new Date()) {
  return withTargetMutationLock(userId, () => acceptAdjustmentProposalUnlocked(userId, proposalId, now));
}

export function dismissedCasResult(status: 'open' | 'accepted' | 'dismissed' | 'expired'): 'return' | 'conflict' {
  return status === 'dismissed' ? 'return' : 'conflict';
}

export async function dismissAdjustmentProposal(userId: ObjectId, proposalId: ObjectId, now = new Date()) {
  const proposal = await dbTargetAdjustmentProposals.requireOne(ownerScopedProposalSelector(proposalId, userId));
  if (proposal.status === 'dismissed') return proposal;
  if (proposal.status !== 'open') throw new Error('Предложение уже недоступно.');
  const dismissed = await dbTargetAdjustmentProposals.findOneAndUpdate(
    { _id: proposalId, userId, status: 'open' },
    { $set: { status: 'dismissed', resolvedAt: now }, $unset: { openProposalKey: '' } },
    { returnDocument: 'after' },
  );
  if (dismissed?.status === 'dismissed') return dismissed;
  const current = await dbTargetAdjustmentProposals.requireOne(ownerScopedProposalSelector(proposalId, userId));
  if (dismissedCasResult(current.status) === 'return') return current;
  throw new Error('Предложение было принято или изменено другим запросом.');
}
