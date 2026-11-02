import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';

/** Starts fast and slows down as it lands: cubic ease-out. */
function easeOut(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * The number to show while `target` counts up from 0 over `durationMs`, slowing down as it arrives. With reduced
 * motion (or when the browser cannot tell) there is no counting: it is `target` from the first render.
 */
export function useCountUp(target: number, durationMs = 1200): number {
  const [animated] = useState(() => !prefersReducedMotion());
  // The count is tied to its target, so a new target starts again from 0 instead of showing the old count.
  const [count, setCount] = useState({ target, value: 0 });

  useEffect(() => {
    if (!animated) return;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - start) / durationMs);
      setCount({ target, value: Math.round(target * easeOut(progress)) });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animated, target, durationMs]);

  if (!animated) return target;
  return count.target === target ? count.value : 0;
}
