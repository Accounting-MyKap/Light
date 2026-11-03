import Dexie, { type EntityTable, type Table } from 'dexie';
import type { AnswerOutcome, QuizCategory } from '../quiz/types';
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

/** One answered question of a saved quiz round. Local only: it never reaches the server. */
export interface QuizAnswer {
  /** Id of the saved result (round) this answer belongs to. */
  resultId: string;
  questionId: string;
  category: QuizCategory;
  outcome: AnswerOutcome;
  /** ISO timestamp; every answer of a round shares the time the round was saved. */
  answeredAt: string;
}

export type StoredSettings = { id: 'settings' } & Settings;

export const db = new Dexie('light') as Dexie & {
  results: EntityTable<StoredResult, 'id'>;
  dailyPlans: EntityTable<DailyPlan, 'day'>;
  gameLevels: EntityTable<GameLevel, 'gameId'>;
  settings: EntityTable<StoredSettings, 'id'>;
  meta: EntityTable<SyncMeta, 'id'>;
  quizAnswers: Table<QuizAnswer, [string, string]>;
};

db.version(1).stores({
  results: 'id, gameId, day, playedAt, synced',
  dailyPlans: 'day',
  gameLevels: 'gameId',
  settings: 'id',
});

// v2 only adds the sync bookkeeping table; the new optional fields need no upgrade step.
db.version(2).stores({ meta: 'id' });

// v3 only adds the local quiz answer history (never synced); no upgrade step either.
db.version(3).stores({ quizAnswers: '[resultId+questionId], questionId, category, answeredAt' });

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
