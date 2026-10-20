import Dexie, { type EntityTable } from 'dexie';
import type { Settings } from './settings';

export interface StoredResult {
  id: string;
  gameId: string;
  level: number;
  score: number;
  accuracy: number;
  durationMs: number;
  isDaily: boolean;
  /** ISO timestamp */
  playedAt: string;
  /** Local calendar day 'YYYY-MM-DD' */
  day: string;
  /** 0 = waiting to upload, 1 = uploaded, 2 = refused by the server for good (never retried) */
  synced: 0 | 1 | 2;
}

export interface DailyPlan {
  day: string;
  gameIds: string[];
  completed: string[];
  /** True once the server has this completed day, or has refused it for good. */
  syncedCompletion?: boolean;
}

export interface GameLevel {
  gameId: string;
  startLevel: number;
}

export interface SyncMeta {
  id: 'sync';
  /** Server identity the synced marks refer to; `null` until the first upload. */
  remoteUserId: string | null;
}

export type StoredSettings = { id: 'settings' } & Settings;

export const db = new Dexie('light') as Dexie & {
  results: EntityTable<StoredResult, 'id'>;
  dailyPlans: EntityTable<DailyPlan, 'day'>;
  gameLevels: EntityTable<GameLevel, 'gameId'>;
  settings: EntityTable<StoredSettings, 'id'>;
  meta: EntityTable<SyncMeta, 'id'>;
};

db.version(1).stores({
  results: 'id, gameId, day, playedAt, synced',
  dailyPlans: 'day',
  gameLevels: 'gameId',
  settings: 'id',
});

// v2 only adds the sync bookkeeping table; the new optional fields need no upgrade step.
db.version(2).stores({ meta: 'id' });

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
