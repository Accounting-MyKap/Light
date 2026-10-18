import { nextStartLevel } from '../core/difficulty';
import type { StoredResult } from '../data/db';
import { setStartLevel } from '../data/levels';
import { addResult, bestScore } from '../data/results';
import type { GameDefinition, GameResult } from '../games/types';

export async function recordGameResult(args: {
  game: GameDefinition;
  startLevel: number;
  result: GameResult;
  daily: string | null;
}): Promise<{ stored: StoredResult; previousBest: number | null; newStartLevel: number }> {
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
  return { stored, previousBest, newStartLevel };
}
