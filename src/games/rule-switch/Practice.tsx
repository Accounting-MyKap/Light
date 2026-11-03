import { useTranslation } from 'react-i18next';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import { CardView, RuleIcon } from './Card';
import type { Card, Rule, Side } from './engine';
import styles from './rule-switch.module.css';

interface Round {
  rule: Rule;
  stimulus: Card;
  left: Card;
  right: Card;
  correct: Side;
  guide: string;
}

const ROUNDS: Round[] = [
  {
    rule: 'color',
    stimulus: { shape: 'circle', color: 'blue' },
    left: { shape: 'square', color: 'blue' },
    right: { shape: 'circle', color: 'orange' },
    correct: 'left',
    guide: 'round1',
  },
  {
    rule: 'color',
    stimulus: { shape: 'triangle', color: 'purple' },
    left: { shape: 'triangle', color: 'orange' },
    right: { shape: 'square', color: 'purple' },
    correct: 'right',
    guide: 'round2',
  },
  {
    rule: 'shape',
    stimulus: { shape: 'circle', color: 'orange' },
    left: { shape: 'circle', color: 'blue' },
    right: { shape: 'square', color: 'orange' },
    correct: 'left',
    guide: 'round3',
  },
  {
    rule: 'shape',
    stimulus: { shape: 'triangle', color: 'blue' },
    left: { shape: 'square', color: 'blue' },
    right: { shape: 'triangle', color: 'purple' },
    correct: 'right',
    guide: 'round4',
  },
];

export function RuleSwitchPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  const current = ROUNDS[round];
  // The rule changed on this round: the banner flips, as in the game.
  const switched = round > 0 && current.rule !== ROUNDS[round - 1].rule;

  const choose = (side: Side) => {
    if (status === 'right') return false;
    answer(side === current.correct);
    return true;
  };

  useGameKeys((key) => {
    if (key === 'ArrowLeft') return choose('left');
    if (key === 'ArrowRight') return choose('right');
    return false;
  });

  const hint =
    current.rule === 'color'
      ? t('games.rule-switch.practice.hintColor', { color: t(`games.rule-switch.colors.${current.stimulus.color}`) })
      : t('games.rule-switch.practice.hintShape', { shape: t(`games.rule-switch.shapes.${current.stimulus.shape}`) });
  const message =
    status === 'right' ? t('practice.nice') : status === 'wrong' ? hint : t(`games.rule-switch.practice.${current.guide}`);

  const controls = (
    <div className={styles.targets}>
      <CardView card={current.left} testId="target-left" onSelect={() => choose('left')} />
      <CardView card={current.right} testId="target-right" onSelect={() => choose('right')} />
    </div>
  );

  return (
    <PracticeFrame
      round={round + 1}
      total={ROUNDS.length}
      message={message}
      title={t('games.rule-switch.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={controls}
    >
      <div
        key={switched ? `rule-${round}` : `rule-${current.rule}`}
        className={`${styles.banner} ${switched ? styles.switched : ''}`}
        data-testid="rule-banner"
        data-rule={current.rule}
      >
        <RuleIcon rule={current.rule} />
        {t(`games.rule-switch.rule.${current.rule}`)}
      </div>
      <CardView key={`stimulus-${round}`} card={current.stimulus} testId="stimulus" className={`${styles.stimulus} appear`} />
    </PracticeFrame>
  );
}
