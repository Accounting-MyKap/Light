import { localDay } from '../core/dates';
import { db, type StoredResult } from './db';

export interface NewResult {
  gameId: string;
  level: number;
  score: number;
  accuracy: number;
  durationMs: number;
  isDaily: boolean;
  playedAt?: Date;
}

export async function addResult(input: NewResult): Promise<StoredResult> {
  const playedAt = input.playedAt ?? new Date();
  const stored: StoredResult = {
    id: crypto.randomUUID(),
    gameId: input.gameId,
    level: input.level,
    score: input.score,
    accuracy: input.accuracy,
    durationMs: input.durationMs,
    isDaily: input.isDaily,
    playedAt: playedAt.toISOString(),
    day: localDay(playedAt),
    synced: 0,
  };
  await db.results.add(stored);
  return stored;
}

export async function listResults(filter: { gameId?: string; sinceDay?: string } = {}): Promise<StoredResult[]> {
  const collection = filter.gameId
    ? db.results.where('gameId').equals(filter.gameId)
    : filter.sinceDay
      ? db.results.where('day').aboveOrEqual(filter.sinceDay)
      : db.results.toCollection();
  const rows = await collection.toArray();
  return rows
    .filter((r) => !filter.sinceDay || r.day >= filter.sinceDay)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

export async function bestScore(gameId: string): Promise<number | null> {
  const rows = await db.results.where('gameId').equals(gameId).toArray();
  return rows.length === 0 ? null : Math.max(...rows.map((r) => r.score));
}
