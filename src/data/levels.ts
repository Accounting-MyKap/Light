import { clampLevel, MIN_LEVEL } from '../core/difficulty';
import { db } from './db';

export async function getStartLevel(gameId: string): Promise<number> {
  return (await db.gameLevels.get(gameId))?.startLevel ?? MIN_LEVEL;
}

export async function setStartLevel(gameId: string, level: number): Promise<void> {
  await db.gameLevels.put({ gameId, startLevel: clampLevel(level) });
}
