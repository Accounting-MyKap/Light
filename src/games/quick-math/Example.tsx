import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import styles from './quick-math.module.css';

/** How long each step of the demo stays on screen: empty slot, first digit, whole answer, answer confirmed. */
export const DEMO_STEP_MS = 700;

const PROBLEM = '7 + 5';
const ANSWER = '12';
/** What the slot shows at each step of the loop. */
const TYPED = ['', '1', ANSWER, ANSWER];
const CONFIRMED_STEP = TYPED.length - 1;

export function QuickMathExample() {
  // The answer is typed into the slot digit by digit, flashes once it is right, and starts over. With reduced
  // motion (or when the browser cannot tell) nothing moves: the finished answer stays.
  const [animated] = useState(() => !prefersReducedMotion());
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!animated) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % TYPED.length), DEMO_STEP_MS);
    return () => window.clearInterval(timer);
  }, [animated]);

  const typed = animated ? TYPED[step] : ANSWER;
  return (
    <div className={`${styles.operation} ${styles.demo}`}>
      <span className={styles.problem}>{PROBLEM}</span>
      <span className={styles.equals}>
        <span className={styles.sign} aria-hidden="true">
          =
        </span>
        <span
          className={styles.answer}
          data-empty={typed === ''}
          data-confirmed={animated && step === CONFIRMED_STEP}
        >
          {typed || '?'}
        </span>
      </span>
    </div>
  );
}
