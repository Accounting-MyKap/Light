import { nextStartLevel } from '../core/difficulty';
import { markDailyGameDone } from '../data/dailyPlans';
import type { DailyPlan, StoredResult } from '../data/db';
import { setStartLevel } from '../data/levels';
import { addResult, bestScore } from '../data/results';
import type { GameDefinition, GameResult } from '../games/types';

export async function recordGameResult(args: {
  game: GameDefinition;
  startLevel: number;
  result: GameResult;
  /** Day of the daily plan this game belongs to, or null for free play. */
  daily: string | null;
}): Promise<{ stored: StoredResult; previousBest: number | null; newStartLevel: number; plan: DailyPlan | null }> {
  const { game, startLevel, result, daily } = args;
  const previousBest = await bestScore(game.id);
  const stored = await addResult({
    gameId: game.id,
    level: result.levelReached,
    score: result.score,
    accuracy: result.accuracy,
    durationMs: result.durationMs,
    isDaily: daily !== null,
  });
  const newStartLevel = nextStartLevel(startLevel, result.accuracy);
  await setStartLevel(game.id, newStartLevel);
  const plan = daily === null ? null : await markDailyGameDone(daily, game.id);
  return { stored, previousBest, newStartLevel, plan };
}
