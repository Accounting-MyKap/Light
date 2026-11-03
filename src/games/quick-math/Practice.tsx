import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds } from '../shared/practice/usePracticeRounds';
import { useGameKeys } from '../shared/useGameKeys';
import { MAX_INPUT_DIGITS, formatProblem, type Problem } from './engine';
import { Keypad } from './Keypad';
import styles from './quick-math.module.css';

/** Pointer clicks on game controls should not move keyboard focus onto them (Enter must keep submitting). */
const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

const ROUNDS: Problem[] = [
  { a: 2, b: 3, op: '+', answer: 5 },
  { a: 7, b: 4, op: '-', answer: 3 },
  { a: 6, b: 7, op: '×', answer: 42 },
];

export function QuickMathPractice({ onComplete, onSkip }: PracticeProps) {
  const { t } = useTranslation();
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  // The typed answer stays visible while «¡Bien!» shows, and is dropped when the round changes.
  const [typed, setTyped] = useState({ round: 0, value: '' });
  const input = typed.round === round ? typed.value : '';
  const setInput = (update: (cur: string) => string) => setTyped({ round, value: update(input) });
  const problem = ROUNDS[round];

  const digit = (d: number) => {
    if (status === 'right') return false;
    setInput((cur) => (cur.length >= MAX_INPUT_DIGITS ? cur : cur + d));
    return true;
  };
  const remove = () => {
    if (status === 'right') return false;
    setInput((cur) => cur.slice(0, -1));
    return true;
  };
  const submit = () => {
    if (status === 'right' || input === '') return false;
    const correct = Number(input) === problem.answer;
    if (!correct) setInput(() => '');
    answer(correct);
    return true;
  };
  const skip = () => {
    if (status === 'right') return false;
    answer(true);
    return true;
  };

  useGameKeys((key) => {
    if (/^[0-9]$/.test(key)) return digit(Number(key));
    if (key === 'Backspace') return remove();
    if (key === 'Enter') return submit();
    return false;
  });

  const message =
    status === 'right'
      ? t('practice.nice')
      : status === 'wrong'
        ? t('games.quick-math.practice.hint', { problem: formatProblem(problem), answer: problem.answer })
        : t(`games.quick-math.practice.round${round + 1}`);

  const controls = (
    <>
      <Keypad onDigit={digit} onDelete={remove} onSubmit={submit} />
      {round === ROUNDS.length - 1 && (
        <button type="button" className={styles.skip} onMouseDown={keepFocus} onClick={skip}>
          {t('games.quick-math.skip')}
        </button>
      )}
    </>
  );

  return (
    <PracticeFrame
      round={round + 1}
      total={ROUNDS.length}
      message={message}
      title={t('games.quick-math.title')}
      tone={status === 'right' ? 'ok' : status === 'wrong' ? 'hint' : 'normal'}
      onSkip={onSkip}
      controls={controls}
    >
      <div className={styles.display} aria-live="polite">
        <div key={round} className={styles.operation} data-enter="true">
          <span className={styles.problem} data-testid="problem">
            {formatProblem(problem)}
          </span>
          <span className={styles.equals}>
            <span className={styles.sign} aria-hidden="true">
              =
            </span>
            <span className={styles.answer} data-testid="answer" data-empty={input === ''}>
              {input || '?'}
            </span>
          </span>
        </div>
      </div>
    </PracticeFrame>
  );
}
