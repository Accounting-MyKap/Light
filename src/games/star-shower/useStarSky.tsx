import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import {
  starHeight,
  submitAnswer,
  type Outcome,
  type Star,
  type StarShowerEvent,
  type StarShowerState,
} from './engine';
import { railAt, type Burst, type SkyFlash, type SkyProps } from './Sky';

/*
 * The moving sky shared by the game and its practice: a requestAnimationFrame loop advances the engine to a clock and
 * moves the stars, and the sky draws what happens to them: a burst for every popped or cleared star, the gold flash
 * of a comet, the red one of a lost star, and the shake of a wrong number.
 */

/** How long a burst or a flash stays drawn (real time: they are only visual). */
const EFFECT_MS = 600;

/** The time the sky is drawn at: once the game is over, everything stays where it was at the end. */
export const drawTime = (state: StarShowerState, now: number) =>
  state.endedAt === null ? now : Math.min(now, state.endedAt);

export type LostEvent = Extract<StarShowerEvent, { kind: 'lost' }>;

export interface StarSkyOptions {
  /** The loop runs only while active. */
  active: boolean;
  /** The time the sky is advanced to and drawn at. */
  now: () => number;
  /**
   * Moves the sky to `to`, returning the same state when nothing was due: the game runs the engine as it is, the
   * practice brings in its own stars around it.
   */
  advance: (state: StarShowerState, to: number) => { state: StarShowerState; events: StarShowerEvent[] };
  /** Called for each star that reaches the horizon, as the sky starts drawing its loss. */
  onLost?: (event: LostEvent) => void;
  /** Called at the end of every frame with the state it drew. False stops the loop for good. */
  onFrame?: (state: StarShowerState, now: number) => boolean;
}

export interface StarSky {
  /** The state of the latest render. */
  game: StarShowerState;
  /** The latest state, for actions that run between renders. */
  current: () => StarShowerState;
  /** Sets the state (a typed digit, a new round). Stable. */
  commit: (state: StarShowerState) => void;
  /**
   * Moves the sky to now (a star that reached the horizon by then is lost and cannot be answered) and answers the
   * typed number: the popped stars burst, a comet flashes and a wrong number shakes the slot. Null when there was
   * nothing to answer.
   */
  submit: () => Outcome | null;
  /** What the Sky draws, at the current time. */
  sky: SkyProps;
}

export function useStarSky(initial: () => StarShowerState, options: StarSkyOptions): StarSky {
  const [game, setGame] = useState(initial);
  // The latest state, for the animation loop and the actions: a frame may move the game on before React renders.
  const gameRef = useRef(game);
  const stoppedRef = useRef(false);

  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flash, setFlash] = useState<SkyFlash | null>(null);
  const [wrongKey, setWrongKey] = useState(0);
  const effectKey = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  // The element that carries each live star down (its rail), by star id: what the animation loop moves.
  const rails = useRef(new Map<number, HTMLElement>());
  const registerStar = useCallback((id: number, el: HTMLElement | null) => {
    if (el) rails.current.set(id, el);
    else rails.current.delete(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const commit = useCallback((state: StarShowerState) => {
    gameRef.current = state;
    setGame(state);
  }, []);

  const current = useCallback(() => gameRef.current, []);

  const later = (done: () => void) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      done();
    }, EFFECT_MS);
    timers.current.add(id);
  };

  const showBursts = (stars: readonly Star[], at: number, kind: Burst['kind']) => {
    if (stars.length === 0) return;
    const added = stars.map((star) => ({ key: ++effectKey.current, star, height: starHeight(star, at), kind }));
    setBursts((list) => [...list, ...added]);
    later(() => setBursts((list) => list.filter((burst) => !added.includes(burst))));
  };

  // A flash is a burst of light, so it is left out entirely with reduced motion (spec §4.3).
  const showFlash = (kind: SkyFlash['kind'], lane?: number) => {
    if (prefersReducedMotion()) return;
    const next: SkyFlash = { key: ++effectKey.current, kind, lane };
    setFlash(next);
    later(() => setFlash((shown) => (shown === next ? null : shown)));
  };

  const react = (events: readonly StarShowerEvent[]) => {
    for (const event of events) {
      if (event.kind !== 'lost') continue;
      options.onLost?.(event);
      showFlash('loss', event.star.lane);
      // The lost star fades on the horizon (height 1), the others where they were: a cue even with no flash.
      showBursts([event.star, ...event.cleared], event.star.bornAt + event.star.fallMs, 'clear');
    }
  };

  /** One animation frame. Returns whether the loop goes on. */
  const frame = useEffectEvent(() => {
    const now = options.now();
    const { state, events } = options.advance(gameRef.current, now);
    if (state !== gameRef.current) {
      commit(state);
      react(events);
    }
    // Only a transform changes each frame, so the browser moves the stars without laying out the page again.
    const at = drawTime(state, now);
    for (const star of state.stars) {
      const rail = rails.current.get(star.id);
      if (rail) rail.style.transform = railAt(starHeight(star, at));
    }
    return options.onFrame?.(state, now) ?? true;
  });

  // The animation loop: it stops while inactive (a paused game's clock is frozen then) and for good once a frame
  // says so (the game's result is out).
  const { active } = options;
  useEffect(() => {
    if (!active || stoppedRef.current) return;
    let id = requestAnimationFrame(function loop() {
      if (frame()) id = requestAnimationFrame(loop);
      else stoppedRef.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  const submit = () => {
    // The engine moves on first, so a star that reached the horizon by now is lost and cannot be answered.
    const now = options.now();
    const moved = options.advance(gameRef.current, now);
    const { state, outcome } = submitAnswer(moved.state);
    if (state !== gameRef.current) commit(state);
    react(moved.events);
    if (outcome === null) return null;
    if (outcome.kind === 'wrong') {
      setWrongKey((k) => k + 1);
      return outcome;
    }
    showBursts(outcome.popped, now, 'pop');
    if (outcome.kind === 'comet') showFlash('comet');
    return outcome;
  };

  return {
    game,
    current,
    commit,
    submit,
    sky: {
      stars: game.stars,
      // The sky is drawn at the current time, not at the time of the change that caused this render (it may come a
      // frame later), so a render never puts a star back above where the loop already moved it.
      now: drawTime(game, options.now()),
      bursts,
      flash,
      input: game.input,
      wrongKey,
      registerStar,
    },
  };
}
