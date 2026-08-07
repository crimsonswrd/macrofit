import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChartPoints,
  goalProgress,
  normalizeDashboard,
  normalizeProposal,
  isProposalConflictError,
  proposalResolution,
  trendSummary,
  trendQualityNotice,
} from '../src/client/lib/progress.ts';
import { browserTimeZone, resolveOnboardingAccess } from '../src/client/lib/profile.ts';

test('dashboard adapter reconciles the server goal and collecting trend contract', () => {
  const dashboard = normalizeDashboard({
    history: [
      { id: 'new', date: '2026-08-05', weightKg: 78.4 },
      { id: 'old', date: '2026-08-01', weightKg: 79.1 },
    ],
    trend: {
      status: 'collecting',
      sampleCount: 2,
      spanDays: 4,
      smoothedPoints: [],
      message: 'Нужно минимум 7 взвешиваний.',
      suspectDates: ['2026-08-05'],
      excludedSampleCount: 1,
      latestSampleSuspect: true,
    },
    goal: { mode: 'loss', weightKg: 74 },
  });

  assert.equal(dashboard.goal.goalWeightKg, 74);
  assert.equal(dashboard.goal.currentWeightKg, 78.4);
  assert.equal(dashboard.trend.status, 'insufficient');
  assert.equal(dashboard.trend.message, 'Нужно минимум 7 взвешиваний.');
  assert.deepEqual(dashboard.trend.suspectDates, ['2026-08-05']);
  assert.equal(dashboard.trend.excludedSampleCount, 1);
  assert.equal(dashboard.trend.latestSampleSuspect, true);
  assert.deepEqual(dashboard.history.map((item) => item.id), ['new', 'old']);
});

test('trend quality copy is calm, dated and gives edit/delete guidance', () => {
  const notice = trendQualityNotice({
    suspectDates: ['2026-08-01', '2026-08-05'],
    excludedSampleCount: 2,
    latestSampleSuspect: true,
  });
  assert.ok(notice);
  assert.equal(notice.title, 'Проверьте последнее измерение');
  assert.deepEqual(notice.dates, ['2026-08-01', '2026-08-05']);
  assert.match(notice.message, /обычным колебанием или опечаткой/);
  assert.match(notice.message, /не участвуют в расчёте тренда/);
  assert.match(notice.message, /обновить вес, или удалить запись/);
  assert.equal(trendQualityNotice({ suspectDates: [], excludedSampleCount: 0, latestSampleSuspect: false }), undefined);
});

test('proposal adapter turns structured evidence into readable UI facts', () => {
  const proposal = normalizeProposal({
    id: 'proposal-1',
    reason: 'Темп отличается от ориентира.',
    oldTargets: { calories: 2400, protein: 160, carbs: 300, fat: 65 },
    newTargets: { calories: 2300, protein: 160, carbs: 275, fat: 63 },
    evidence: {
      sampleCount: 9,
      spanDays: 21,
      actualPercentPerWeek: 0.3,
      expectedPercentPerWeek: -0.5,
      windowStart: '2026-07-09',
      windowEnd: '2026-08-05',
    },
  });

  assert.ok(proposal);
  assert.equal(proposal.current.calories, 2400);
  assert.equal(proposal.proposed.calories, 2300);
  assert.equal(proposal.evidence.length, 3);
  assert.match(proposal.evidence[0], /9 измерений за 21/);
  assert.match(proposal.evidence[1], /\+0,3%/);
});

test('chart geometry uses real calendar spacing and sorts reversed input', () => {
  const points = buildChartPoints([
    { date: '2026-08-11', weightKg: 79 },
    { date: '2026-08-01', weightKg: 80 },
    { date: '2026-08-03', weightKg: 79.5 },
  ], 640, 220, 24);

  assert.deepEqual(points.map((point) => point.date), ['2026-08-01', '2026-08-03', '2026-08-11']);
  assert.deepEqual(points.map((point) => point.x), [24, 142.4, 616]);
});

test('chart geometry handles single and flat series without non-finite coordinates', () => {
  const points = buildChartPoints([
    { date: '2026-08-01', weightKg: 80 },
    { date: '2026-08-05', weightKg: 80 },
  ], 640, 220, 24);

  assert.deepEqual(points.map((point) => point.x), [24, 616]);
  assert.deepEqual(points.map((point) => point.y), [110, 110]);
  assert.ok(points.every((point) => Number.isFinite(point.y)));
  assert.deepEqual(buildChartPoints([{ date: '2026-08-01', weightKg: 80 }])[0], {
    date: '2026-08-01', weightKg: 80, x: 320, y: 110,
  });
});

test('trend summary exposes sample span and signed rate for non-visual users', () => {
  assert.equal(trendSummary({ sampleCount: 9, spanDays: 21, actualKgPerWeek: -0.35 }), '9 измерений за 21 дней, темп минус 0,35 килограмма в неделю.');
});

test('browser timezone is centralized and safely falls back to UTC', () => {
  assert.equal(browserTimeZone(() => 'Asia/Yekaterinburg'), 'Asia/Yekaterinburg');
  assert.equal(browserTimeZone(() => ''), 'UTC');
  assert.equal(browserTimeZone(() => { throw new Error('Intl unavailable'); }), 'UTC');
});

test('onboarding access fails closed and exempts only explicit safe routes', () => {
  const base = { isAuthenticated: true, isExemptRoute: false, isLoading: false, isError: false };
  assert.equal(resolveOnboardingAccess({ ...base, state: undefined }), 'error');
  assert.equal(resolveOnboardingAccess({ ...base, state: {} }), 'error');
  assert.equal(resolveOnboardingAccess({ ...base, state: { needsOnboarding: true } }), 'onboarding');
  assert.equal(resolveOnboardingAccess({ ...base, state: { completed: true } }), 'allowed');
  assert.equal(resolveOnboardingAccess({ ...base, isError: true, state: undefined }), 'error');
  assert.equal(resolveOnboardingAccess({ ...base, isExemptRoute: true, isError: true, state: undefined }), 'allowed');
  assert.equal(resolveOnboardingAccess({ ...base, isAuthenticated: false, state: undefined }), 'allowed');
});

test('proposal outcomes never mislabel accepted or stale dismissal as dismissed', () => {
  assert.equal(proposalResolution({ status: 'dismissed' }, 'dismissed'), 'dismissed');
  assert.equal(proposalResolution({ status: 'accepted' }, 'dismissed'), 'accepted');
  assert.equal(proposalResolution({ status: 'expired' }, 'dismissed'), 'conflict');
  assert.equal(proposalResolution({ calories: 2200 }, 'accepted'), 'accepted');
  assert.equal(isProposalConflictError(new Error('Предложение уже недоступно.')), true);
  assert.equal(isProposalConflictError(new Error('Сеть недоступна')), false);
});

test('goal progress is chronological, direction-neutral and clamped', () => {
  const history = [
    { id: 'latest', date: '2026-08-05', weightKg: 77 },
    { id: 'first', date: '2026-07-01', weightKg: 80 },
  ];
  assert.equal(goalProgress(history, 74), 50);
  assert.equal(goalProgress([{ ...history[0], weightKg: 70 }, history[1]], 74), 100);
  assert.equal(goalProgress([{ ...history[0], weightKg: 83 }, history[1]], 74), 0);
  assert.equal(goalProgress([], 74), undefined);
});
