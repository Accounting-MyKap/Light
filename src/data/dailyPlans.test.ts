import { DAILY_GAME_COUNT } from '../core/dailyPlan';
import { clearAllData, db } from './db';
import { completedDays, getOrCreatePlan, getPlan, isPlanComplete, markDailyGameDone } from './dailyPlans';
import { addDays } from '../core/dates';
import { addResult } from './results';
import { TRAINING_GAMES } from '../games/registry';

const base = { level: 1, score: 10, accuracy: 0.5, durationMs: 60000, isDaily: false };

beforeEach(clearAllData);

test('plan is stored once and marks are idempotent', async () => {
  const p1 = await getOrCreatePlan('2026-10-20');
  expect(p1.gameIds).toHaveLength(3);
  p1.gameIds.forEach((id) => expect(TRAINING_GAMES.map((g) => g.id)).toContain(id));
  await addResult({ ...base, gameId: p1.gameIds[0] });
  expect(await getOrCreatePlan('2026-10-20')).toEqual(p1);
  await markDailyGameDone('2026-10-20', p1.gameIds[0]);
  const p2 = await markDailyGameDone('2026-10-20', p1.gameIds[0]);
  expect(p2.completed).toEqual([p1.gameIds[0]]);
  expect((await markDailyGameDone('2026-10-20', 'not-in-plan')).completed).toEqual([p1.gameIds[0]]);
});

test('concurrent creation yields a single plan', async () => {
  const [a, b] = await Promise.all([getOrCreatePlan('2026-10-21'), getOrCreatePlan('2026-10-21')]);
  expect(a).toEqual(b);
  expect(await db.dailyPlans.count()).toBe(1);
});

test('yesterday plan is avoided when possible', async () => {
  const areaOf = (id: string) => TRAINING_GAMES.find((g) => g.id === id)!.area;
  const allAreas = new Set(TRAINING_GAMES.map((g) => g.area));
  const plans = [await getOrCreatePlan('2026-10-10')];
  for (let i = 1; i < 10; i++) {
    const yesterday = plans[i - 1];
    const today = await getOrCreatePlan(addDays(yesterday.day, 1));
    plans.push(today);
    // An area with any game in yesterday's plan comes back only to fill the places the other areas cannot.
    const yesterdayAreas = new Set(yesterday.gameIds.map(areaOf));
    const otherAreas = [...allAreas].filter((area) => !yesterdayAreas.has(area));
    const fresh = today.gameIds.filter((id) => !yesterdayAreas.has(areaOf(id)));
    expect(fresh, today.day).toHaveLength(Math.min(DAILY_GAME_COUNT, otherAreas.length));
    // A game of yesterday's plan comes back only when its area has no other game.
    for (const id of today.gameIds.filter((g) => yesterday.gameIds.includes(g))) {
      expect(TRAINING_GAMES.filter((g) => g.area === areaOf(id) && !yesterday.gameIds.includes(g.id)), id).toEqual([]);
    }
  }
  // So no area is in every plan, not even one with two games.
  for (const area of allAreas) expect(plans.every((p) => p.gameIds.some((id) => areaOf(id) === area)), area).toBe(false);
});

test('completedDays returns only complete plans', async () => {
  await db.dailyPlans.bulkPut([
    { day: '2026-10-18', gameIds: ['a', 'b', 'c'], completed: ['a', 'b', 'c'] },
    { day: '2026-10-19', gameIds: ['a', 'b', 'c'], completed: ['a', 'b'] },
  ]);
  expect(await completedDays()).toEqual(['2026-10-18']);
  expect(isPlanComplete((await getPlan('2026-10-19'))!)).toBe(false);
});

test('the daily plan never picks a quiz game', async () => {
  const start = '2026-11-02';
  for (let i = 0; i < 60; i += 1) {
    const plan = await getOrCreatePlan(addDays(start, i));
    expect(plan.gameIds).toHaveLength(3);
    for (const id of plan.gameIds) expect(id).not.toMatch(/^(trivia|accounting)-/);
  }
});
