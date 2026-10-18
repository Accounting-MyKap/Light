import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import {
  createQuickMathGame,
  deleteDigit,
  formatProblem,
  quickMathResult,
  skipProblem,
  submitAnswer,
  typeDigit,
} from './engine';
import { Keypad } from './Keypad';
import styles from './quick-math.module.css';

/** Pointer clicks on game controls should not move keyboard focus onto them (Enter must keep submitting). */
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

export function QuickMathGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createQuickMathGame(startLevel, rng));
  const [finished, setFinished] = useState(false);

  const remaining = useCountdown(clock, GAME_DURATION_MS, paused, () => {
    setFinished(true);
    onFinish(quickMathResult(game, GAME_DURATION_MS));
  });

  const active = !paused && !finished;

  // Each action returns whether it was used, so unused keys keep their browser behavior.
  const actions = {
    digit: (d: number) => {
      if (!active) return false;
      setGame(typeDigit(game, d));
      return true;
    },
    remove: () => {
      if (!active) return false;
      setGame(deleteDigit(game));
      return true;
    },
    submit: () => {
      if (!active) return false;
      const res = submitAnswer(game, rng);
      if (res.correct === null) return false;
      feedback(res.correct ? 'correct' : 'wrong');
      setGame(res.state);
      return true;
    },
    skip: () => {
      if (!active) return false;
      feedback('wrong');
      setGame(skipProblem(game, rng));
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
    <div className={styles.game}>
      <GameHud remainingMs={remaining} score={game.score} level={game.staircase.level} />
      <div className={styles.display} aria-live="polite">
        <span data-testid="problem">{formatProblem(game.problem)}</span>
        <span aria-hidden="true">=</span>
        <span className={styles.answer} data-testid="answer">
          {game.input || '?'}
        </span>
      </div>
      <Keypad onDigit={actions.digit} onDelete={actions.remove} onSubmit={actions.submit} />
      <button type="button" className={styles.skip} onMouseDown={keepFocus} onClick={actions.skip}>
        {t('games.quick-math.skip')}
      </button>
    </div>
  );
}
