export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

/** Between games: accuracy ≥ 85 % moves up a level, < 60 % moves down. */
export function nextStartLevel(startLevel: number, accuracy: number): number {
  if (accuracy >= 0.85) return clampLevel(startLevel + 1);
  if (accuracy < 0.6) return clampLevel(startLevel - 1);
  return clampLevel(startLevel);
}

export interface Staircase {
  level: number;
  maxLevel: number;
  correctStreak: number;
  wrongStreak: number;
}

export function createStaircase(startLevel: number): Staircase {
  const level = clampLevel(startLevel);
  return { level, maxLevel: level, correctStreak: 0, wrongStreak: 0 };
}

/** Within a game: 4 correct in a row moves up, 2 wrong in a row moves down. */
export function stepStaircase(s: Staircase, correct: boolean): Staircase {
  const correctStreak = correct ? s.correctStreak + 1 : 0;
  const wrongStreak = correct ? 0 : s.wrongStreak + 1;
  let level = s.level;
  if (correctStreak >= 4) level = clampLevel(level + 1);
  else if (wrongStreak >= 2) level = clampLevel(level - 1);
  if (level !== s.level || correctStreak >= 4 || wrongStreak >= 2) {
    return { level, maxLevel: Math.max(s.maxLevel, level), correctStreak: 0, wrongStreak: 0 };
  }
  return { level, maxLevel: s.maxLevel, correctStreak, wrongStreak };
}
