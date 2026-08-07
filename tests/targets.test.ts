import assert from 'node:assert/strict';
import test from 'node:test';
import { ageOnDate, evaluateEligibility } from '../src/server/profile/eligibility.ts';
import {
  TARGET_POLICY_VERSION,
  calculateMaintenanceCalories,
  calculateTargets,
  classifyActivity,
} from '../src/server/targets/calculation.ts';

test('eligibility uses exact birthdays and rejects unsupported life stages without diagnoses', () => {
  const now = new Date('2026-08-05T12:00:00.000Z');
  assert.equal(ageOnDate('2008-08-05', now), 18);
  assert.equal(ageOnDate('2008-08-06', now), 17);
  assert.equal(ageOnDate('2000-02-30', now), null);

  assert.deepEqual(
    evaluateEligibility(
      {
        birthDate: '2008-08-05',
        lifeStage: 'general',
        requiresSpecializedGuidance: false,
        acknowledgedEstimate: false,
      },
      now,
    ),
    { eligible: true, reasons: [], age: 18 },
  );

  const unsupported = evaluateEligibility(
    {
      birthDate: '2000-01-01',
      lifeStage: 'pregnant',
      requiresSpecializedGuidance: true,
      acknowledgedEstimate: true,
    },
    now,
  );
  assert.equal(unsupported.eligible, false);
  assert.equal(unsupported.reasons.length, 2);
});

test('eligibility uses the profile timezone at the eighteenth-birthday boundary', () => {
  const instant = new Date('2026-08-05T10:30:00.000Z');

  assert.equal(ageOnDate('2008-08-06', instant, 'Pacific/Kiritimati'), 18);
  assert.equal(ageOnDate('2008-08-06', instant, 'UTC'), 17);
  assert.equal(ageOnDate('2008-08-05', instant, 'Etc/GMT+12'), 17);

  assert.equal(
    evaluateEligibility({
      birthDate: '2008-08-06',
      lifeStage: 'general',
      requiresSpecializedGuidance: false,
      acknowledgedEstimate: true,
      timeZone: 'Pacific/Kiritimati',
    }, instant).eligible,
    true,
  );
  assert.equal(
    evaluateEligibility({
      birthDate: '2008-08-05',
      lifeStage: 'general',
      requiresSpecializedGuidance: false,
      acknowledgedEstimate: true,
      timeZone: 'Etc/GMT+12',
    }, instant).eligible,
    false,
  );
});

test('activity mapping does not add overlapping movement signals', () => {
  assert.deepEqual(
    classifyActivity({
      stepsPerDay: 8_000,
      jobActivity: 'light',
      trainingSessionsPerWeek: 2,
      trainingType: 'strength',
    }).category,
    'active',
  );
  assert.equal(
    classifyActivity({
      stepsPerDay: 4_000,
      jobActivity: 'sedentary',
      trainingSessionsPerWeek: 2,
      trainingType: 'cardio',
    }).category,
    'low_active',
  );
  assert.equal(
    classifyActivity({
      stepsPerDay: 12_000,
      jobActivity: 'heavy',
      trainingSessionsPerWeek: 7,
      trainingType: 'mixed',
    }).category,
    'very_active',
  );
});

test('NASEM 2023 uses the adolescent equation at 18 and adult equation at 19', () => {
  assert.equal(
    calculateMaintenanceCalories(
      { age: 18, eerSexClass: 'male', heightCm: 180, currentWeightKg: 75 },
      'inactive',
    ),
    -447.51 + 3.68 * 18 + 13.01 * 180 + 13.15 * 75 + 20,
  );
  assert.equal(
    calculateMaintenanceCalories(
      { age: 19, eerSexClass: 'male', heightCm: 180, currentWeightKg: 75 },
      'inactive',
    ),
    753.07 - 10.83 * 19 + 6.5 * 180 + 14.1 * 75,
  );
  assert.equal(
    calculateMaintenanceCalories(
      { age: 18, eerSexClass: 'female', heightCm: 165, currentWeightKg: 60 },
      'active',
    ),
    -189.55 - 22.25 * 18 + 11.74 * 165 + 18.34 * 60 + 20,
  );
});

test('target policy applies goal adjustment and macro rules deterministically', () => {
  const base = {
    age: 30,
    eerSexClass: 'male' as const,
    heightCm: 180,
    currentWeightKg: 80,
    jobActivity: 'sedentary' as const,
    stepsPerDay: 4_000,
    trainingSessionsPerWeek: 0,
    trainingType: 'none' as const,
  };
  const maintain = calculateTargets({ ...base, goalMode: 'maintain' });
  const loss = calculateTargets({ ...base, goalMode: 'loss' });
  const muscle = calculateTargets({ ...base, goalMode: 'muscle' });
  const strength = calculateTargets({ ...base, goalMode: 'strength' });

  assert.equal(maintain.calories, maintain.maintenanceCalories);
  assert.equal(loss.calories, Math.round(loss.maintenanceCalories * 0.85));
  assert.equal(muscle.calories, Math.round(muscle.maintenanceCalories * 1.1));
  assert.equal(strength.calories, strength.maintenanceCalories);
  assert.equal(maintain.protein, 64);
  assert.equal(loss.protein, 128);
  assert.equal(muscle.protein, 128);
  assert.equal(strength.protein, 128);
  assert.equal(loss.fat, Math.round((loss.calories * 0.25) / 9));
  assert.equal(loss.carbs, Math.round((loss.calories - loss.protein * 4 - loss.fat * 9) / 4));
  assert.equal(loss.policyVersion, TARGET_POLICY_VERSION);
  assert.match(loss.explanation.join(' '), /приблизительной|расчётная/i);
});
