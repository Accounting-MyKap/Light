import { clearAllData, db } from './db';
import { completedDays, getOrCreatePlan, getPlan, isPlanComplete, markDailyGameDone } from './dailyPlans';
import { addResult } from './results';
import { GAMES } from '../games/registry';

const base = { level: 1, score: 10, accuracy: 0.5, durationMs: 60000, isDaily: false };

beforeEach(clearAllData);

test('plan is stored once and marks are idempotent', async () => {
  const p1 = await getOrCreatePlan('2026-10-20');
  expect(p1.gameIds).toHaveLength(3);
  p1.gameIds.forEach((id) => expect(GAMES.map((g) => g.id)).toContain(id));
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
  const yesterday = await getOrCreatePlan('2026-10-19');
  const today = await getOrCreatePlan('2026-10-20');
  // The plan has one game per area, so an area with two fresh games shows only one: check every area that has
  // something fresh is in the plan with a fresh game.
  const fresh = GAMES.filter((g) => !yesterday.gameIds.includes(g.id));
  for (const area of new Set(fresh.map((g) => g.area))) {
    const picked = GAMES.filter((g) => g.area === area && today.gameIds.includes(g.id));
    expect(picked).toHaveLength(1);
    expect(yesterday.gameIds).not.toContain(picked[0].id);
  }
});

test('completedDays returns only complete plans', async () => {
  await db.dailyPlans.bulkPut([
    { day: '2026-10-18', gameIds: ['a', 'b', 'c'], completed: ['a', 'b', 'c'] },
    { day: '2026-10-19', gameIds: ['a', 'b', 'c'], completed: ['a', 'b'] },
  ]);
  expect(await completedDays()).toEqual(['2026-10-18']);
  expect(isPlanComplete((await getPlan('2026-10-19'))!)).toBe(false);
});
