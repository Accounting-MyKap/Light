import { recordGameResult } from './recordGameResult';
import { fakeGame } from '../test/fakeGame';
import { clearAllData, db } from '../data/db';
import { getStartLevel } from '../data/levels';
import { makeChoice } from '../test/quizFixtures';
import type { QuizRoundDetails } from '../quiz/types';

beforeEach(clearAllData);
afterEach(() => {
  vi.restoreAllMocks();
});

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

function quizDetails(): QuizRoundDetails {
  return {
    items: Array.from({ length: 10 }, (_, i) => ({
      question: makeChoice(`science-${String(i + 1).padStart(4, '0')}`, 'science', 1),
      outcome: i < 7 ? ('correct' as const) : ('wrong' as const),
      chosen: i < 7 ? 0 : 2,
    })),
  };
}

test('a quiz result stores its answers with the result id', async () => {
  const res = await recordGameResult({
    game: fakeGame,
    startLevel: 1,
    result: { score: 70, accuracy: 0.7, levelReached: 1, durationMs: 90000, quiz: quizDetails() },
    daily: null,
  });
  const rows = await db.quizAnswers.toArray();
  expect(rows).toHaveLength(10);
  expect(rows.every((r) => r.resultId === res.stored.id && r.answeredAt === res.stored.playedAt)).toBe(true);
  expect(rows.every((r) => r.category === 'science')).toBe(true);
  expect(rows.filter((r) => r.outcome === 'correct')).toHaveLength(7);
});

test('a result without quiz details stores no answers', async () => {
  await recordGameResult({
    game: fakeGame,
    startLevel: 1,
    result: { score: 70, accuracy: 0.7, levelReached: 1, durationMs: 90000 },
    daily: null,
  });
  expect(await db.quizAnswers.count()).toBe(0);
});

test('retrying a save with the same id keeps one set of answers', async () => {
  const args = {
    game: fakeGame,
    startLevel: 1,
    result: { score: 70, accuracy: 0.7, levelReached: 1, durationMs: 90000, quiz: quizDetails() },
    daily: null,
    resultId: 'retry-1',
  };
  await recordGameResult(args);
  await recordGameResult(args);
  expect(await db.results.count()).toBe(1);
  expect(await db.quizAnswers.count()).toBe(10);
});

test('a failed save of the answers writes neither them nor the result, and the retry saves both once', async () => {
  const bulkPut = vi.spyOn(db.quizAnswers, 'bulkPut').mockRejectedValueOnce(new Error('QuotaExceededError'));
  const args = {
    game: fakeGame,
    startLevel: 1,
    result: { score: 70, accuracy: 0.7, levelReached: 1, durationMs: 90000, quiz: quizDetails() },
    daily: null,
    resultId: 'tx-1',
  };
  await expect(recordGameResult(args)).rejects.toThrow('QuotaExceededError');
  expect(await db.results.count()).toBe(0);
  expect(await db.quizAnswers.count()).toBe(0);

  await recordGameResult(args);
  expect(bulkPut).toHaveBeenCalledTimes(2);
  expect((await db.results.toArray()).map((r) => r.id)).toEqual(['tx-1']);
  expect(await db.quizAnswers.count()).toBe(10);
});
