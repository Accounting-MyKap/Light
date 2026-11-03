import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock, useTrialTimeout } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import {
  answerSameDiff,
  createSameDiffGame,
  sameDiffResult,
  streakMultiplier,
  timeLimitMs,
  timeoutSameDiff,
} from './engine';
import { SymbolGlyph } from './symbols';
import styles from './same-different.module.css';

/** How long the very first symbol is shown before the first question. */
export const INTRO_MS = 1500;

export function SameDifferentGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  // The first question's window starts when the intro ends.
  const [game, setGame] = useState(() => createSameDiffGame(startLevel, rng, INTRO_MS));
  const [introDone, setIntroDone] = useState(false);
  const [finished, setFinished] = useState(false);

  const remaining = useCountdown(clock, GAME_DURATION_MS, paused, () => {
    setFinished(true);
    onFinish(sameDiffResult(game, GAME_DURATION_MS));
  });

  useTrialTimeout(clock, 0, introDone ? null : INTRO_MS, paused, () => setIntroDone(true));

  const active = introDone && !paused && !finished;

  useTrialTimeout(clock, game.trialStartedAt, active ? timeLimitMs(game.staircase.level) : null, paused, () => {
    feedback('timeout');
    setGame(timeoutSameDiff(game, clock.now(), rng));
  });

  const answer = (choice: 'same' | 'different') => {
    if (!active) return false;
    const res = answerSameDiff(game, choice, clock.now(), rng);
    if (res.correct === null) return false;
    feedback(res.correct ? 'correct' : 'wrong');
    setGame(res.state);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return answer('different');
    if (key === 'ArrowRight') return answer('same');
    return false;
  });

  const shown = introDone ? game.current : game.previous;
  const multiplier = streakMultiplier(game.streak);

  const controls = (
    <div className={styles.controls}>
      <button type="button" className={styles.answer} disabled={!introDone} onClick={() => answer('different')}>
        {t('games.same-different.no')}
      </button>
      <button type="button" className={styles.answer} disabled={!introDone} onClick={() => answer('same')}>
        {t('games.same-different.yes')}
      </button>
    </div>
  );

  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: GAME_DURATION_MS }}
      controls={controls}
    >
      <p className={styles.prompt} aria-live="polite">
        {introDone ? t('games.same-different.question') : t('games.same-different.remember')}
      </p>
      <div key={`${game.total}-${introDone}`} className={`${styles.card} appear`} data-testid="symbol-card">
        <SymbolGlyph id={shown} label={t(`games.same-different.symbols.${shown}`)} className={styles.symbol} />
      </div>
      {/* The slot keeps its height when the pill is not there, so nothing moves when it shows up. */}
      <div className={styles.streakSlot}>
        {multiplier >= 2 && (
          // Keyed by the multiplier: going from ×2 to ×3 re-mounts the pill, so it jumps again.
          <span key={multiplier} className={styles.streak}>
            {t('games.same-different.streak', { n: multiplier })}
          </span>
        )}
      </div>
    </GameFrame>
  );
}
