export const EER_SEX_CLASSES = ['male', 'female'] as const;
export type EerSexClass = (typeof EER_SEX_CLASSES)[number];

export const GOAL_MODES = ['maintain', 'loss', 'gain', 'muscle', 'strength'] as const;
export type GoalMode = (typeof GOAL_MODES)[number];

export const JOB_ACTIVITIES = ['sedentary', 'light', 'moderate', 'heavy'] as const;
export type JobActivity = (typeof JOB_ACTIVITIES)[number];

export const TRAINING_TYPES = ['none', 'strength', 'cardio', 'mixed'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const LIFE_STAGES = ['general', 'pregnant', 'breastfeeding'] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const ACTIVITY_CATEGORIES = ['inactive', 'low_active', 'active', 'very_active'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type NutritionTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ProfileTimeZone = string;
