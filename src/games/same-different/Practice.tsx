import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import type { SymbolId } from './engine';
import { INTRO_MS } from './Game';
import { SymbolGlyph } from './symbols';
import styles from './same-different.module.css';

interface Round {
  /** The symbol shown, compared with the one before it. */
  symbol: SymbolId;
  same: boolean;
  prompt: string;
  hint: string;
}

/** Step 0 shows the star alone; then star (same), heart (different), heart (same). */
const ROUNDS: Round[] = [
  { symbol: 'star', same: true, prompt: 'question', hint: 'hint1' },
  { symbol: 'heart', same: false, prompt: 'andThis', hint: 'hint2' },
  { symbol: 'heart', same: true, prompt: 'compare', hint: 'hint3' },
];

export function SameDifferentPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  // Step 0 is not a round: the symbol to remember is shown and the buttons are off.
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => window.clearTimeout(id);
  }, []);

  const current = ROUNDS[round];

  const respond = (same: boolean) => {
    if (!introDone || status === 'right') return false;
    answer(same === current.same);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return respond(false);
    if (key === 'ArrowRight') return respond(true);
    return false;
  });

  const shown = introDone ? current.symbol : 'star';
  const message = !introDone
    ? t('games.same-different.practice.remember')
    : status === 'right'
      ? t('practice.nice')
      : status === 'wrong'
        ? t(`games.same-different.practice.${current.hint}`)
        : t(`games.same-different.practice.${current.prompt}`);

  const controls = (
    <div className={styles.controls}>
      <button type="button" className={styles.answer} disabled={!introDone} onClick={() => respond(false)}>
        {t('games.same-different.no')}
      </button>
      <button type="button" className={styles.answer} disabled={!introDone} onClick={() => respond(true)}>
        {t('games.same-different.yes')}
      </button>
    </div>
  );

  return (
    <PracticeFrame
      round={round + 1}
      total={ROUNDS.length}
      message={message}
      title={t('games.same-different.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={controls}
    >
      <div key={`${round}-${introDone}`} className={`${styles.card} appear`} data-testid="symbol-card">
        <SymbolGlyph id={shown} label={t(`games.same-different.symbols.${shown}`)} className={styles.symbol} />
      </div>
    </PracticeFrame>
  );
}
