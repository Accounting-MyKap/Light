import { clearAllData, db } from '../data/db';
import { addResult } from '../data/results';
import { createFakeRemote, type FakeRemote } from '../test/fakeRemote';
import { RemoteError } from './remote';
import { RESULT_BATCH_SIZE, syncNow } from './syncEngine';

const play = { gameId: 'arrows', level: 1, score: 100, accuracy: 0.8, durationMs: 60000, isDaily: false };
const token = async () => 'tok';

beforeEach(clearAllData);

let clock = Date.parse('2026-10-20T10:00:00Z');

/** Plays `count` games one second apart, so `playedAt` order is creation order across calls. */
async function addResults(count: number, overrides: Partial<typeof play> = {}) {
  const added = [];
  for (let i = 0; i < count; i++) added.push(await addResult({ ...play, ...overrides, playedAt: new Date((clock += 1000)) }));
  return added;
}

function countSynced(state: 0 | 1 | 2): Promise<number> {
  return db.results.where('synced').equals(state).count();
}

function serverResults(remote: FakeRemote, userId = remote.currentUser!): Set<string> {
  return new Set(remote.users.get(userId)!.results.keys());
}

function putPlan(day: string, completed = true) {
  const gameIds = ['arrows', 'quick-math', 'rule-switch'];
  return db.dailyPlans.put({ day, gameIds, completed: completed ? gameIds : ['arrows'] });
}

/** After `calls` calls to `upsertResults` (successful or not), the next remote call fails with a network error. */
function dropNetworkAfter(remote: FakeRemote, calls: number): void {
  const original = remote.upsertResults;
  let made = 0;
  remote.upsertResults = async (rows) => {
    try {
      await original(rows);
    } finally {
      if (++made === calls) remote.failNext('network');
    }
  };
}

test('nothing pending: no network, no identity', async () => {
  const r = createFakeRemote();
  const currentUserId = vi.spyOn(r, 'currentUserId');
  await addResults(2);
  await db.results.toCollection().modify({ synced: 1 });
  await putPlan('2026-10-19', false);
  expect(await syncNow(r, async () => 'tok')).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
  expect(currentUserId).not.toHaveBeenCalled();
  expect(r.signInCount).toBe(0);
});

test('first upload creates one guest identity with the captcha token and marks results synced', async () => {
  const r = createFakeRemote();
  const signIn = vi.spyOn(r, 'signInGuest');
  const added = await addResults(3);
  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 3, rejected: 0, pending: 0 });
  expect(signIn).toHaveBeenCalledExactlyOnceWith('tok');
  expect(r.signInCount).toBe(1);
  expect(await countSynced(1)).toBe(3);
  expect(serverResults(r)).toEqual(new Set(added.map((a) => a.id)));
  expect(r.users.get(r.currentUser!)!.results.get(added[0].id)).toEqual({
    id: added[0].id, game_id: 'arrows', level: 1, score: 100, accuracy: 0.8, duration_ms: 60000, is_daily: false,
    played_at: added[0].playedAt,
  });
});

test('uploads in batches of 100', async () => {
  expect(RESULT_BATCH_SIZE).toBe(100);
  const r = createFakeRemote();
  const upsert = vi.spyOn(r, 'upsertResults');
  await addResults(250);
  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 250, rejected: 0, pending: 0 });
  expect(upsert.mock.calls.map(([rows]) => rows.length)).toEqual([100, 100, 50]);
  expect(await countSynced(1)).toBe(250);
  expect(serverResults(r).size).toBe(250);
});

test('re-running does not duplicate', async () => {
  const r = createFakeRemote();
  const upsert = vi.spyOn(r, 'upsertResults');
  await addResults(3);
  await syncNow(r, token);
  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(serverResults(r).size).toBe(3);
  expect(r.signInCount).toBe(1);
});

test('the captcha is only requested when a new identity is needed', async () => {
  const r = createFakeRemote();
  const getToken = vi.fn(token);
  await addResults(1);
  await syncNow(r, getToken);
  await addResults(1);
  await syncNow(r, getToken);
  expect(getToken).toHaveBeenCalledTimes(1);
  expect(serverResults(r).size).toBe(2);
});

test('a rejected row does not block the rest', async () => {
  const r = createFakeRemote();
  r.rejectIf((row) => row.score > 1000);
  const upsert = vi.spyOn(r, 'upsertResults');
  const [bad] = await addResults(1, { score: 5000 });
  const good = await addResults(3);
  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 3, rejected: 1, pending: 0 });
  expect((await db.results.get(bad.id))!.synced).toBe(2);
  expect(await countSynced(1)).toBe(3);
  expect(serverResults(r)).toEqual(new Set(good.map((g) => g.id)));

  upsert.mockClear();
  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
  expect(upsert).not.toHaveBeenCalled();
});

test('a score above the game maximum is rejected like the server trigger does', async () => {
  const r = createFakeRemote();
  await addResults(1, { gameId: 'sequence-lights', score: 961 });
  await addResults(1, { gameId: 'sequence-lights', score: 960 });
  expect(await syncNow(r, token)).toMatchObject({ status: 'ok', uploaded: 1, rejected: 1 });
});

test('network failure keeps everything pending and reports offline', async () => {
  const r = createFakeRemote();
  await addResults(3);
  r.failNext('network');
  expect(await syncNow(r, token)).toEqual({ status: 'offline', uploaded: 0, rejected: 0, pending: 3 });
  expect(await countSynced(0)).toBe(3);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 3, rejected: 0, pending: 0 });
  expect(await countSynced(1)).toBe(3);
});

test('network failure mid-way keeps what was already uploaded', async () => {
  const r = createFakeRemote();
  const upsert = vi.spyOn(r, 'upsertResults');
  await addResults(150);
  dropNetworkAfter(r, 1);
  expect(await syncNow(r, token)).toEqual({ status: 'offline', uploaded: 100, rejected: 0, pending: 50 });
  expect(await countSynced(1)).toBe(100);
  expect(await countSynced(0)).toBe(50);
  expect(serverResults(r).size).toBe(100);

  upsert.mockClear();
  expect(await syncNow(r, token)).toMatchObject({ status: 'ok', uploaded: 50, pending: 0 });
  expect(upsert.mock.calls.map(([rows]) => rows.length)).toEqual([50]);
  expect(serverResults(r).size).toBe(150);
});

test('a network failure while isolating a rejected batch keeps the rows already settled', async () => {
  const r = createFakeRemote();
  const [first] = await addResults(1);
  const [second] = await addResults(1, { score: 5000 });
  const [third] = await addResults(1);
  r.rejectIf((row) => row.score > 1000);
  // Calls: the whole batch (rejected), the first row, the bad row (rejected), then the network drops on the third row.
  dropNetworkAfter(r, 3);
  expect(await syncNow(r, token)).toEqual({ status: 'offline', uploaded: 1, rejected: 1, pending: 1 });
  expect((await db.results.get(first.id))!.synced).toBe(1);
  expect((await db.results.get(second.id))!.synced).toBe(2);
  expect((await db.results.get(third.id))!.synced).toBe(0);
});

test('lost identity: a new guest is created and everything is uploaded again', async () => {
  const r = createFakeRemote();
  const first = await addResults(3);
  await syncNow(r, token);
  const oldUser = r.currentUser!;
  r.users.delete(oldUser);
  r.currentUser = null;
  const [extra] = await addResults(1);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 4, rejected: 0, pending: 0 });
  expect(r.signInCount).toBe(2);
  expect(r.currentUser).not.toBe(oldUser);
  expect(serverResults(r)).toEqual(new Set([...first, extra].map((a) => a.id)));
  expect(await countSynced(1)).toBe(4);
  expect((await db.meta.get('sync'))!.remoteUserId).toBe(r.currentUser);
});

test('a session for a different user also triggers the re-upload', async () => {
  const r = createFakeRemote();
  await addResults(2);
  await syncNow(r, token);
  await r.signInGuest();
  await addResults(1);
  expect(await syncNow(r, token)).toMatchObject({ status: 'ok', uploaded: 3 });
  expect(serverResults(r).size).toBe(3);
});

test('lost identity: completed days are uploaded again', async () => {
  const r = createFakeRemote();
  await putPlan('2026-10-19');
  await syncNow(r, token);
  r.users.clear();
  r.currentUser = null;
  await addResults(1);

  await syncNow(r, token);
  expect([...r.users.get(r.currentUser!)!.completions]).toEqual(['2026-10-19']);
});

test('rows the server refused stay refused after an identity change', async () => {
  const r = createFakeRemote();
  r.rejectIf((row) => row.score > 1000);
  const [bad] = await addResults(1, { score: 5000 });
  await addResults(1);
  await syncNow(r, token);
  r.users.clear();
  r.currentUser = null;
  const upsert = vi.spyOn(r, 'upsertResults');
  await addResults(1);

  expect(await syncNow(r, token)).toMatchObject({ status: 'ok', uploaded: 2, rejected: 0, pending: 0 });
  expect((await db.results.get(bad.id))!.synced).toBe(2);
  expect(upsert.mock.calls.flatMap(([rows]) => rows.map((row) => row.id))).not.toContain(bad.id);
});

test('auth error signs out and reports error; the next run uses a new identity', async () => {
  const r = createFakeRemote();
  const first = await addResults(3);
  await syncNow(r, token);
  const oldUser = r.currentUser!;
  const [extra] = await addResults(1);

  r.failNext('auth');
  expect(await syncNow(r, token)).toEqual({ status: 'error', uploaded: 0, rejected: 0, pending: 1 });
  expect(r.currentUser).toBeNull();
  expect(await countSynced(0)).toBe(1);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 4, rejected: 0, pending: 0 });
  expect(r.signInCount).toBe(2);
  expect(r.currentUser).not.toBe(oldUser);
  expect(serverResults(r)).toEqual(new Set([...first, extra].map((a) => a.id)));
});

test('auth error is reported even when signing out fails', async () => {
  const r = createFakeRemote();
  await addResults(1);
  await r.signInGuest();
  r.failNext('auth');
  vi.spyOn(r, 'signOut').mockRejectedValue(new RemoteError('network', 'offline'));
  expect(await syncNow(r, token)).toEqual({ status: 'error', uploaded: 0, rejected: 0, pending: 1 });
});

test('a failure that is not a RemoteError counts as a network failure', async () => {
  const r = createFakeRemote();
  await addResults(2);
  vi.spyOn(r, 'upsertResults').mockRejectedValueOnce(new TypeError('Failed to fetch'));
  expect(await syncNow(r, token)).toEqual({ status: 'offline', uploaded: 0, rejected: 0, pending: 2 });
});

test('a captcha failure reports offline and creates no identity', async () => {
  const r = createFakeRemote();
  await addResults(2);
  const failing = async () => {
    throw new RemoteError('network', 'Captcha timed out');
  };
  expect(await syncNow(r, failing)).toEqual({ status: 'offline', uploaded: 0, rejected: 0, pending: 2 });
  expect(r.signInCount).toBe(0);
});

test('completed days are uploaded once', async () => {
  const r = createFakeRemote();
  const upsert = vi.spyOn(r, 'upsertCompletions');
  await putPlan('2026-10-18');
  await putPlan('2026-10-19', false);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
  expect(upsert).toHaveBeenCalledExactlyOnceWith([{ day: '2026-10-18', games: ['arrows', 'quick-math', 'rule-switch'] }]);
  expect([...r.users.get(r.currentUser!)!.completions]).toEqual(['2026-10-18']);
  expect((await db.dailyPlans.get('2026-10-18'))!.syncedCompletion).toBe(true);
  expect((await db.dailyPlans.get('2026-10-19'))!.syncedCompletion).toBeUndefined();

  expect(await syncNow(r, token)).toMatchObject({ status: 'ok', pending: 0 });
  expect(upsert).toHaveBeenCalledTimes(1);
});

test('results and completed days go up together; a network failure on the days keeps the results marked', async () => {
  const r = createFakeRemote();
  await addResults(2);
  await putPlan('2026-10-18');
  const upsertDays = vi.spyOn(r, 'upsertCompletions').mockRejectedValueOnce(new RemoteError('network', 'offline'));

  expect(await syncNow(r, token)).toEqual({ status: 'offline', uploaded: 2, rejected: 0, pending: 1 });
  expect(await countSynced(1)).toBe(2);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
  expect(upsertDays).toHaveBeenCalledTimes(2);
  expect([...r.users.get(r.currentUser!)!.completions]).toEqual(['2026-10-18']);
});

test('a completed day the server refuses is isolated, marked done and counted as rejected', async () => {
  const r = createFakeRemote();
  await r.signInGuest();
  await putPlan('2026-10-18');
  await putPlan('2026-10-19');
  // Calls: both days together (rejected), the first day (rejected), the second day (accepted).
  r.failNext('rejected', 2);

  expect(await syncNow(r, token)).toEqual({ status: 'ok', uploaded: 0, rejected: 1, pending: 0 });
  expect([...r.users.get(r.currentUser!)!.completions]).toEqual(['2026-10-19']);
  expect((await db.dailyPlans.get('2026-10-18'))!.syncedCompletion).toBe(true);
  expect((await db.dailyPlans.get('2026-10-19'))!.syncedCompletion).toBe(true);
});
