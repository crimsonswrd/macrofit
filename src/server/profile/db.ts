import { Store, schema } from 'modelence/server';
import {
  EER_SEX_CLASSES,
  GOAL_MODES,
  JOB_ACTIVITIES,
  LIFE_STAGES,
  TRAINING_TYPES,
} from '@/shared/contracts/profile';

export const dbProfiles = new Store('nutritionProfiles', {
  schema: {
    userId: schema.userId(),
    birthDate: schema.string(),
    eerSexClass: schema.enum(EER_SEX_CLASSES),
    heightCm: schema.number(),
    currentWeightKg: schema.number(),
    goalMode: schema.enum(GOAL_MODES),
    goalWeightKg: schema.number().optional(),
    jobActivity: schema.enum(JOB_ACTIVITIES),
    stepsPerDay: schema.number(),
    trainingSessionsPerWeek: schema.number(),
    trainingType: schema.enum(TRAINING_TYPES),
    lifeStage: schema.enum(LIFE_STAGES),
    requiresSpecializedGuidance: schema.boolean(),
    acknowledgedEstimate: schema.boolean(),
    timeZone: schema.string().optional(),
    revision: schema.number(),
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [{ key: { userId: 1 }, unique: true }],
});
