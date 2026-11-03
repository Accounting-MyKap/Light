import { nextStartLevel } from '../core/difficulty';
import { markDailyGameDone } from '../data/dailyPlans';
import { db, type DailyPlan, type StoredResult } from '../data/db';
import { setStartLevel } from '../data/levels';
import { addQuizAnswers } from '../data/quizAnswers';
import { addResult, bestScore } from '../data/results';
import type { GameDefinition, GameResult } from '../games/types';

export async function recordGameResult(args: {
  game: GameDefinition;
  startLevel: number;
  result: GameResult;
  /** Day of the daily plan this game belongs to, or null for free play. */
  daily: string | null;
  /** Stable id for this game's result, so retrying a failed save cannot duplicate it. */
  resultId?: string;
}): Promise<{ stored: StoredResult; previousBest: number | null; newStartLevel: number; plan: DailyPlan | null }> {
  const { game, startLevel, result, daily, resultId } = args;
  const previousBest = await bestScore(game.id);
  // One transaction: if the answers cannot be written, the result is not kept either, and a retry saves both.
  const stored = await db.transaction('rw', db.results, db.quizAnswers, async () => {
    const saved = await addResult({
      id: resultId,
      gameId: game.id,
      level: result.levelReached,
      score: result.score,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
      isDaily: daily !== null,
    });
    if (result.quiz) await addQuizAnswers(saved.id, result.quiz, new Date(saved.playedAt));
    return saved;
  });
  const newStartLevel = nextStartLevel(startLevel, result.accuracy);
  await setStartLevel(game.id, newStartLevel);
  const plan = daily === null ? null : await markDailyGameDone(daily, game.id);
  return { stored, previousBest, newStartLevel, plan };
}
