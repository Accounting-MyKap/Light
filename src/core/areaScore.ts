import type { Area } from '../games/types';

const WINDOW_MS = 30 * 86_400_000;

export function gameAreaScore(best: number, referenceScore: number): number {
  return Math.min(1000, Math.round((1000 * best) / referenceScore));
}

/** Best score of the last 30 days per game, scaled to 0–1000, averaged per area. Areas without data are absent. */
export function areaScores(
  results: readonly { gameId: string; score: number; playedAt: string }[],
  games: readonly { id: string; area: Area; referenceScore: number }[],
  now: Date,
): Partial<Record<Area, number>> {
  const cutoff = now.getTime() - WINDOW_MS;
  const best = new Map<string, number>();
  for (const r of results) {
    if (new Date(r.playedAt).getTime() < cutoff) continue;
    best.set(r.gameId, Math.max(best.get(r.gameId) ?? 0, r.score));
  }
  const perArea = new Map<Area, number[]>();
  for (const g of games) {
    const b = best.get(g.id);
    if (b === undefined) continue;
    perArea.set(g.area, [...(perArea.get(g.area) ?? []), gameAreaScore(b, g.referenceScore)]);
  }
  const out: Partial<Record<Area, number>> = {};
  for (const [area, scores] of perArea) {
    out[area] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return out;
}
