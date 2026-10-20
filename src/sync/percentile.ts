import { listResults } from '../data/results';
import type { RemoteStore } from './remote';

// The server ranks players on the same window of `played_at`.
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The share of active players (a whole percent) the player's best score of the last 30 days is ahead of. `null` when
 * there is nothing to show: sync is off, there is no session (this never creates an identity), no usable game in the
 * window, the server has too few players to rank, or anything failed.
 */
export async function fetchPercentile(remote: RemoteStore | null, gameId: string, now: Date): Promise<number | null> {
  if (!remote) return null;
  try {
    const since = now.getTime() - WINDOW_MS;
    // `synced === 2`: the server refused the result for good, and an impossible score would read as top of the ranking.
    const scores = (await listResults({ gameId }))
      .filter((result) => result.synced !== 2 && Date.parse(result.playedAt) >= since)
      .map((result) => result.score);
    if (scores.length === 0) return null;
    if ((await remote.currentUserId()) === null) return null;
    return await remote.percentile(gameId, Math.max(...scores));
  } catch {
    return null;
  }
}
