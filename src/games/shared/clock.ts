import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface GameClock {
  /** Active milliseconds since the game started, excluding paused time. */
  now(): number;
}

interface ClockState {
  accumulated: number;
  segmentStart: number;
  paused: boolean;
  started: boolean;
}

export function useGameClock(paused: boolean): GameClock {
  const state = useRef<ClockState>({ accumulated: 0, segmentStart: 0, paused: true, started: false });

  useLayoutEffect(() => {
    const s = state.current;
    const at = Date.now();
    if (!s.started) {
      s.started = true;
      s.segmentStart = at;
      s.paused = paused;
      return;
    }
    if (paused && !s.paused) {
      s.accumulated += at - s.segmentStart;
      s.paused = true;
    } else if (!paused && s.paused) {
      s.segmentStart = at;
      s.paused = false;
    }
  }, [paused]);

  return useMemo(
    () => ({
      now() {
        const s = state.current;
        if (!s.started) return 0;
        return s.paused ? s.accumulated : s.accumulated + (Date.now() - s.segmentStart);
      },
    }),
    [],
  );
}

const TICK_MS = 100;

export function useCountdown(clock: GameClock, durationMs: number, paused: boolean, onDone: () => void): number {
  const [remaining, setRemaining] = useState(durationMs);
  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (paused || doneRef.current) return;
    const id = setInterval(() => {
      const left = Math.max(0, durationMs - clock.now());
      setRemaining(left);
      if (left === 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        onDoneRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [clock, durationMs, paused]);

  return remaining;
}

export function useTrialTimeout(
  clock: GameClock,
  trialStartedAt: number,
  windowMs: number | null,
  paused: boolean,
  onTimeout: () => void,
): void {
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (paused || windowMs === null) return;
    const left = Math.max(0, windowMs - (clock.now() - trialStartedAt));
    const id = setTimeout(() => onTimeoutRef.current(), left);
    return () => clearTimeout(id);
  }, [clock, trialStartedAt, windowMs, paused]);
}
