import { beforeEach, describe, expect, test } from 'vitest';
import { localDay } from '../../src/core/dates';
import { getOrCreatePlan, markDailyGameDone } from '../../src/data/dailyPlans';
import { clearAllData, db } from '../../src/data/db';
import { addResult, type NewResult } from '../../src/data/results';
import { GAMES } from '../../src/games/registry';
import { deleteEverything } from '../../src/sync/deleteData';
import { fetchPercentile } from '../../src/sync/percentile';
import type { RemoteResult } from '../../src/sync/remote';
import { syncNow } from '../../src/sync/syncEngine';
import { adminClient, guestClient, memoryStorage, newGuestRemote, resetDatabase } from './helpers';

// The local stack has no Turnstile, so guests sign in without a captcha token.
const noCaptcha = async () => undefined;

beforeEach(async () => {
  await resetDatabase();
  await clearAllData();
});

/** A local result that satisfies every server check; each test overrides what it cares about. */
function localResult(overrides: Partial<NewResult> = {}): NewResult {
  return { gameId: 'quick-math', level: 3, score: 100, accuracy: 0.9, durationMs: 30_000, isDaily: false, ...overrides };
}

async function serverResults(userId: string) {
  const { data, error } = await adminClient().from('results').select('*').eq('user_id', userId).order('played_at');
  expect(error).toBeNull();
  return data ?? [];
}

async function serverCompletions(userId: string) {
  const { data, error } = await adminClient().from('daily_completions').select('*').eq('user_id', userId).order('day');
  expect(error).toBeNull();
  return data ?? [];
}

async function serverUserCount(): Promise<number> {
  const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  return data?.users.length ?? 0;
}

/** Signs in `scores.length` more guests, each with one Quick Math game, directly on the server. */
async function seedOtherPlayers(scores: number[]): Promise<void> {
  await Promise.all(
    scores.map(async (score) => {
      const player = newGuestRemote();
      await player.signInGuest(undefined);
      const row: RemoteResult = {
        id: crypto.randomUUID(), game_id: 'quick-math', level: 3, score, accuracy: 0.9, duration_ms: 30_000,
        is_daily: false, played_at: new Date().toISOString(),
      };
      await player.upsertResults([row]);
    }),
  );
}

describe('games catalog', () => {
  test('the games table matches the registry', async () => {
    const { data, error } = await adminClient().from('games').select('id, area, max_score').order('id');
    expect(error).toBeNull();
    const expected = GAMES.map((game) => ({ id: game.id, area: game.area, max_score: game.maxScore })).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    expect(data).toEqual(expected);
  });
});

describe('syncNow', () => {
  test('uploads 3 results once and never duplicates them', async () => {
    const remote = newGuestRemote();
    const stored = [
      await addResult(localResult({ gameId: 'quick-math', score: 120 })),
      await addResult(localResult({ gameId: 'arrows', level: 5, score: 800, accuracy: 0.75, durationMs: 45_000, isDaily: true })),
      await addResult(localResult({ gameId: 'sequence-lights', level: 1, score: 40, accuracy: 1 })),
    ];

    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 3, rejected: 0, pending: 0 });
    const userId = await remote.currentUserId();
    expect(userId).not.toBeNull();

    const rows = await serverResults(userId as string);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.id).sort()).toEqual(stored.map((result) => result.id).sort());
    const arrows = rows.find((row) => row.game_id === 'arrows');
    expect(arrows).toMatchObject({ level: 5, score: 800, accuracy: 0.75, duration_ms: 45_000, is_daily: true });
    expect(Date.parse(arrows?.played_at)).toBe(Date.parse(stored[1].playedAt));
    expect(await db.results.where('synced').equals(1).count()).toBe(3);

    // A second run has nothing to upload.
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
    expect(await serverResults(userId as string)).toHaveLength(3);

    // Even if the device re-sends the very same ids (e.g. the "uploaded" marks were lost), the server keeps 3 rows.
    await db.results.toCollection().modify({ synced: 0 });
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 3, rejected: 0, pending: 0 });
    expect(await serverResults(userId as string)).toHaveLength(3);
    expect(await serverUserCount()).toBe(1);
  });

  test('rejects a row with score 99999 for good and uploads the others', async () => {
    const remote = newGuestRemote();
    const good1 = await addResult(localResult({ score: 150, playedAt: new Date(Date.now() - 3000) }));
    const impossible = await addResult(localResult({ score: 99_999, playedAt: new Date(Date.now() - 2000) }));
    const good2 = await addResult(localResult({ gameId: 'arrows', score: 700, playedAt: new Date(Date.now() - 1000) }));

    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 2, rejected: 1, pending: 0 });

    const userId = (await remote.currentUserId()) as string;
    const rows = await serverResults(userId);
    expect(rows.map((row) => row.id).sort()).toEqual([good1.id, good2.id].sort());
    expect(rows.some((row) => row.score === 99_999)).toBe(false);
    expect((await db.results.get(impossible.id))?.synced).toBe(2);
    expect((await db.results.get(good1.id))?.synced).toBe(1);
    expect((await db.results.get(good2.id))?.synced).toBe(1);

    // The refused row is not retried: nothing is pending and the server still has the same two rows.
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
    expect(await serverResults(userId)).toHaveLength(2);
  });

  // The error codes the client treats as "refused for good" must be the ones the real server raises.
  const invalidRows: [string, Partial<NewResult>][] = [
    ['a played_at more than 5 minutes in the future', { playedAt: new Date(Date.now() + 60 * 60 * 1000) }],
    ['a duration under 5 seconds', { durationMs: 1000 }],
    ['an accuracy above 1', { accuracy: 1.5 }],
    ['a level above 10', { level: 11 }],
    ['a negative score', { score: -1 }],
    ['a game that does not exist', { gameId: 'no-such-game' }],
  ];
  test.each(invalidRows)('rejects %s for good', async (_name, bad) => {
    const remote = newGuestRemote();
    const good = await addResult(localResult({ playedAt: new Date(Date.now() - 2000) }));
    const refused = await addResult(localResult({ ...bad, playedAt: bad.playedAt ?? new Date(Date.now() - 1000) }));

    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 1, rejected: 1, pending: 0 });

    const rows = await serverResults((await remote.currentUserId()) as string);
    expect(rows.map((row) => row.id)).toEqual([good.id]);
    expect((await db.results.get(refused.id))?.synced).toBe(2);
  });

  test('uploads a completed day and leaves an unfinished one out', async () => {
    const remote = newGuestRemote();
    const completeDay = localDay(new Date());
    const unfinishedDay = '2026-01-15';

    const complete = await getOrCreatePlan(completeDay);
    for (const gameId of complete.gameIds) await markDailyGameDone(completeDay, gameId);
    const unfinished = await getOrCreatePlan(unfinishedDay);
    await markDailyGameDone(unfinishedDay, unfinished.gameIds[0]);

    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });

    const userId = (await remote.currentUserId()) as string;
    const rows = await serverCompletions(userId);
    expect(rows).toEqual([{ user_id: userId, day: completeDay, games: complete.gameIds }]);

    // Re-sending the same day (e.g. the "uploaded" mark was lost) keeps a single row.
    await db.dailyPlans.toCollection().modify({ syncedCompletion: false });
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 0, rejected: 0, pending: 0 });
    expect(await serverCompletions(userId)).toHaveLength(1);
  });
});

describe('row-level security', () => {
  test("a guest only sees their own results and completed days", async () => {
    const storageA = memoryStorage();
    const storageB = memoryStorage();
    const day = localDay(new Date());

    // Guest A and guest B share this device's local database one after the other.
    const a = await addResult(localResult({ score: 111 }));
    const planA = await getOrCreatePlan(day);
    for (const gameId of planA.gameIds) await markDailyGameDone(day, gameId);
    const remoteA = newGuestRemote(storageA);
    expect((await syncNow(remoteA, noCaptcha)).status).toBe('ok');
    const userA = (await remoteA.currentUserId()) as string;

    await clearAllData();
    const b = await addResult(localResult({ gameId: 'arrows', score: 222 }));
    const remoteB = newGuestRemote(storageB);
    expect((await syncNow(remoteB, noCaptcha)).status).toBe('ok');
    const userB = (await remoteB.currentUserId()) as string;
    expect(userB).not.toBe(userA);

    // The server holds both players' rows...
    expect((await adminClient().from('results').select('id')).data).toHaveLength(2);

    // ...but each guest, with their own session, sees only theirs.
    const asA = await guestClient(storageA).from('results').select('id');
    expect(asA.error).toBeNull();
    expect(asA.data).toEqual([{ id: a.id }]);
    const asB = await guestClient(storageB).from('results').select('id');
    expect(asB.error).toBeNull();
    expect(asB.data).toEqual([{ id: b.id }]);

    // Asking for the other player's rows by user id does not get past row-level security either.
    const peek = await guestClient(storageB).from('results').select('id').eq('user_id', userA);
    expect(peek.error).toBeNull();
    expect(peek.data).toEqual([]);
    const peekCompletions = await guestClient(storageB).from('daily_completions').select('day');
    expect(peekCompletions.error).toBeNull();
    expect(peekCompletions.data).toEqual([]);
    const ownCompletions = await guestClient(storageA).from('daily_completions').select('day');
    expect(ownCompletions.data).toEqual([{ day }]);
  });
});

describe('fetchPercentile', () => {
  test('is null while fewer than 20 other players are active', async () => {
    const remote = newGuestRemote();
    await addResult(localResult({ score: 105 }));
    expect((await syncNow(remote, noCaptcha)).status).toBe('ok');

    // 19 others plus the caller make 20 players, but only the others count.
    await seedOtherPlayers(Array.from({ length: 19 }, (_, i) => (i + 1) * 10));
    expect(await fetchPercentile(remote, 'quick-math', new Date())).toBeNull();
  });

  test('ranks a best score of 105 at 50 among 20 other players scoring 10 to 200', async () => {
    const remote = newGuestRemote();
    await addResult(localResult({ score: 105 }));
    expect((await syncNow(remote, noCaptcha)).status).toBe('ok');

    await seedOtherPlayers(Array.from({ length: 20 }, (_, i) => (i + 1) * 10));
    expect(await fetchPercentile(remote, 'quick-math', new Date())).toBe(50);
  });
});

describe('lost identity', () => {
  test('a deleted guest gets a new identity that receives every local result', async () => {
    const remote = newGuestRemote();
    const first = await addResult(localResult({ score: 130, playedAt: new Date(Date.now() - 2000) }));
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 1, rejected: 0, pending: 0 });
    const oldUserId = (await remote.currentUserId()) as string;
    expect(await serverResults(oldUserId)).toHaveLength(1);

    // The server forgets this guest (e.g. the weekly cleanup of inactive anonymous users); its rows go with it.
    const { error } = await adminClient().auth.admin.deleteUser(oldUserId);
    expect(error).toBeNull();
    expect(await serverResults(oldUserId)).toHaveLength(0);

    const second = await addResult(localResult({ gameId: 'arrows', score: 640, playedAt: new Date(Date.now() - 1000) }));
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 2, rejected: 0, pending: 0 });

    const newUserId = (await remote.currentUserId()) as string;
    expect(newUserId).not.toBe(oldUserId);
    expect((await serverResults(newUserId)).map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
    expect(await serverResults(oldUserId)).toHaveLength(0);
    expect((await db.results.toArray()).map((row) => row.synced)).toEqual([1, 1]);
    expect(await serverUserCount()).toBe(1);
  });
});

describe('deleteEverything', () => {
  test("removes the guest's results and completed days from the server and clears the device", async () => {
    const remote = newGuestRemote();
    await addResult(localResult({ score: 140, playedAt: new Date(Date.now() - 2000) }));
    await addResult(localResult({ gameId: 'arrows', score: 500, playedAt: new Date(Date.now() - 1000) }));
    const day = localDay(new Date());
    const plan = await getOrCreatePlan(day);
    for (const gameId of plan.gameIds) await markDailyGameDone(day, gameId);
    expect(await syncNow(remote, noCaptcha)).toEqual({ status: 'ok', uploaded: 2, rejected: 0, pending: 0 });
    const userId = (await remote.currentUserId()) as string;
    expect(await serverResults(userId)).toHaveLength(2);
    expect(await serverCompletions(userId)).toHaveLength(1);

    expect(await deleteEverything(remote)).toBe('ok');

    expect(await serverResults(userId)).toHaveLength(0);
    expect(await serverCompletions(userId)).toHaveLength(0);
    expect(await remote.currentUserId()).toBeNull();
    expect(await db.results.count()).toBe(0);
    expect(await db.dailyPlans.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });
});
