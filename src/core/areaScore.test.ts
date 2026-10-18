import { areaScores, gameAreaScore } from './areaScore';
import type { Area } from '../games/types';

test('gameAreaScore', () => {
  expect(gameAreaScore(300, 600)).toBe(500);
  expect(gameAreaScore(1200, 600)).toBe(1000);
  expect(gameAreaScore(0, 600)).toBe(0);
});

test('areaScores uses best of last 30 days and averages per area', () => {
  const now = new Date('2026-10-20T12:00:00');
  const games: { id: string; area: Area; referenceScore: number }[] = [
    { id: 'x', area: 'memory', referenceScore: 100 },
    { id: 'y', area: 'memory', referenceScore: 100 },
    { id: 'z', area: 'math', referenceScore: 100 },
  ];
  const results = [
    { gameId: 'x', score: 40, playedAt: '2026-10-19T10:00:00.000Z' },
    { gameId: 'x', score: 90, playedAt: '2026-09-01T10:00:00.000Z' },
    { gameId: 'y', score: 60, playedAt: '2026-10-18T10:00:00.000Z' },
  ];
  expect(areaScores(results, games, now)).toEqual({ memory: 500 });
});
