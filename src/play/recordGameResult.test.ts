import { recordGameResult } from './recordGameResult';
import { fakeGame } from '../test/fakeGame';
import { clearAllData } from '../data/db';
import { getStartLevel } from '../data/levels';

beforeEach(clearAllData);

test('recordGameResult stores result and next start level', async () => {
  const first = await recordGameResult({
    game: fakeGame,
    startLevel: 3,
    result: { score: 120, accuracy: 0.9, levelReached: 4, durationMs: 60000 },
    daily: null,
  });
  expect(first.previousBest).toBeNull();
  expect(first.newStartLevel).toBe(4);
  expect(first.stored).toMatchObject({ gameId: 'fake', level: 4, score: 120, isDaily: false });
  expect(await getStartLevel('fake')).toBe(4);
  const second = await recordGameResult({
    game: fakeGame,
    startLevel: 4,
    result: { score: 80, accuracy: 0.5, levelReached: 4, durationMs: 60000 },
    daily: null,
  });
  expect(second.previousBest).toBe(120);
  expect(second.newStartLevel).toBe(3);
});

test('daily results mark the plan of the given day', async () => {
  const { db } = await import('../data/db');
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['fake', 'x', 'y'], completed: [] });
  const res = await recordGameResult({
    game: fakeGame,
    startLevel: 1,
    result: { score: 50, accuracy: 0.7, levelReached: 1, durationMs: 60000 },
    daily: '2026-10-20',
  });
  expect(res.stored.isDaily).toBe(true);
  expect(res.plan?.completed).toEqual(['fake']);
  expect((await db.dailyPlans.get('2026-10-20'))?.completed).toEqual(['fake']);
});
