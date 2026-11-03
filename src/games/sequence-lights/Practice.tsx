import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PracticeFrame } from '../shared/practice/PracticeFrame';
import type { PracticeProps } from '../shared/practice/types';
import { usePracticeRounds, type PracticeStatus } from '../shared/practice/usePracticeRounds';
import { Board } from './Board';
import { GAP_MS, SHOW_MS } from './engine';

/** The pause on the hint after a wrong tap, before the same sequence is shown again. */
export const HINT_MS = 800;

const SIZE = 3;

/** Cells counted from 0 on the 3×3 board: 2-6, 7-5-3 and 1-5-9-6 as the player sees them. */
const ROUNDS: readonly (readonly number[])[] = [
  [1, 5],
  [6, 4, 2],
  [0, 4, 8, 5],
];

type Phase = 'show' | 'input' | 'hint';

interface RoundProps {
  index: number;
  status: PracticeStatus;
  answer: (correct: boolean) => void;
  onSkip: () => void;
}

/** One round. The parent keys it by round, so a new round starts from `show` with nothing typed. */
function PracticeRound({ index, status, answer, onSkip }: RoundProps) {
  const { t } = useTranslation();
  const sequence = ROUNDS[index];
  const [phase, setPhase] = useState<Phase>('show');
  const [lit, setLit] = useState<number | null>(null);
  const typed = useRef(0);

  // Show the sequence; leaving the phase (or unmounting) clears every timer.
  useEffect(() => {
    if (phase !== 'show') return;
    typed.current = 0;
    const step = SHOW_MS + GAP_MS;
    const timers = sequence.flatMap((cell, i) => [
      setTimeout(() => setLit(cell), i * step),
      setTimeout(() => setLit(null), i * step + SHOW_MS),
    ]);
    timers.push(setTimeout(() => setPhase('input'), sequence.length * step));
    return () => timers.forEach(clearTimeout);
  }, [phase, sequence]);

  // After the hint, the same sequence plays again from its first cell.
  useEffect(() => {
    if (phase !== 'hint') return;
    const id = setTimeout(() => setPhase('show'), HINT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const press = (cell: number) => {
    if (phase !== 'input' || status === 'right') return;
    if (cell !== sequence[typed.current]) {
      setPhase('hint');
      answer(false);
      return;
    }
    typed.current += 1;
    if (typed.current === sequence.length) answer(true);
  };

  // The whole path stays lit while «¡Bien!» shows, as in the game.
  const litCells = new Set(status === 'right' ? sequence : lit === null ? [] : [lit]);

  const message =
    status === 'right'
      ? t('practice.nice')
      : phase === 'hint'
        ? t('games.sequence-lights.practice.hint')
        : phase === 'show'
          ? t(`games.sequence-lights.practice.${index === ROUNDS.length - 1 ? 'grows' : 'watch'}`)
          : t('games.sequence-lights.practice.yourTurn');

  return (
    <PracticeFrame
      round={index + 1}
      total={ROUNDS.length}
      message={message}
      tone={status === 'right' ? 'ok' : 'hint'}
      onSkip={onSkip}
      controls={<Board size={SIZE} lit={litCells} onPress={press} />}
    >
      {null}
    </PracticeFrame>
  );
}

export function SequenceLightsPractice({ onComplete, onSkip }: PracticeProps) {
  const { round, status, answer } = usePracticeRounds(ROUNDS.length, onComplete);
  return <PracticeRound key={round} index={round} status={status} answer={answer} onSkip={onSkip} />;
}
