export function speedBonus(rtMs: number, windowMs: number): number {
  return Math.min(10, Math.max(0, Math.round(10 * (1 - rtMs / windowMs))));
}

/** Adds points (negative for a deduction) without ever going below 0. */
export function addPoints(score: number, points: number): number {
  return Math.max(0, score + points);
}

export function accuracyOf(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total;
}
