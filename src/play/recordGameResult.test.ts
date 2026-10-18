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
