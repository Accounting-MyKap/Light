import { clearAllData, db, type StoredSettings } from './db';
import { addResult, bestScore, highestLevelReached, listResults } from './results';
import { getStartLevel, setStartLevel } from './levels';
import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings';

const base = { gameId: 'g', level: 1, score: 10, accuracy: 0.5, durationMs: 60000, isDaily: false };

beforeEach(clearAllData);

test('addResult stores immutable record with local day', async () => {
  const r = await addResult({ ...base, level: 2, score: 50, playedAt: new Date(2026, 9, 18, 23, 30) });
  expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(r.synced).toBe(0);
  expect(r.day).toBe('2026-10-18');
  expect(r.playedAt).toBe(new Date(2026, 9, 18, 23, 30).toISOString());
  expect(await db.results.get(r.id)).toEqual(r);
});

test('listResults filters and sorts', async () => {
  await addResult({ ...base, gameId: 'a', playedAt: new Date(2026, 9, 18) });
  await addResult({ ...base, gameId: 'a', playedAt: new Date(2026, 9, 10) });
  await addResult({ ...base, gameId: 'b', playedAt: new Date(2026, 9, 17) });
  expect((await listResults({ gameId: 'a' })).map((r) => r.day)).toEqual(['2026-10-10', '2026-10-18']);
  expect((await listResults({ sinceDay: '2026-10-17' })).map((r) => r.day)).toEqual(['2026-10-17', '2026-10-18']);
  expect(await listResults()).toHaveLength(3);
});

test('bestScore', async () => {
  expect(await bestScore('a')).toBeNull();
  await addResult({ ...base, gameId: 'a', score: 10 });
  await addResult({ ...base, gameId: 'a', score: 30 });
  await addResult({ ...base, gameId: 'b', score: 99 });
  expect(await bestScore('a')).toBe(30);
});

test('highestLevelReached is the highest level reached in any game of that game, or 0', async () => {
  expect(await highestLevelReached('a')).toBe(0);
  await addResult({ ...base, gameId: 'a', level: 3 });
  await addResult({ ...base, gameId: 'a', level: 6 });
  await addResult({ ...base, gameId: 'a', level: 2 });
  await addResult({ ...base, gameId: 'b', level: 9 });
  expect(await highestLevelReached('a')).toBe(6);
});

test('levels default, persist and clamp', async () => {
  expect(await getStartLevel('a')).toBe(1);
  await setStartLevel('a', 4);
  expect(await getStartLevel('a')).toBe(4);
  await setStartLevel('a', 11);
  expect(await getStartLevel('a')).toBe(10);
});

test('settings default and merge', async () => {
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  await updateSettings({ sound: false });
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false });
  await updateSettings({ theme: 'dark' });
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false, theme: 'dark' });
});

test('settings stored before vibration existed read as vibration on', async () => {
  // A row written by an older version, without the field.
  const legacy: Omit<StoredSettings, 'vibration'> = {
    id: 'settings',
    language: 'es',
    sound: false,
    theme: 'dark',
    seenInstructions: [],
  };
  await db.settings.put(legacy as StoredSettings);
  expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, language: 'es', sound: false, theme: 'dark', vibration: true });
});

test('clearAllData empties every table', async () => {
  await addResult(base);
  await setStartLevel('a', 3);
  await updateSettings({ sound: false });
  await db.dailyPlans.put({ day: '2026-10-18', gameIds: ['a'], completed: [] });
  await clearAllData();
  expect(await db.results.count()).toBe(0);
  expect(await db.gameLevels.count()).toBe(0);
  expect(await db.dailyPlans.count()).toBe(0);
  expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
});
