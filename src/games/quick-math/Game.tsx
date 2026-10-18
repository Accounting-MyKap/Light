import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
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

  const actions = {
    digit: (d: number) => active && setGame(typeDigit(game, d)),
    remove: () => active && setGame(deleteDigit(game)),
    submit: () => {
      if (!active) return;
      const res = submitAnswer(game, rng);
      if (res.correct === null) return;
      feedback(res.correct ? 'correct' : 'wrong');
      setGame(res.state);
    },
    skip: () => {
      if (!active) return;
      feedback('wrong');
      setGame(skipProblem(game, rng));
    },
  };

  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) actionsRef.current.digit(Number(e.key));
      else if (e.key === 'Backspace') actionsRef.current.remove();
      else if (e.key === 'Enter') actionsRef.current.submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      <button type="button" className={styles.skip} onClick={actions.skip}>
        {t('games.quick-math.skip')}
      </button>
    </div>
  );
}
