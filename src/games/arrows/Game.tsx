import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock, useTrialTimeout } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { ArrowIcon, ArrowRow } from './ArrowRow';
import { answerArrow, arrowsResult, arrowWindowMs, createArrowsGame, timeoutArrow, type Direction } from './engine';
import styles from './arrows.module.css';

export function ArrowsGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createArrowsGame(startLevel, rng, 0));
  const [finished, setFinished] = useState(false);

  const remaining = useCountdown(clock, GAME_DURATION_MS, paused, () => {
    setFinished(true);
    onFinish(arrowsResult(game, GAME_DURATION_MS));
  });

  const active = !paused && !finished;

  useTrialTimeout(clock, game.trialStartedAt, active ? arrowWindowMs(game.staircase.level) : null, paused, () => {
    feedback('wrong');
    setGame(timeoutArrow(game, clock.now(), rng));
  });

  const answer = (direction: Direction) => {
    if (!active) return false;
    const res = answerArrow(game, direction, clock.now(), rng);
    if (res.correct === null) return false;
    feedback(res.correct ? 'correct' : 'wrong');
    setGame(res.state);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return answer('left');
    if (key === 'ArrowRight') return answer('right');
    return false;
  });

  return (
    <div className={styles.game}>
      <GameHud remainingMs={remaining} score={game.score} level={game.staircase.level} />
      <ArrowRow key={game.total} trial={game.trial} className="appear" />
      <div className={styles.controls}>
        <button type="button" className={styles.answer} onClick={() => answer('left')}>
          <ArrowIcon direction="left" />
          {t('games.arrows.left')}
        </button>
        <button type="button" className={styles.answer} onClick={() => answer('right')}>
          {t('games.arrows.right')}
          <ArrowIcon direction="right" />
        </button>
      </div>
    </div>
  );
}
