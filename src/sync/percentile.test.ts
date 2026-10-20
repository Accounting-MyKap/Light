import { clearAllData, db } from '../data/db';
import { addResult } from '../data/results';
import { createFakeRemote, type FakeRemote } from '../test/fakeRemote';
import { fetchPercentile } from './percentile';

const now = new Date('2026-10-20T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const play = { gameId: 'arrows', level: 1, score: 100, accuracy: 0.8, durationMs: 60000, isDaily: false };

beforeEach(clearAllData);
afterEach(() => vi.restoreAllMocks());

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

async function signedInRemote(): Promise<FakeRemote> {
  const remote = createFakeRemote();
  await remote.signInGuest();
  return remote;
}

test('no remote → null', async () => {
  await addResult({ ...play, playedAt: daysAgo(1) });
  expect(await fetchPercentile(null, 'arrows', now)).toBeNull();
});

test('no session → null, without creating an identity', async () => {
  const remote = createFakeRemote();
  const percentile = vi.spyOn(remote, 'percentile');
  const signInGuest = vi.spyOn(remote, 'signInGuest');
  await addResult({ ...play, playedAt: daysAgo(1) });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
  expect(percentile).not.toHaveBeenCalled();
  expect(signInGuest).not.toHaveBeenCalled();
  expect(remote.signInCount).toBe(0);
});

test('no plays of the game in the last 30 days → null, without asking the server', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile');
  await addResult({ ...play, playedAt: daysAgo(40) });
  await addResult({ ...play, gameId: 'quick-math', score: 500, playedAt: daysAgo(1) });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
  expect(percentile).not.toHaveBeenCalled();
});

test('uses the best score of the last 30 days', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile').mockResolvedValue(73);
  await addResult({ ...play, score: 300, playedAt: daysAgo(40) });
  await addResult({ ...play, score: 120, playedAt: daysAgo(10) });
  await addResult({ ...play, score: 200, playedAt: daysAgo(2) });
  await addResult({ ...play, gameId: 'quick-math', score: 900, playedAt: daysAgo(1) });
  expect(await fetchPercentile(remote, 'arrows', now)).toBe(73);
  expect(percentile).toHaveBeenCalledTimes(1);
  expect(percentile).toHaveBeenCalledWith('arrows', 200);
});

test('the window is closed at exactly 30 days ago', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile').mockResolvedValue(50);
  await addResult({ ...play, score: 400, playedAt: new Date(daysAgo(30).getTime() - 1) });
  await addResult({ ...play, score: 150, playedAt: daysAgo(30) });
  await fetchPercentile(remote, 'arrows', now);
  expect(percentile).toHaveBeenCalledWith('arrows', 150);
});

test('results the server refused do not count towards the best score', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile').mockResolvedValue(50);
  await addResult({ ...play, score: 120, playedAt: daysAgo(3) });
  const refused = await addResult({ ...play, score: 999999, playedAt: daysAgo(2) });
  await db.results.update(refused.id, { synced: 2 });
  await fetchPercentile(remote, 'arrows', now);
  expect(percentile).toHaveBeenCalledWith('arrows', 120);
});

test('only refused results in the window → null, without asking the server', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile');
  const refused = await addResult({ ...play, score: 999999, playedAt: daysAgo(2) });
  await db.results.update(refused.id, { synced: 2 });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
  expect(percentile).not.toHaveBeenCalled();
});

test('results still waiting to upload count towards the best score', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile').mockResolvedValue(10);
  await addResult({ ...play, score: 180, playedAt: daysAgo(1) });
  await fetchPercentile(remote, 'arrows', now);
  expect(percentile).toHaveBeenCalledWith('arrows', 180);
});

test('below the server threshold (null) → null', async () => {
  const remote = await signedInRemote();
  await addResult({ ...play, playedAt: daysAgo(1) });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
});

test('remote failure → null', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile');
  await addResult({ ...play, playedAt: daysAgo(1) });
  remote.failNext('network');
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
  expect(percentile).toHaveBeenCalledTimes(1);
});

test('a session lookup that rejects → null', async () => {
  const remote = await signedInRemote();
  vi.spyOn(remote, 'currentUserId').mockRejectedValue(new Error('storage unavailable'));
  await addResult({ ...play, playedAt: daysAgo(1) });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
});

test('unreadable local results → null', async () => {
  const remote = await signedInRemote();
  const percentile = vi.spyOn(remote, 'percentile');
  vi.spyOn(db.results, 'where').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  expect(await fetchPercentile(remote, 'arrows', now)).toBeNull();
  expect(percentile).not.toHaveBeenCalled();
});
