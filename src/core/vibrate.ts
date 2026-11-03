type Pattern = number | number[];

/** Pattern in milliseconds for each answer feedback: a short tap for a hit, a double pulse for a miss or a timeout. */
export const VIBRATION: Record<'correct' | 'wrong' | 'timeout', Pattern> = {
  correct: 12,
  wrong: [30, 50, 30],
  timeout: [30, 50, 30],
};

/** Vibrates where the browser allows it (not on iPhone); never throws, vibration is optional. */
export function vibrate(pattern: Pattern): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Vibration is optional; never let it break a game.
  }
}
