import { useTranslation } from 'react-i18next';
import { playTone } from '../../core/sound';
import { useSettings } from '../../data/settings';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import { ChallengeView } from './ChallengeView';
import { Controls } from './Controls';
import { choicesOf, type Choice } from './engine';
import type { Challenge } from './generator';
import type { Outcome } from './solver';

/**
 * Two «which is heaviest?» rounds (one balance, then a chain of two), then two «which way will it tip?» rounds on the
 * same equivalence: one where the new balance tips, one where it stays level.
 */
const ROUNDS: Challenge[] = [
  { kind: 'heaviest', figures: [0, 1], clues: [{ left: [0], right: [1], outcome: 'left' }], answer: 0 },
  {
    kind: 'heaviest',
    figures: [0, 1, 2],
    clues: [
      { left: [1], right: [2], outcome: 'left' },
      { left: [0], right: [1], outcome: 'left' },
    ],
    answer: 0,
  },
  {
    kind: 'tilt',
    figures: [0, 1],
    clues: [{ left: [0], right: [1, 1], outcome: 'level' }],
    question: { left: [0], right: [1, 1, 1], outcome: 'right' },
    answer: 'right',
  },
  {
    kind: 'tilt',
    figures: [0, 1],
    clues: [{ left: [0], right: [1, 1], outcome: 'level' }],
    question: { left: [0, 0], right: [1, 1, 1, 1], outcome: 'level' },
    answer: 'level',
  },
];

const OUTCOME_KEYS: Record<string, Outcome> = { ArrowLeft: 'left', ArrowRight: 'right', '=': 'level', ArrowDown: 'level' };

export function BalancePractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { sound } = useSettings();
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  const challenge = ROUNDS[round];

  const respond = (choice: Choice) => {
    if (status === 'right') return false;
    const correct = choice === challenge.answer;
    if (correct && challenge.kind === 'tilt' && sound) playTone('tilt');
    answer(correct);
    return true;
  };

  useGameKeys((key) => {
    if (challenge.kind === 'tilt') return key in OUTCOME_KEYS ? respond(OUTCOME_KEYS[key]) : false;
    const choices = choicesOf(challenge);
    const index = Number(key) - 1;
    return Number.isInteger(index) && index >= 0 && index < choices.length ? respond(choices[index]) : false;
  });

  const n = round + 1;
  const message =
    status === 'right'
      ? t('practice.nice')
      : t(status === 'wrong' ? `games.balance.practice.hint${n}` : `games.balance.practice.round${n}`);

  return (
    <PracticeFrame
      round={n}
      total={ROUNDS.length}
      message={message}
      title={t('games.balance.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={
        <Controls
          challenge={challenge}
          marked={status === 'right' ? { choice: challenge.answer, correct: true } : null}
          onChoose={respond}
        />
      }
    >
      <ChallengeView key={round} challenge={challenge} revealed={status === 'right'} />
    </PracticeFrame>
  );
}
