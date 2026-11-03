import { nextStartLevel } from '../core/difficulty';
import { markDailyGameDone } from '../data/dailyPlans';
import type { DailyPlan, StoredResult } from '../data/db';
import { setStartLevel } from '../data/levels';
import { addResult, bestScore } from '../data/results';
import type { GameDefinition, GameResult } from '../games/types';

export async function recordGameResult(args: {
  game: GameDefinition;
  /** The level the game was played at. */
  startLevel: number;
  /**
   * The level the app suggested. A game played at another level (chosen to practice) keeps it as it is; only a game
   * at the suggested level moves it up or down. Left out, the played level counts as the suggested one.
   */
  suggestedLevel?: number;
  result: GameResult;
  /** Day of the daily plan this game belongs to, or null for free play. */
  daily: string | null;
  /** Stable id for this game's result, so retrying a failed save cannot duplicate it. */
  resultId?: string;
}): Promise<{ stored: StoredResult; previousBest: number | null; newStartLevel: number; plan: DailyPlan | null }> {
  const { game, startLevel, suggestedLevel = startLevel, result, daily, resultId } = args;
  const previousBest = await bestScore(game.id);
  const stored = await addResult({
    id: resultId,
    gameId: game.id,
    level: result.levelReached,
    score: result.score,
    accuracy: result.accuracy,
    durationMs: result.durationMs,
    isDaily: daily !== null,
  });
  const practice = startLevel !== suggestedLevel;
  const newStartLevel = practice ? suggestedLevel : nextStartLevel(startLevel, result.accuracy);
  if (!practice) await setStartLevel(game.id, newStartLevel);
  const plan = daily === null ? null : await markDailyGameDone(daily, game.id);
  return { stored, previousBest, newStartLevel, plan };
}
