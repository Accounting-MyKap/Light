import { useEffect, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { useFeedbackSignal, type FeedbackSignal } from './feedback';
import styles from './reaction.module.css';

const SHAKE_MS = 350;
const SHAKE_KEYFRAMES = [0, -12, 12, -8, 8, 0].map((x) => ({
  transform: `translateX(${x}px)`,
}));

/**
 * The reaction to the latest answer, for the frame to draw. A signal that was already there when the frame
 * mounted belongs to a previous game on the same screen, so it is not returned. A wrong answer also shakes the
 * given element, unless the person asked for reduced motion.
 */
export function useReactionSignal(stageRef: RefObject<HTMLElement | null>): FeedbackSignal | null {
  const latestSignal = useFeedbackSignal();
  const [staleSignalId] = useState(() => latestSignal?.id ?? null);
  const signal = latestSignal && latestSignal.id !== staleSignalId ? latestSignal : null;

  useEffect(() => {
    const stage = stageRef.current;
    if (signal?.kind !== 'wrong' || !stage || typeof stage.animate !== 'function' || prefersReducedMotion()) return;
    stage.animate(SHAKE_KEYFRAMES, { duration: SHAKE_MS, easing: 'ease-out' });
  }, [signal, stageRef]);

  return signal;
}

/** The flash over the game zone. Its element is keyed by the signal, so every answer starts the animation over. */
export function Flash({ signal }: { signal: FeedbackSignal | null }) {
  if (!signal) return null;
  return <span key={signal.id} className={styles.flash} data-flash={signal.kind} aria-hidden="true" />;
}
