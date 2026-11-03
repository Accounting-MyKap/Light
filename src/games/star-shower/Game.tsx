import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { createRng, randomSeed } from '../../core/rng';
import { useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { Keypad } from '../shared/Keypad';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import {
  advance,
  createStarShower,
  deleteDigit,
  LIVES,
  starHeight,
  starShowerResult,
  submitAnswer,
  typeDigit,
  type Star,
  type StarShowerEvent,
  type StarShowerState,
} from './engine';
import { Sky, topOf, type Burst, type SkyFlash } from './Sky';

/** Game time the sky stays still after the end, before the result. */
export const END_HOLD_MS = 1000;

/** How long a burst or a flash stays drawn (real time: they are only visual). */
const EFFECT_MS = 600;

/** The time the sky is drawn at: once the game is over, everything stays where it was at the end. */
const drawTime = (state: StarShowerState, now: number) => (state.endedAt === null ? now : Math.min(now, state.endedAt));

export function StarShowerGame({ startLevel, paused, onFinish }: GameProps) {
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createStarShower(startLevel, rng));
  // The latest state, for the animation loop and the actions: a frame may move the game on before React renders.
  const gameRef = useRef(game);
  const finishedRef = useRef(false);

  const [bursts, setBursts] = useState<Burst[]>([]);
  const [flash, setFlash] = useState<SkyFlash | null>(null);
  const [wrongKey, setWrongKey] = useState(0);
  const effectKey = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const starEls = useRef(new Map<number, HTMLElement>());
  const registerStar = useCallback((id: number, el: HTMLElement | null) => {
    if (el) starEls.current.set(id, el);
    else starEls.current.delete(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const commit = (state: StarShowerState) => {
    gameRef.current = state;
    setGame(state);
  };

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
    later(() => setFlash((current) => (current === next ? null : current)));
  };

  const react = (events: readonly StarShowerEvent[]) => {
    for (const event of events) {
      if (event.kind !== 'lost') continue;
      feedback('timeout');
      showFlash('loss', event.star.lane);
      // The lost star fades on the horizon (height 1), the others where they were: a cue even with no flash.
      showBursts([event.star, ...event.cleared], event.star.bornAt + event.star.fallMs, 'clear');
    }
  };

  /** One animation frame. Returns whether the loop goes on. */
  const frame = useEffectEvent(() => {
    const now = clock.now();
    const { state, events } = advance(gameRef.current, now, rng);
    if (state !== gameRef.current) {
      commit(state);
      react(events);
    }
    const at = drawTime(state, now);
    for (const star of state.stars) {
      const el = starEls.current.get(star.id);
      if (el) el.style.top = topOf(starHeight(star, at));
    }
    if (state.endedAt !== null && now >= state.endedAt + END_HOLD_MS) {
      finishedRef.current = true;
      onFinish(starShowerResult(state));
      return false;
    }
    return true;
  });

  // The animation loop: it stops while paused (the game clock is frozen then) and for good once the result is out.
  useEffect(() => {
    if (paused || finishedRef.current) return;
    let id = requestAnimationFrame(function loop() {
      if (frame()) id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [paused]);

  const playing = () => !paused && gameRef.current.endedAt === null;

  // Each action returns whether it was used, so unused keys keep their browser behavior.
  const actions = {
    digit: (d: number) => {
      if (!playing()) return false;
      commit(typeDigit(gameRef.current, d));
      return true;
    },
    remove: () => {
      if (!playing()) return false;
      commit(deleteDigit(gameRef.current));
      return true;
    },
    submit: () => {
      if (!playing()) return false;
      // The engine moves on first, so a star that reached the horizon by now is lost and cannot be answered.
      const now = clock.now();
      const moved = advance(gameRef.current, now, rng);
      const { state, outcome } = submitAnswer(moved.state);
      if (state !== gameRef.current) commit(state);
      react(moved.events);
      if (outcome === null) return false;
      if (outcome.kind === 'wrong') {
        feedback('wrong');
        setWrongKey((k) => k + 1);
        return true;
      }
      feedback('correct');
      showBursts(outcome.popped, now, 'pop');
      if (outcome.kind === 'comet') showFlash('comet');
      return true;
    },
  };

  useGameKeys((key) => {
    if (/^[0-9]$/.test(key)) return actions.digit(Number(key));
    if (key === 'Backspace') return actions.remove();
    if (key === 'Enter') return actions.submit();
    return false;
  });

  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      lives={{ left: game.lives, total: LIVES }}
      controls={<Keypad onDigit={actions.digit} onDelete={actions.remove} onSubmit={actions.submit} />}
    >
      {/* The sky is drawn at the current game time, not at the time of the change that caused this render (it
          may come a frame later), so a render never puts a star back above where the loop already moved it. */}
      <Sky
        stars={game.stars}
        now={drawTime(game, clock.now())}
        bursts={bursts}
        flash={flash}
        input={game.input}
        wrongKey={wrongKey}
        registerStar={registerStar}
      />
    </GameFrame>
  );
}
