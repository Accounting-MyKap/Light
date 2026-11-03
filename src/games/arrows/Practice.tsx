import { useTranslation } from 'react-i18next';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import { ArrowIcon, ArrowRow } from './ArrowRow';
import type { ArrowTrial, Direction } from './engine';
import styles from './arrows.module.css';

/** Two easy rounds, then two with side arrows that point the other way. */
const ROUNDS: ArrowTrial[] = [
  { direction: 'right', congruent: true },
  { direction: 'left', congruent: true },
  { direction: 'right', congruent: false },
  { direction: 'left', congruent: false },
];

export function ArrowsPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  const trial = ROUNDS[round];

  const respond = (direction: Direction) => {
    if (status === 'right') return false;
    answer(direction === trial.direction);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return respond('left');
    if (key === 'ArrowRight') return respond('right');
    return false;
  });

  const message =
    status === 'right'
      ? t('practice.nice')
      : status === 'wrong'
        ? t(trial.direction === 'right' ? 'games.arrows.practice.hintRight' : 'games.arrows.practice.hintLeft')
        : t(trial.congruent ? 'games.arrows.practice.center' : 'games.arrows.practice.trick');

  const controls = (
    <div className={styles.controls}>
      <button type="button" className={styles.answer} onClick={() => respond('left')}>
        <ArrowIcon direction="left" />
        {t('games.arrows.left')}
      </button>
      <button type="button" className={styles.answer} onClick={() => respond('right')}>
        {t('games.arrows.right')}
        <ArrowIcon direction="right" />
      </button>
    </div>
  );

  return (
    <PracticeFrame
      round={round + 1}
      total={ROUNDS.length}
      message={message}
      title={t('games.arrows.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={controls}
    >
      <ArrowRow key={round} trial={trial} className="appear" />
    </PracticeFrame>
  );
}
