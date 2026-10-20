import { clearAllData, db } from '../data/db';
import { addResult } from '../data/results';
import { createFakeRemote, type FakeRemote } from '../test/fakeRemote';
import { deleteEverything } from './deleteData';
import { syncNow } from './syncEngine';

const play = { gameId: 'arrows', level: 1, score: 100, accuracy: 0.8, durationMs: 60000, isDaily: false };
const token = async () => 'tok';

beforeEach(async () => {
  // Failures are logged for the developer; the tests below provoke them on purpose.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await clearAllData();
});
afterEach(() => vi.restoreAllMocks());

/** Two plays, both uploaded, so the device holds a server identity and the server holds the rows. */
async function playAndSync(remote: FakeRemote): Promise<string> {
  await addResult(play);
  await addResult({ ...play, score: 120 });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['arrows'], completed: ['arrows'] });
  await syncNow(remote, token);
  return remote.currentUser!;
}

async function localRowCount(): Promise<number> {
  return (await db.results.count()) + (await db.dailyPlans.count()) + (await db.meta.count());
}

test('without a remote it clears everything on the device', async () => {
  await addResult(play);
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['arrows'], completed: [] });

  expect(await deleteEverything(null)).toBe('ok');

  expect(await localRowCount()).toBe(0);
});

test('with a session it deletes on the server, signs out and then clears the device', async () => {
  const remote = createFakeRemote();
  const userId = await playAndSync(remote);
  expect(remote.users.get(userId)!.results.size).toBe(2);
  expect(remote.users.get(userId)!.completions.size).toBe(1);
  expect(await db.meta.count()).toBe(1);

  expect(await deleteEverything(remote)).toBe('ok');

  expect(remote.users.get(userId)!.results.size).toBe(0);
  expect(remote.users.get(userId)!.completions.size).toBe(0);
  expect(remote.currentUser).toBeNull();
  expect(await localRowCount()).toBe(0);
});

test('the server data goes before the session does', async () => {
  const remote = createFakeRemote();
  await playAndSync(remote);
  const calls: string[] = [];
  const deleteMyData = remote.deleteMyData;
  const signOut = remote.signOut;
  remote.deleteMyData = async () => {
    calls.push('deleteMyData');
    await deleteMyData();
  };
  remote.signOut = async () => {
    calls.push('signOut');
    await signOut();
  };

  await deleteEverything(remote);

  expect(calls).toEqual(['deleteMyData', 'signOut']);
});

test('without a session there is nothing to delete on the server, only on the device', async () => {
  const remote = createFakeRemote();
  const deleteMyData = vi.spyOn(remote, 'deleteMyData');
  const signOut = vi.spyOn(remote, 'signOut');
  await addResult(play);

  expect(await deleteEverything(remote)).toBe('ok');

  expect(deleteMyData).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  expect(await localRowCount()).toBe(0);
});

test('a server failure leaves the device and the session untouched', async () => {
  const remote = createFakeRemote();
  const userId = await playAndSync(remote);
  remote.failNext('network');

  expect(await deleteEverything(remote)).toBe('remote-failed');

  expect(await db.results.count()).toBe(2);
  expect(await db.dailyPlans.count()).toBe(1);
  expect((await db.meta.get('sync'))?.remoteUserId).toBe(userId);
  expect(remote.currentUser).toBe(userId);
  expect(remote.users.get(userId)!.results.size).toBe(2);
});

test('after a failure, trying again deletes everything', async () => {
  const remote = createFakeRemote();
  const userId = await playAndSync(remote);
  remote.failNext('network');
  expect(await deleteEverything(remote)).toBe('remote-failed');

  expect(await deleteEverything(remote)).toBe('ok');

  expect(remote.users.get(userId)!.results.size).toBe(0);
  expect(remote.currentUser).toBeNull();
  expect(await localRowCount()).toBe(0);
});

test('not being able to read the session counts as a server failure', async () => {
  const remote = createFakeRemote();
  await playAndSync(remote);
  remote.currentUserId = async () => {
    throw new Error('storage unavailable');
  };

  expect(await deleteEverything(remote)).toBe('remote-failed');

  expect(await db.results.count()).toBe(2);
});

test('if signing out fails the device is kept, and a retry that finds no session clears it', async () => {
  const remote = createFakeRemote();
  const userId = await playAndSync(remote);
  // supabase-js clears its stored session and can still reject when offline.
  remote.signOut = async () => {
    remote.currentUser = null;
    throw new Error('offline');
  };

  expect(await deleteEverything(remote)).toBe('remote-failed');
  expect(remote.users.get(userId)!.results.size).toBe(0);
  expect(await db.results.count()).toBe(2);

  expect(await deleteEverything(remote)).toBe('ok');
  expect(await localRowCount()).toBe(0);
});

test('a failure while clearing the device is not hidden', async () => {
  const remote = createFakeRemote();
  await playAndSync(remote);
  vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('IndexedDB is gone'));

  await expect(deleteEverything(remote)).rejects.toThrow('IndexedDB is gone');
});
