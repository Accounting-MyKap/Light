import { isPlanComplete } from '../data/dailyPlans';
import { db, type DailyPlan, type StoredResult } from '../data/db';
import { RemoteError, type RemoteCompletion, type RemoteResult, type RemoteStore } from './remote';

export interface SyncReport {
  status: 'ok' | 'offline' | 'error';
  /** Results the server accepted in this run. Completed days are not counted. */
  uploaded: number;
  /** Results and completed days the server refused for good in this run. */
  rejected: number;
  /** Results and completed days still waiting to upload when the run ended. */
  pending: number;
}

export const RESULT_BATCH_SIZE = 100;

interface Counts {
  uploaded: number;
  rejected: number;
}

/**
 * Uploads the local results and completed days the server does not have yet.
 * Rows are marked as soon as their batch is settled, so a run that stops half way never repeats finished work.
 * Remote failures become the report's status; local storage failures reject.
 */
export async function syncNow(remote: RemoteStore, getCaptchaToken: () => Promise<string | undefined>): Promise<SyncReport> {
  // Cheap gate: with nothing to upload the network is never touched and no guest identity is created.
  if ((await countPending()) === 0) return { status: 'ok', uploaded: 0, rejected: 0, pending: 0 };

  const counts: Counts = { uploaded: 0, rejected: 0 };
  const report = async (status: SyncReport['status']): Promise<SyncReport> => ({ status, ...counts, pending: await countPending() });
  try {
    await adoptIdentity(await ensureIdentity(remote, getCaptchaToken));
    await uploadResults(remote, counts);
    await uploadCompletions(remote, counts);
  } catch (error) {
    if (!(error instanceof RemoteError)) throw error;
    if (error.kind === 'network') return report('offline');
    // `auth`: the session is gone, so the next run signs in a new guest. Refused uploads are handled per row,
    // so a `rejected` reaching this point can only come from the identity step.
    if (error.kind === 'auth') await signOutQuietly(remote);
    return report('error');
  }
  return report('ok');
}

async function countPending(): Promise<number> {
  return (await db.results.where('synced').equals(0).count()) + (await pendingCompletions()).length;
}

async function pendingCompletions(): Promise<DailyPlan[]> {
  // `syncedCompletion` is not indexed: the plans table holds at most one small row per day.
  const plans = await db.dailyPlans.toArray();
  return plans.filter((plan) => isPlanComplete(plan) && !plan.syncedCompletion);
}

/** Remote and captcha failures always surface as `RemoteError`; anything else they throw counts as a network problem. */
async function remoteCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    throw new RemoteError('network', error instanceof Error ? error.message : 'Unexpected remote failure');
  }
}

async function ensureIdentity(remote: RemoteStore, getCaptchaToken: () => Promise<string | undefined>): Promise<string> {
  const current = await remoteCall(() => remote.currentUserId());
  if (current) return current;
  // The captcha is only solved when a guest identity is actually created.
  return remoteCall(async () => remote.signInGuest(await getCaptchaToken()));
}

/**
 * Remembers which server identity the "uploaded" marks belong to. When the identity changed, the new one has none
 * of those rows, so they go back to pending. Rows the server refused for good (`synced = 2`) stay refused.
 */
async function adoptIdentity(userId: string): Promise<void> {
  await db.transaction('rw', db.results, db.dailyPlans, db.meta, async () => {
    const previous = (await db.meta.get('sync'))?.remoteUserId;
    if (previous === userId) return;
    if (previous) {
      await db.results.where('synced').equals(1).modify({ synced: 0 });
      await db.dailyPlans.toCollection().modify({ syncedCompletion: false });
    }
    await db.meta.put({ id: 'sync', remoteUserId: userId });
  });
}

async function uploadResults(remote: RemoteStore, counts: Counts): Promise<void> {
  // Read only now: an identity change may just have put already-uploaded rows back to pending.
  const pending = await db.results.where('synced').equals(0).sortBy('playedAt');
  for (let start = 0; start < pending.length; start += RESULT_BATCH_SIZE) {
    await uploadIsolating(
      pending.slice(start, start + RESULT_BATCH_SIZE),
      (rows) => remote.upsertResults(rows.map(toRemoteResult)),
      async (rows, accepted) => {
        await db.results.where('id').anyOf(rows.map((row) => row.id)).modify({ synced: accepted ? 1 : 2 });
        counts[accepted ? 'uploaded' : 'rejected'] += rows.length;
      },
    );
  }
}

async function uploadCompletions(remote: RemoteStore, counts: Counts): Promise<void> {
  const pending = await pendingCompletions();
  if (pending.length === 0) return;
  await uploadIsolating(
    pending,
    (plans) => remote.upsertCompletions(plans.map(toRemoteCompletion)),
    async (plans, accepted) => {
      // A plan has no "refused" state; marking it done keeps a refused day from being retried forever.
      await db.dailyPlans.where('day').anyOf(plans.map((plan) => plan.day)).modify({ syncedCompletion: true });
      if (!accepted) counts.rejected += plans.length;
    },
  );
}

/**
 * Uploads `batch` in one request. The server refuses a whole batch when one row is bad, so after a refusal the rows
 * are retried one by one to find the culprit. `settle` is called as soon as rows are known to be accepted or refused.
 */
async function uploadIsolating<T>(
  batch: T[],
  upload: (rows: T[]) => Promise<void>,
  settle: (rows: T[], accepted: boolean) => Promise<void>,
): Promise<void> {
  if (await accepts(upload, batch)) return settle(batch, true);
  for (const row of batch) await settle([row], await accepts(upload, [row]));
}

/** `true` if the server took the rows, `false` if it refused them for good; any other failure is thrown. */
async function accepts<T>(upload: (rows: T[]) => Promise<void>, rows: T[]): Promise<boolean> {
  try {
    await remoteCall(() => upload(rows));
    return true;
  } catch (error) {
    if (error instanceof RemoteError && error.kind === 'rejected') return false;
    throw error;
  }
}

/** A sign-out that fails (e.g. offline) still leaves the run's outcome as `error`, so its failure is ignored. */
async function signOutQuietly(remote: RemoteStore): Promise<void> {
  try {
    await remote.signOut();
  } catch {
    // Nothing to do: the next run checks the session again.
  }
}

function toRemoteResult(result: StoredResult): RemoteResult {
  return {
    id: result.id,
    game_id: result.gameId,
    level: result.level,
    score: result.score,
    accuracy: result.accuracy,
    duration_ms: result.durationMs,
    is_daily: result.isDaily,
    played_at: result.playedAt,
  };
}

function toRemoteCompletion(plan: DailyPlan): RemoteCompletion {
  return { day: plan.day, games: plan.gameIds };
}
