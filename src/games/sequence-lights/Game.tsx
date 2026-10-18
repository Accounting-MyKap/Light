import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRng, randomSeed } from '../../core/rng';
import { useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameHud } from '../shared/GameHud';
import type { GameProps } from '../types';
import { Board } from './Board';
import { createSequenceGame, GAP_MS, pressCell, ROUNDS, sequenceResult, SHOW_MS } from './engine';
import styles from './sequence-lights.module.css';

const FEEDBACK_MS = 600;

type Phase = 'show' | 'input' | 'feedback';

export function SequenceLightsGame({ startLevel, paused, onFinish }: GameProps) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [game, setGame] = useState(() => createSequenceGame(startLevel, rng));
  const [phase, setPhase] = useState<Phase>('show');
  const [lit, setLit] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
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
    const { state, outcome } = pressCell(game, cell, rng);
    setGame(state);
    if (outcome === 'continue') return;
    const correct = outcome === 'round-correct';
    feedback(correct ? 'correct' : 'wrong');
    setLastCorrect(correct);
    setPhase('feedback');
  };

  const status =
    phase === 'show'
      ? t('games.sequence-lights.watch')
      : phase === 'input'
        ? t('games.sequence-lights.yourTurn')
        : lastCorrect
          ? t('games.sequence-lights.correct')
          : t('games.sequence-lights.wrong');

  return (
    <div className={styles.game}>
      <GameHud score={game.score} level={game.level} />
      <p className={styles.round}>
        {t('games.sequence-lights.round', { n: Math.min(game.round + 1, ROUNDS), total: ROUNDS })}
      </p>
      <p className={styles.status} aria-live="polite">
        {status}
      </p>
      <Board size={game.gridSize} lit={new Set(lit === null ? [] : [lit])} onPress={press} />
    </div>
  );
}
