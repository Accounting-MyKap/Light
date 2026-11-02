import { useEffect, useRef, useState } from 'react';
import { RESUME_STEP_MS } from './resumeTiming';
import styles from './Play.module.css';

const FIRST_NUMBER = 3;

/**
 * 3, 2, 1 over the paused game, one `RESUME_STEP_MS` each, then `onDone`. It is decorative: it adds no text
 * for screen readers, which get the focus back on the game when it ends.
 */
export function ResumeCountdown({ onDone }: { onDone: () => void }) {
  const [number, setNumber] = useState(FIRST_NUMBER);

  // The latest callback, so a new function from the parent never restarts the step being counted.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (number > 1) setNumber(number - 1);
      else done.current();
    }, RESUME_STEP_MS);
    return () => clearTimeout(timer);
  }, [number]);

  return (
    <div className={styles.countdown} aria-hidden="true">
      <span key={number} className={styles.countdownNumber} style={{ animationDuration: `${RESUME_STEP_MS}ms` }}>
        {number}
      </span>
    </div>
  );
}
