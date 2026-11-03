import { useEffect, useState } from 'react';
import type { GameClock } from '../shared/clock';

const TICK_MS = 100;

/**
 * Milliseconds left for the current question, refreshed every 100 ms while it counts down.
 * `windowMs === null` means the question has been answered: the clock stops and keeps its last value.
 * A pause stops it too, and the game clock does not count paused time, so it resumes where it left off.
 */
export function useQuestionTimer(
  clock: GameClock,
  askedAt: number,
  windowMs: number | null,
  paused: boolean,
): number {
  const [shown, setShown] = useState({ askedAt, remaining: windowMs ?? 0 });

  // A new question starts from the full window. Adjusting during render avoids a frame with the old value.
  let current = shown;
  if (shown.askedAt !== askedAt) {
    current = { askedAt, remaining: windowMs ?? 0 };
    setShown(current);
  }

  useEffect(() => {
    if (paused || windowMs === null) return;
    const id = setInterval(() => {
      setShown({ askedAt, remaining: Math.max(0, windowMs - (clock.now() - askedAt)) });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [clock, askedAt, windowMs, paused]);

  return current.remaining;
}
