import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock, useTrialTimeout } from '../shared/clock';
import { GAME_DURATION_MS } from '../shared/constants';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import type { GameProps } from '../types';
import { answerSameDiff, createSameDiffGame, sameDiffResult, timeLimitMs, timeoutSameDiff } from './engine';
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
    feedback('wrong');
    setGame(timeoutSameDiff(game, clock.now(), rng));
  });

  const answer = (choice: 'same' | 'different') => {
    if (!active) return;
    const res = answerSameDiff(game, choice, clock.now(), rng);
    if (res.correct === null) return;
    feedback(res.correct ? 'correct' : 'wrong');
    setGame(res.state);
  };

  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answerRef.current('different');
      else if (e.key === 'ArrowRight') answerRef.current('same');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = introDone ? game.current : game.previous;

  return (
    <div className={styles.game}>
      <GameHud remainingMs={remaining} score={game.score} level={game.staircase.level} />
      <p className={styles.prompt} aria-live="polite">
        {introDone ? t('games.same-different.question') : t('games.same-different.remember')}
      </p>
      <div key={`${game.total}-${introDone}`} className={`${styles.card} appear`} data-testid="symbol-card">
        <SymbolGlyph
          id={shown}
          label={t(`games.same-different.symbols.${shown}`)}
          className={styles.symbol}
        />
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.answer} disabled={!introDone} onClick={() => answer('different')}>
          {t('games.same-different.no')}
        </button>
        <button type="button" className={styles.answer} disabled={!introDone} onClick={() => answer('same')}>
          {t('games.same-different.yes')}
        </button>
      </div>
    </div>
  );
}
