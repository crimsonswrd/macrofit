import { Store, schema } from 'modelence/server';
import { ADJUSTMENT_PROPOSAL_STATUSES } from '@/shared/contracts/weight';
import { GOAL_MODES } from '@/shared/contracts/profile';

export const dbWeighIns = new Store('weightWeighIns', {
  schema: {
    userId: schema.userId(),
    date: schema.string(),
    weightKg: schema.number(),
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, date: -1 }, unique: true },
    { key: { userId: 1, createdAt: -1 } },
  ],
});

export const dbWeightEvidenceState = new Store('weightEvidenceState', {
  schema: {
    userId: schema.userId(),
    revision: schema.number(),
    updatedAt: schema.date(),
  },
  indexes: [{ key: { userId: 1 }, unique: true }],
});

export const dbTargetAdjustmentProposals = new Store('targetAdjustmentProposals', {
  schema: {
    userId: schema.userId(),
    openProposalKey: schema.string().optional(),
    status: schema.enum(ADJUSTMENT_PROPOSAL_STATUSES),
    reason: schema.string(),
    trendPolicyVersion: schema.string(),
    adjustmentPolicyVersion: schema.string(),
    targetPolicyVersion: schema.string(),
    evidenceRevision: schema.number(),
    evidenceFingerprint: schema.string(),
    sampleCount: schema.number(),
    spanDays: schema.number(),
    windowStart: schema.string(),
    windowEnd: schema.string(),
    currentWeightKg: schema.number(),
    actualKgPerWeek: schema.number(),
    actualPercentPerWeek: schema.number(),
    expectedPercentPerWeek: schema.number(),
    deviationPercentPerWeek: schema.number(),
    goalMode: schema.enum(GOAL_MODES),
    sourceTargetId: schema.objectId(),
    maintenanceCalories: schema.number(),
    activityCategory: schema.string(),
    oldCalories: schema.number(),
    oldProtein: schema.number(),
    oldCarbs: schema.number(),
    oldFat: schema.number(),
    newCalories: schema.number(),
    newProtein: schema.number(),
    newCarbs: schema.number(),
    newFat: schema.number(),
    createdAt: schema.date(),
    expiresAt: schema.date(),
    resolvedAt: schema.date().optional(),
    acceptedTargetId: schema.objectId().optional(),
  },
  indexes: [
    { key: { userId: 1, createdAt: -1 } },
    { key: { openProposalKey: 1 }, unique: true, sparse: true },
  ],
});
