import { useState } from 'react';
import { createRng, randomSeed } from '../../core/rng';
import { VIBRATION } from '../../core/vibrate';
import { useCountdown, useGameClock } from '../shared/clock';
import { useCue, useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { SWITCHYARD_DURATION_MS, advanceSwitchyard, createSwitchyardGame, switchyardResult } from './engine';
import { FasterToast } from './FasterToast';
import { WorldBoard, useSwitchyardWorld } from './useSwitchyardWorld';

/**
 * Switchyard: trains leave the tunnel and the person flips the switches so each one reaches the station of its
 * color. The shared loop advances the engine to the game clock, so the pause freezes trains and smoke.
 */
export function SwitchyardGame({ startLevel, paused, onFinish }: GameProps) {
  const feedback = useFeedback();
  const cue = useCue();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [finished, setFinished] = useState(false);
  const active = !paused && !finished;

  const { world, current, toggle, reducedMotion } = useSwitchyardWorld(() => createSwitchyardGame(startLevel, rng, 0), {
    active,
    now: () => Math.min(clock.now(), SWITCHYARD_DURATION_MS),
    advance: (game, to) => advanceSwitchyard(game, to, rng),
    // A train home rings a small chime instead of the usual hit tone; one at the wrong station keeps the miss.
    onArrival: (arrival) => (arrival.correct ? feedback('correct', 'chime') : feedback('timeout')),
    onSpawn: () => cue('whistle'),
    onFlip: () => cue('clack', VIBRATION.tick),
  });

  const remaining = useCountdown(clock, SWITCHYARD_DURATION_MS, paused, () => {
    setFinished(true);
    // Trains that arrive between the last frame and the end still count.
    const last = advanceSwitchyard(current().game, SWITCHYARD_DURATION_MS, rng).state;
    onFinish(switchyardResult(last, SWITCHYARD_DURATION_MS));
  });

  useGameKeys((key) => (/^[1-9]$/.test(key) ? toggle(Number(key) - 1) : false));

  const { game } = world;
  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: SWITCHYARD_DURATION_MS }}
      stageFlash={false}
    >
      <WorldBoard world={world} onToggle={toggle} reducedMotion={reducedMotion} />
      <FasterToast level={game.staircase.level} />
    </GameFrame>
  );
}
