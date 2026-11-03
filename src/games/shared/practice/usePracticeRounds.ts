import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedback } from '../feedback';

/** The pause after a right answer, before the next round. */
export const PRACTICE_NEXT_MS = 700;

export type PracticeStatus = 'asking' | 'right' | 'wrong';

/**
 * The round flow shared by every practice: a right answer pauses, then moves to the next round (or completes after
 * the last one); a wrong answer leaves the round open to try again. No clock, no points.
 */
export function usePracticeRounds(total: number, onComplete: () => void) {
  const feedback = useFeedback();
  const [round, setRound] = useState(0);
  const [status, setStatus] = useState<PracticeStatus>('asking');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The latest callback, so a pending timer never calls a stale one.
  const complete = useRef(onComplete);
  useEffect(() => {
    complete.current = onComplete;
  });

  // Set synchronously on a right answer, so a second answer in the same batch (before any re-render) is ignored.
  const busy = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = useCallback(
    (correct: boolean) => {
      if (busy.current) return;
      feedback(correct ? 'correct' : 'wrong');
      if (!correct) {
        setStatus('wrong');
        return;
      }
      busy.current = true;
      setStatus('right');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (round + 1 >= total) {
          complete.current();
        } else {
          setRound(round + 1);
          setStatus('asking');
          busy.current = false;
        }
      }, PRACTICE_NEXT_MS);
    },
    [feedback, round, total],
  );

  return { round, status, answer };
}
