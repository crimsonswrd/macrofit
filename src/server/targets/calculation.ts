import type {
  ActivityCategory,
  EerSexClass,
  GoalMode,
  JobActivity,
  NutritionTargets,
  TrainingType,
} from '@/shared/contracts/profile';

export const TARGET_POLICY_VERSION = 'nasem-eer-2023-macro-fit-v1';

export type CalculationInput = {
  age: number;
  eerSexClass: EerSexClass;
  heightCm: number;
  currentWeightKg: number;
  goalMode: GoalMode;
  jobActivity: JobActivity;
  stepsPerDay: number;
  trainingSessionsPerWeek: number;
  trainingType: TrainingType;
};

export type TargetCalculation = NutritionTargets & {
  maintenanceCalories: number;
  activityCategory: ActivityCategory;
  goalMode: GoalMode;
  explanation: string[];
  policyVersion: typeof TARGET_POLICY_VERSION;
};

export type MacroPolicyInput = Pick<CalculationInput, 'currentWeightKg' | 'goalMode'> & {
  activityCategory: ActivityCategory;
  calories: number;
};

function proteinGramsPerKg(goalMode: GoalMode, activityCategory: ActivityCategory): number {
  if (goalMode === 'loss' || goalMode === 'muscle' || goalMode === 'strength') return 1.6;
  if (activityCategory === 'active' || activityCategory === 'very_active') return 1.4;
  return 0.8;
}

export function calculateMacrosForCalories(input: MacroPolicyInput): NutritionTargets {
  const proteinPerKg = proteinGramsPerKg(input.goalMode, input.activityCategory);
  const protein = Math.round(input.currentWeightKg * proteinPerKg);
  const fat = Math.round((input.calories * 0.25) / 9);
  const carbs = Math.round((input.calories - protein * 4 - fat * 9) / 4);
  if (carbs < 50) {
    throw new RangeError('Расчёт оставляет менее 50 г углеводов; профиль требует индивидуальной проверки.');
  }
  return { calories: input.calories, protein, carbs, fat };
}

type Equation = { intercept: number; age: number; height: number; weight: number; growth: number };

// NASEM 2023, Tables 5-15 and 5-16: https://doi.org/10.17226/26818
const EER_EQUATIONS: Record<'adolescent_male' | 'adolescent_female' | 'adult_male' | 'adult_female', Record<ActivityCategory, Equation>> = {
  adolescent_male: {
    inactive: { intercept: -447.51, age: 3.68, height: 13.01, weight: 13.15, growth: 20 },
    low_active: { intercept: 19.12, age: 3.68, height: 8.62, weight: 20.28, growth: 20 },
    active: { intercept: -388.19, age: 3.68, height: 12.66, weight: 20.46, growth: 20 },
    very_active: { intercept: -671.75, age: 3.68, height: 15.38, weight: 23.25, growth: 20 },
  },
  adolescent_female: {
    inactive: { intercept: 55.59, age: -22.25, height: 8.43, weight: 17.07, growth: 20 },
    low_active: { intercept: -297.54, age: -22.25, height: 12.77, weight: 14.73, growth: 20 },
    active: { intercept: -189.55, age: -22.25, height: 11.74, weight: 18.34, growth: 20 },
    very_active: { intercept: -709.59, age: -22.25, height: 18.22, weight: 14.25, growth: 20 },
  },
  adult_male: {
    inactive: { intercept: 753.07, age: -10.83, height: 6.5, weight: 14.1, growth: 0 },
    low_active: { intercept: 581.47, age: -10.83, height: 8.3, weight: 14.94, growth: 0 },
    active: { intercept: 1004.82, age: -10.83, height: 6.52, weight: 15.91, growth: 0 },
    very_active: { intercept: -517.88, age: -10.83, height: 15.61, weight: 19.11, growth: 0 },
  },
  adult_female: {
    inactive: { intercept: 584.9, age: -7.01, height: 5.72, weight: 11.71, growth: 0 },
    low_active: { intercept: 575.77, age: -7.01, height: 6.6, weight: 12.14, growth: 0 },
    active: { intercept: 710.25, age: -7.01, height: 6.54, weight: 12.34, growth: 0 },
    very_active: { intercept: 511.83, age: -7.01, height: 9.07, weight: 12.56, growth: 0 },
  },
};

const JOB_SCORE: Record<JobActivity, number> = { sedentary: 0, light: 1, moderate: 2, heavy: 3 };

export function classifyActivity(input: Pick<CalculationInput, 'jobActivity' | 'stepsPerDay' | 'trainingSessionsPerWeek' | 'trainingType'>): {
  category: ActivityCategory;
  explanation: string;
} {
  let stepsScore = 3;
  if (input.stepsPerDay < 5_000) {
    stepsScore = 0;
  } else if (input.stepsPerDay < 7_500) {
    stepsScore = 1;
  } else if (input.stepsPerDay < 10_000) {
    stepsScore = 2;
  }
  const jobScore = JOB_SCORE[input.jobActivity];
  let trainingScore = 3;
  if (input.trainingType === 'none' || input.trainingSessionsPerWeek === 0) {
    trainingScore = 0;
  } else if (input.trainingSessionsPerWeek <= 2) {
    trainingScore = 1;
  } else if (input.trainingSessionsPerWeek <= 5) {
    trainingScore = 2;
  }

  // Signals overlap (training often contributes to steps), so never add them.
  // The strongest independently reported signal selects one official PAL band.
  const score = Math.max(stepsScore, jobScore, trainingScore);
  const category = (['inactive', 'low_active', 'active', 'very_active'] as const)[score];
  return {
    category,
    explanation: `Активность «${category}»: шаги ${stepsScore}/3, работа ${jobScore}/3, тренировки ${trainingScore}/3; взят максимум, сигналы не складывались.`,
  };
}

export function calculateMaintenanceCalories(input: Pick<CalculationInput, 'age' | 'eerSexClass' | 'heightCm' | 'currentWeightKg'>, activityCategory: ActivityCategory): number {
  const lifeBand = input.age === 18 ? 'adolescent' : 'adult';
  const key = `${lifeBand}_${input.eerSexClass}` as keyof typeof EER_EQUATIONS;
  const equation = EER_EQUATIONS[key][activityCategory];
  return equation.intercept + equation.age * input.age + equation.height * input.heightCm + equation.weight * input.currentWeightKg + equation.growth;
}

export function calculateTargets(input: CalculationInput): TargetCalculation {
  if (!Number.isInteger(input.age) || input.age < 18 || input.age > 120) {
    throw new RangeError('Возраст должен быть целым числом от 18 до 120 лет.');
  }

  const activity = classifyActivity(input);
  const rawMaintenance = calculateMaintenanceCalories(input, activity.category);
  let energyFactor = 1;
  let adjustment = 'без поправки';
  if (input.goalMode === 'loss') {
    energyFactor = 0.85;
    adjustment = 'дефицит 15%';
  } else if (input.goalMode === 'gain' || input.goalMode === 'muscle') {
    energyFactor = 1.1;
    adjustment = 'профицит 10%';
  }
  const proteinPerKg = proteinGramsPerKg(input.goalMode, activity.category);

  const maintenanceCalories = Math.round(rawMaintenance);
  const calories = Math.round(rawMaintenance * energyFactor);
  const { protein, carbs, fat } = calculateMacrosForCalories({
    currentWeightKg: input.currentWeightKg,
    goalMode: input.goalMode,
    activityCategory: activity.category,
    calories,
  });

  return {
    maintenanceCalories,
    calories,
    protein,
    carbs,
    fat,
    activityCategory: activity.category,
    goalMode: input.goalMode,
    explanation: [
      `Поддержание: ${maintenanceCalories} ккал по NASEM EER 2023 (${input.age === 18 ? 'формула 14–18 лет' : 'формула 19+ лет'}).`,
      activity.explanation,
      `Цель: ${adjustment}; белок ${proteinPerKg} г/кг, жиры 25% калорий, углеводы — остаток.`,
      'Это расчётная отправная точка, а не медицинская рекомендация; изменения применяются только после подтверждения.',
    ],
    policyVersion: TARGET_POLICY_VERSION,
  };
}
