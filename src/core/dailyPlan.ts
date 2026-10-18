import type { Area } from '../games/types';
import { addDays } from './dates';
import { createRng, seedFromString } from './rng';

export const DAILY_GAME_COUNT = 3;

export interface DailyPlanInput {
  day: string;
  games: readonly { id: string; area: Area }[];
  recentPlays: readonly { gameId: string; day: string }[];
  yesterdayPlan: readonly string[] | null;
}

/**
 * Picks up to 3 games from distinct areas. Areas whose games were all in yesterday's plan go last;
 * then the least-played areas in the last 7 days come first. Deterministic for a given day.
 */
export function generateDailyPlan({ day, games, recentPlays, yesterdayPlan }: DailyPlanInput): string[] {
  const rng = createRng(seedFromString(day));
  const from = addDays(day, -6);
  const yesterday = new Set(yesterdayPlan ?? []);

  const gamePlays = new Map<string, number>();
  for (const play of recentPlays) {
    if (play.day >= from && play.day <= day) gamePlays.set(play.gameId, (gamePlays.get(play.gameId) ?? 0) + 1);
  }

  const gameTiebreak = new Map(games.map((g) => [g.id, rng()] as const));
  const areas = [...new Set(games.map((g) => g.area))].map((area) => {
    const areaGames = games.filter((g) => g.area === area);
    return {
      area,
      games: areaGames,
      allYesterday: areaGames.every((g) => yesterday.has(g.id)) ? 1 : 0,
      plays: areaGames.reduce((sum, g) => sum + (gamePlays.get(g.id) ?? 0), 0),
      tiebreak: rng(),
    };
  });

  areas.sort((x, y) => x.allYesterday - y.allYesterday || x.plays - y.plays || x.tiebreak - y.tiebreak);

  return areas.slice(0, DAILY_GAME_COUNT).map(({ games: areaGames }) => {
    const notYesterday = areaGames.filter((g) => !yesterday.has(g.id));
    const candidates = notYesterday.length > 0 ? notYesterday : areaGames;
    const sorted = [...candidates].sort(
      (x, y) =>
        (gamePlays.get(x.id) ?? 0) - (gamePlays.get(y.id) ?? 0) || gameTiebreak.get(x.id)! - gameTiebreak.get(y.id)!,
    );
    return sorted[0].id;
  });
}
