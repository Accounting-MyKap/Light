import { useState } from 'react';
import { createRng, randomSeed } from '../../core/rng';
import { useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { Keypad } from '../shared/Keypad';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { advance, createStarShower, deleteDigit, LIVES, starShowerResult, typeDigit } from './engine';
import { Sky } from './Sky';
import { useStarSky } from './useStarSky';
import styles from './star-shower.module.css';

/** Game time the sky stays still after the end, before the result. */
export const END_HOLD_MS = 1000;

/**
 * Lluvia de estrellas: stars with an operation fall toward the horizon and the person pops them by typing the answer.
 * The shared sky advances the engine to the game clock, so the pause freezes the stars.
 */
export function StarShowerGame({ startLevel, paused, onFinish }: GameProps) {
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));

  const { game, current, commit, submit, sky } = useStarSky(() => createStarShower(startLevel, rng), {
    active: !paused,
    now: () => clock.now(),
    advance: (state, to) => advance(state, to, rng),
    onLost: () => feedback('timeout'),
    // Once the game is over the sky stays still for a moment; then the result is out and the loop stops for good.
    onFrame: (state, now) => {
      if (state.endedAt === null || now < state.endedAt + END_HOLD_MS) return true;
      onFinish(starShowerResult(state));
      return false;
    },
  });

  const playing = () => !paused && current().endedAt === null;

  // Each action returns whether it was used, so unused keys keep their browser behavior.
  const actions = {
    digit: (d: number) => {
      if (!playing()) return false;
      commit(typeDigit(current(), d));
      return true;
    },
    remove: () => {
      if (!playing()) return false;
      commit(deleteDigit(current()));
      return true;
    },
    submit: () => {
      if (!playing()) return false;
      const outcome = submit();
      if (outcome === null) return false;
      feedback(outcome.kind === 'wrong' ? 'wrong' : 'correct');
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
      controls={
        // Its own wrapper, so the keys can be made shorter on short screens without touching Quick Math's.
        <div className={styles.keys}>
          <Keypad onDigit={actions.digit} onDelete={actions.remove} onSubmit={actions.submit} />
        </div>
      }
    >
      <Sky {...sky} />
    </GameFrame>
  );
}
