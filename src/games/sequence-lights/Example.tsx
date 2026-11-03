import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { Board } from './Board';

/** How long each step of the demo stays on screen: the three cells light one after another, then a rest. */
export const DEMO_STEP_MS = 700;

/** The cells of the demo, in the order they light (the diagonal of a 3 x 3 board). */
const PATH = [0, 4, 8];
const MARKS = { 0: '1', 4: '2', 8: '3' };
/** Every step lights one cell of the path; the last one rests, so the loop has a visible start. */
const STEPS = PATH.length + 1;

export function SequenceLightsExample() {
  // The cells light in order and the loop starts over. With reduced motion (or when the browser cannot tell)
  // nothing moves: the whole path stays lit, and the numbers on it say the order.
  const [animated] = useState(() => !prefersReducedMotion());
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!animated) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS), DEMO_STEP_MS);
    return () => window.clearInterval(timer);
  }, [animated]);

  const lit = animated ? (step < PATH.length ? [PATH[step]] : []) : PATH;
  return <Board size={3} lit={new Set(lit)} marks={MARKS} small />;
}
