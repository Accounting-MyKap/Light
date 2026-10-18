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
  synced: 0 | 1;
}

export interface DailyPlan {
  day: string;
  gameIds: string[];
  completed: string[];
}

export interface GameLevel {
  gameId: string;
  startLevel: number;
}

export type StoredSettings = { id: 'settings' } & Settings;

export const db = new Dexie('light') as Dexie & {
  results: EntityTable<StoredResult, 'id'>;
  dailyPlans: EntityTable<DailyPlan, 'day'>;
  gameLevels: EntityTable<GameLevel, 'gameId'>;
  settings: EntityTable<StoredSettings, 'id'>;
};

db.version(1).stores({
  results: 'id, gameId, day, playedAt, synced',
  dailyPlans: 'day',
  gameLevels: 'gameId',
  settings: 'id',
});

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
