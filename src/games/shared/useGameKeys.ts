import { useEffect, useRef } from 'react';

const NATIVE_ACTIVATION_KEYS = new Set(['Enter', ' ']);
const INTERACTIVE = 'button, a, input, select, textarea';

/**
 * Window-level game keys. Auto-repeat is ignored, Enter/Space on a focused control is left to that
 * control, and the browser default is only prevented when the handler used the key (returns true).
 */
export function useGameKeys(onKey: (key: string) => boolean): void {
  const onKeyRef = useRef(onKey);
  useEffect(() => {
    onKeyRef.current = onKey;
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (NATIVE_ACTIVATION_KEYS.has(e.key) && e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      if (onKeyRef.current(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
