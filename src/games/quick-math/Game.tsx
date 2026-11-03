import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { formatProblem } from '../shared/arithmetic';
import { useCountdown, useGameClock } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { Keypad } from '../shared/Keypad';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import {
  createQuickMathGame,
  deleteDigit,
  quickMathResult,
  skipProblem,
  submitAnswer,
  typeDigit,
} from './engine';
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
      // Skipping costs nothing, so it is not a mistake: it reads as a timeout, not as a wrong answer.
      feedback('timeout');
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

  const controls = (
    <>
      <Keypad onDigit={actions.digit} onDelete={actions.remove} onSubmit={actions.submit} />
      <button type="button" className={styles.skip} onMouseDown={keepFocus} onClick={actions.skip}>
        {t('games.quick-math.skip')}
      </button>
    </>
  );

  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: GAME_DURATION_MS }}
      controls={controls}
    >
      {/* The announcement region stays put; only the operation inside it is replaced, and it enters from below. */}
      <div className={styles.display} aria-live="polite">
        <div key={game.total} className={styles.operation} data-enter="true">
          <span className={styles.problem} data-testid="problem">
            {formatProblem(game.problem)}
          </span>
          <span className={styles.equals}>
            <span className={styles.sign} aria-hidden="true">
              =
            </span>
            <span className={styles.answer} data-testid="answer" data-empty={game.input === ''}>
              {game.input || '?'}
            </span>
          </span>
        </div>
      </div>
    </GameFrame>
  );
}
