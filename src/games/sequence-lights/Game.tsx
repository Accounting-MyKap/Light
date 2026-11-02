import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import type { GameProps } from '../types';
import { Board } from './Board';
import { createSequenceGame, GAP_MS, pressCell, ROUNDS, sequenceResult, SHOW_MS } from './engine';
import styles from './sequence-lights.module.css';

const FEEDBACK_MS = 600;

type Phase = 'show' | 'input' | 'feedback';

/** The round that just ended, kept for the pause after it: `pressCell` has already moved on to the next round. */
interface FinishedRound {
  correct: boolean;
  /** The path of that round and the board it was played on (the next round may need a bigger one). */
  sequence: readonly number[];
  size: number;
}

export function SequenceLightsGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createSequenceGame(startLevel, rng));
  const [phase, setPhase] = useState<Phase>('show');
  const [lit, setLit] = useState<number | null>(null);
  const [finishedRound, setFinishedRound] = useState<FinishedRound | null>(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Show the sequence; a pause clears the timers and resuming replays it from the start.
  useEffect(() => {
    if (phase !== 'show' || paused) return;
    const step = SHOW_MS + GAP_MS;
    const timers = game.sequence.flatMap((cell, i) => [
      setTimeout(() => setLit(cell), i * step),
      setTimeout(() => setLit(null), i * step + SHOW_MS),
    ]);
    timers.push(setTimeout(() => setPhase('input'), game.sequence.length * step));
    return () => timers.forEach(clearTimeout);
  }, [phase, paused, game.sequence]);

  useEffect(() => {
    if (phase !== 'feedback' || paused) return;
    const id = setTimeout(() => {
      if (game.finished) onFinishRef.current(sequenceResult(game, clock.now()));
      else setPhase('show');
    }, FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [phase, paused, game, clock]);

  const press = (cell: number) => {
    if (phase !== 'input' || paused) return;
    // Taken before pressing: the state that comes back already holds the next round.
    const { sequence, gridSize } = game;
    const { state, outcome } = pressCell(game, cell, rng);
    setGame(state);
    if (outcome === 'continue') return;
    const correct = outcome === 'round-correct';
    feedback(correct ? 'correct' : 'wrong');
    setFinishedRound({ correct, sequence, size: gridSize });
    setPhase('feedback');
  };

  const resting = phase === 'feedback' && finishedRound !== null;
  const celebrating = resting && finishedRound.correct;
  // A correct round lights its whole path together for the pause between rounds; a wrong one lights nothing.
  const litCells = new Set(celebrating ? finishedRound.sequence : lit === null ? [] : [lit]);
  const boardSize = resting ? finishedRound.size : game.gridSize;

  const status =
    phase === 'show'
      ? t('games.sequence-lights.watch')
      : phase === 'input'
        ? t('games.sequence-lights.yourTurn')
        : celebrating
          ? t('games.sequence-lights.correct')
          : t('games.sequence-lights.wrong');

  return (
    <GameFrame
      score={game.score}
      level={game.level}
      rounds={{ current: Math.min(game.round + 1, ROUNDS), total: ROUNDS }}
      controls={<Board size={boardSize} lit={litCells} onPress={press} />}
    >
      <p className={styles.status} data-tone={celebrating ? 'ok' : undefined} aria-live="polite">
        {status}
      </p>
    </GameFrame>
  );
}
