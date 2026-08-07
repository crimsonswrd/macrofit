import { Store, schema } from 'modelence/server';
import { ACTIVITY_CATEGORIES, GOAL_MODES } from '@/shared/contracts/profile';

export const dbTargetHistory = new Store('nutritionTargetHistory', {
  schema: {
    userId: schema.userId(),
    profileRevision: schema.number(),
    effectiveFrom: schema.string(),
    maintenanceCalories: schema.number(),
    calories: schema.number(),
    protein: schema.number(),
    carbs: schema.number(),
    fat: schema.number(),
    activityCategory: schema.enum(ACTIVITY_CATEGORIES),
    goalMode: schema.enum(GOAL_MODES),
    explanation: schema.array(schema.string()),
    policyVersion: schema.string(),
    sourceProposalId: schema.objectId().optional(),
    sourceReason: schema.string().optional(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { userId: 1, effectiveFrom: -1, createdAt: -1 } },
    { key: { userId: 1, createdAt: -1 } },
    { key: { sourceProposalId: 1 }, unique: true, sparse: true },
  ],
});
