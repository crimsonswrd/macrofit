import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'modelence/server';
import { calculateWeightTrend } from '../src/server/weight/trend.ts';
import {
  decideTargetAdjustment,
  expectedPercentPerWeek,
  acceptanceAction,
} from '../src/server/weight/proposal.ts';
import { ownerScopedWeighInSelector } from '../src/server/weight/index.ts';
import {
  dismissedCasResult,
  evidenceFingerprint,
  openProposalAcceptanceSelector,
  ownerScopedProposalSelector,
  proposalFreshnessConflict,
  runProposalEvaluationSafely,
} from '../src/server/weight/service.ts';
import { WEIGHT_TREND_POLICY_VERSION } from '../src/shared/contracts/weight.ts';
import { isFutureLocalDate, isSupportedTimeZone, localDateKey } from '../src/server/profile/timezone.ts';
import { withTargetMutationLock } from '../src/server/targets/mutationLock.ts';

function samples(startWeight: number, dailyDelta: number) {
  return Array.from({ length: 15 }, (_, day) => ({
    date: `2026-07-${String(22 + day).padStart(2, '0')}`.replace('2026-07-32', '2026-08-01').replace('2026-07-33', '2026-08-02').replace('2026-07-34', '2026-08-03').replace('2026-07-35', '2026-08-04').replace('2026-07-36', '2026-08-05'),
    weightKg: startWeight + dailyDelta * day,
  }));
}

test('trend requires seven weigh-ins spanning fourteen days in the recent 28-day window', () => {
  const tooFew = calculateWeightTrend(samples(80, -0.05).slice(0, 6), '2026-08-05');
  assert.equal(tooFew.sufficient, false);
  assert.match(tooFew.reason ?? '', /7/);

  const tooShort = calculateWeightTrend(samples(80, -0.05).slice(7), '2026-08-05');
  assert.equal(tooShort.sufficient, false);
  assert.match(tooShort.reason ?? '', /14/);
});

test('trend is deterministic, versioned, smoothed and reports actual kg/week and percent/week', () => {
  const input = samples(80, -0.1);
  input[7]!.weightKg += 2;
  const first = calculateWeightTrend(input, '2026-08-05');
  const second = calculateWeightTrend([...input].reverse(), '2026-08-05');
  assert.deepEqual(first, second);
  assert.equal(first.sufficient, true);
  assert.equal(first.sampleCount, 15);
  assert.equal(first.spanDays, 14);
  assert.ok((first.kgPerWeek ?? 0) < 0);
  assert.ok((first.percentPerWeek ?? 0) < 0);
  assert.equal(first.smoothedPoints.length, 15);
  assert.equal(first.policyVersion, WEIGHT_TREND_POLICY_VERSION);
});

test('proposal policy uses goal expectations, threshold, 100 kcal step and maintenance clamp', () => {
  assert.equal(expectedPercentPerWeek('loss'), -0.5);
  assert.equal(expectedPercentPerWeek('muscle'), 0.25);
  assert.equal(expectedPercentPerWeek('strength'), 0);
  const trend = calculateWeightTrend(samples(80, 0), '2026-08-05');
  const decision = decideTargetAdjustment({
    trend,
    goalMode: 'loss',
    currentTargets: { calories: 2000, protein: 128, carbs: 230, fat: 56 },
    maintenanceCalories: 2400,
    macroPolicy: { currentWeightKg: 80, goalMode: 'loss', activityCategory: 'active', calories: 2000 },
  });
  assert.equal(decision.proposed, true);
  assert.equal(decision.calorieDelta, -80);
  assert.equal(decision.newTargets?.calories, 1920);
  assert.notEqual(decision.newTargets?.carbs, 230);
  assert.match(decision.reason, /2000|темп|снизить/i);

  const unclamped = decideTargetAdjustment({
    trend,
    goalMode: 'loss',
    currentTargets: { calories: 2200, protein: 128, carbs: 290, fat: 61 },
    maintenanceCalories: 2400,
    macroPolicy: { currentWeightKg: 80, goalMode: 'loss', activityCategory: 'active', calories: 2200 },
  });
  assert.equal(unclamped.calorieDelta, -100);
  assert.equal(unclamped.newTargets?.calories, 2100);
});

test('proposal policy does nothing for insufficient or within-threshold evidence', () => {
  const insufficient = calculateWeightTrend(samples(80, 0).slice(0, 3), '2026-08-05');
  const base = {
    goalMode: 'maintain' as const,
    currentTargets: { calories: 2400, protein: 100, carbs: 300, fat: 67 },
    maintenanceCalories: 2400,
    macroPolicy: { currentWeightKg: 80, goalMode: 'maintain' as const, activityCategory: 'active' as const, calories: 2400 },
  };
  assert.equal(decideTargetAdjustment({ ...base, trend: insufficient }).proposed, false);
  assert.equal(decideTargetAdjustment({ ...base, trend: calculateWeightTrend(samples(80, 0), '2026-08-05') }).proposed, false);
  const exactThreshold = {
    ...calculateWeightTrend(samples(80, 0), '2026-08-05'),
    sufficient: true,
    percentPerWeek: 0.25,
  };
  assert.equal(decideTargetAdjustment({ ...base, trend: exactThreshold }).proposed, false);
});

test('isolated implausible weights are excluded and suppress proposals', () => {
  const middle = samples(80, -0.1);
  middle[7]!.weightKg = 350;
  const middleTrend = calculateWeightTrend(middle, '2026-08-05');
  assert.equal(middleTrend.sufficient, true);
  assert.deepEqual(middleTrend.suspectDates, [middle[7]!.date]);
  assert.equal(middleTrend.excludedSampleCount, 1);
  assert.equal(middleTrend.latestSampleSuspect, false);
  assert.ok((middleTrend.kgPerWeek ?? 0) < 0);
  assert.equal(decideTargetAdjustment({
    trend: middleTrend,
    goalMode: 'loss',
    currentTargets: { calories: 2200, protein: 128, carbs: 290, fat: 61 },
    maintenanceCalories: 2400,
    macroPolicy: { currentWeightKg: 80, goalMode: 'loss', activityCategory: 'active', calories: 2200 },
  }).proposed, false);

  const latest = samples(80, -0.1);
  latest.at(-1)!.weightKg = 350;
  const latestTrend = calculateWeightTrend(latest, '2026-08-05');
  assert.equal(latestTrend.latestSampleSuspect, true);
  assert.deepEqual(latestTrend.suspectDates, [latest.at(-1)!.date]);

  const monotonic = calculateWeightTrend(samples(80, 1), '2026-08-05');
  assert.deepEqual(monotonic.suspectDates, []);
  assert.equal(monotonic.sufficient, true);
});

test('window-level robust guard excludes adjacent two and three sample tail clusters', () => {
  for (const tail of [[180, 180], [350, 350, 350]]) {
    const input = samples(80, -0.05);
    input.splice(input.length - tail.length, tail.length, ...tail.map((weightKg, index) => ({
      date: input[input.length - tail.length + index]!.date,
      weightKg,
    })));
    const trend = calculateWeightTrend(input, '2026-08-05');
    assert.equal(trend.excludedSampleCount, tail.length);
    assert.equal(trend.latestSampleSuspect, true);
    assert.deepEqual(trend.suspectDates, input.slice(-tail.length).map(({ date }) => date));
    const decision = decideTargetAdjustment({
      trend,
      goalMode: 'loss',
      currentTargets: { calories: 2200, protein: 128, carbs: 290, fat: 61 },
      maintenanceCalories: 2400,
      macroPolicy: { currentWeightKg: 80, goalMode: 'loss', activityCategory: 'active', calories: 2200 },
    });
    assert.equal(decision.proposed, false);
  }
});

test('IANA timezone local dates reject tomorrow for UTC-12 and UTC+14 correctly', () => {
  const now = new Date('2026-08-05T10:00:00.000Z');
  assert.equal(isSupportedTimeZone('Pacific/Kiritimati'), true);
  assert.equal(isSupportedTimeZone('Etc/GMT+12'), true);
  assert.equal(isSupportedTimeZone('Not/A_Zone'), false);
  assert.equal(localDateKey(now, 'Pacific/Kiritimati'), '2026-08-06');
  assert.equal(localDateKey(now, 'Etc/GMT+12'), '2026-08-04');
  assert.equal(isFutureLocalDate('2026-08-06', now, 'Pacific/Kiritimati'), false);
  assert.equal(isFutureLocalDate('2026-08-05', now, 'Etc/GMT+12'), true);
});

test('proposal fingerprint is canonical and freshness rejects stale target, evidence, or local day', () => {
  const history = samples(80, -0.1);
  assert.equal(evidenceFingerprint(history), evidenceFingerprint([...history].reverse()));
  assert.notEqual(evidenceFingerprint(history), evidenceFingerprint(history.map((item, index) => index === 3 ? { ...item, weightKg: 90 } : item)));
  const now = new Date('2026-08-05T10:00:00.000Z');
  const proposal = {
    status: 'open' as const,
    expiresAt: new Date('2026-08-10T00:00:00.000Z'),
    sourceTargetId: 'target-1',
    evidenceRevision: 4,
    evidenceFingerprint: 'fingerprint-1',
    evidenceDate: '2026-08-05',
  };
  const current = { now, sourceTargetId: 'target-1', evidenceRevision: 4, evidenceFingerprint: 'fingerprint-1', evidenceDate: '2026-08-05' };
  assert.equal(proposalFreshnessConflict(proposal, current), null);
  assert.match(proposalFreshnessConflict(proposal, { ...current, sourceTargetId: 'target-2' }) ?? '', /цель/i);
  assert.match(proposalFreshnessConflict(proposal, { ...current, evidenceRevision: 5 }) ?? '', /веса/i);
  assert.match(proposalFreshnessConflict(proposal, { ...current, evidenceFingerprint: 'changed' }) ?? '', /веса/i);
  assert.match(proposalFreshnessConflict(proposal, { ...current, evidenceDate: '2026-08-06' }) ?? '', /день/i);
});

test('weigh-in selectors always include both record and owner identifiers', () => {
  const id = new ObjectId('507f1f77bcf86cd799439011');
  const owner = new ObjectId('507f191e810c19729de860ea');
  assert.deepEqual(ownerScopedWeighInSelector(id, owner), { _id: id, userId: owner });
  assert.deepEqual(ownerScopedProposalSelector(id, owner), { _id: id, userId: owner });
});

test('proposal acceptance is idempotent and repairs an interrupted first acceptance', () => {
  assert.equal(acceptanceAction('open', false), 'claim');
  assert.equal(acceptanceAction('accepted', true), 'return');
  assert.equal(acceptanceAction('accepted', false), 'repair');
  assert.equal(acceptanceAction('dismissed', false), 'reject');
  assert.equal(acceptanceAction('expired', false), 'reject');
});

test('accept and dismiss compare-and-set seams reject stale/racing transitions', () => {
  const id = new ObjectId('507f1f77bcf86cd799439011');
  const owner = new ObjectId('507f191e810c19729de860ea');
  const target = new ObjectId('507f191e810c19729de860eb');
  const now = new Date('2026-08-05T10:00:00.000Z');
  assert.deepEqual(openProposalAcceptanceSelector(id, owner, {
    now,
    sourceTargetId: target,
    evidenceRevision: 7,
    evidenceFingerprint: 'abc',
  }), {
    _id: id,
    userId: owner,
    status: 'open',
    expiresAt: { $gt: now },
    sourceTargetId: target,
    evidenceRevision: 7,
    evidenceFingerprint: 'abc',
  });
  assert.equal(dismissedCasResult('dismissed'), 'return');
  assert.equal(dismissedCasResult('accepted'), 'conflict');
  assert.equal(dismissedCasResult('expired'), 'conflict');
});

test('proposal calculation failure is a partial success and remains a non-throwing result', async () => {
  const result = await runProposalEvaluationSafely(async () => {
    throw new RangeError('Расчёт макросов недоступен');
  });
  assert.deepEqual(result, {
    proposed: false,
    reason: 'Предложение не рассчитано: Расчёт макросов недоступен',
  });
});

test('shared per-user target mutation lock serializes confirm and accept seams', async () => {
  const events: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const confirm = withTargetMutationLock({ toString: () => 'user-a' }, async () => {
    events.push('confirm:start');
    await firstGate;
    events.push('confirm:end');
  });
  const accept = withTargetMutationLock({ toString: () => 'user-a' }, async () => {
    events.push('accept:start');
    events.push('accept:end');
  });
  await Promise.resolve();
  assert.deepEqual(events, ['confirm:start']);
  releaseFirst();
  await Promise.all([confirm, accept]);
  assert.deepEqual(events, ['confirm:start', 'confirm:end', 'accept:start', 'accept:end']);
});
