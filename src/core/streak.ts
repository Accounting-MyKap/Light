import { addDays, daysBetween } from './dates';

/** Consecutive days with a completed daily training; today pending does not break the streak. */
export function computeStreak(completedDays: readonly string[], today: string): { current: number; best: number } {
  const days = [...new Set(completedDays)].sort();
  const set = new Set(days);

  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  days.forEach((day, i) => {
    run = i > 0 && daysBetween(days[i - 1], day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });

  return { current, best: Math.max(best, current) };
}
