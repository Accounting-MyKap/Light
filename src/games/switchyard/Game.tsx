import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { ARRIVAL_SHOW_MS, Board, CHIMNEY_BACK } from './Board';
import {
  SWITCHYARD_DURATION_MS,
  advanceSwitchyard,
  createSwitchyardGame,
  switchyardResult,
  toggleSwitch,
  trainPose,
  type Arrival,
  type SwitchyardState,
} from './engine';
import { agePuffs, emitPuffs, puffLook, type SmokeState } from './smoke';
import styles from './switchyard.module.css';

interface World {
  game: SwitchyardState;
  smoke: SmokeState;
  /** Arrivals still showing their mark on the station. */
  arrivals: Arrival[];
}

/**
 * Switchyard: trains leave the tunnel and the person flips the switches so each one reaches the station of its
 * color. A requestAnimationFrame loop advances the engine to the game clock, so the pause freezes trains and smoke.
 */
export function SwitchyardGame({ startLevel, paused, onFinish }: GameProps) {
  const feedback = useFeedback();
  const clock = useGameClock(paused);
  const [rng] = useState(() => createRng(randomSeed()));
  const [smokeRng] = useState(() => createRng(randomSeed()));
  // Moving trains are the game, so they move anyway; the smoke is decoration and stays off with reduced motion.
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const [world, setWorld] = useState<World>(() => ({
    game: createSwitchyardGame(startLevel, rng, 0),
    smoke: { puffs: [], lastEmit: new Map() },
    arrivals: [],
  }));
  const worldRef = useRef(world);
  const [finished, setFinished] = useState(false);

  const feedbackRef = useRef(feedback);
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  const commit = useCallback((next: World) => {
    worldRef.current = next;
    setWorld(next);
  }, []);

  const remaining = useCountdown(clock, SWITCHYARD_DURATION_MS, paused, () => {
    setFinished(true);
    // Trains that arrive between the last frame and the end still count.
    const last = advanceSwitchyard(worldRef.current.game, SWITCHYARD_DURATION_MS, rng).state;
    onFinish(switchyardResult(last, SWITCHYARD_DURATION_MS));
  });

  const active = !paused && !finished;

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const now = Math.min(clock.now(), SWITCHYARD_DURATION_MS);
      const current = worldRef.current;
      const { state, arrivals } = advanceSwitchyard(current.game, now, rng);
      for (const arrival of arrivals) feedbackRef.current(arrival.correct ? 'correct' : 'timeout');

      let smoke = current.smoke;
      if (!reducedMotion) {
        const chimneys = state.trains
          .filter((train) => !train.arrived)
          .map((train) => ({ trainId: train.id, ...trainPose(state.map, train, CHIMNEY_BACK) }));
        smoke = agePuffs(emitPuffs(smoke, chimneys, now, smokeRng), now);
      }
      const shown = [...current.arrivals, ...arrivals].filter((a) => now - a.at < ARRIVAL_SHOW_MS);

      if (state !== current.game) commit({ game: state, smoke, arrivals: shown });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, clock, rng, smokeRng, reducedMotion, commit]);

  const toggle = (index: number) => {
    if (!active) return false;
    const current = worldRef.current;
    if (index < 0 || index >= current.game.switches.length) return false;
    commit({ ...current, game: toggleSwitch(current.game, index) });
    return true;
  };

  useGameKeys((key) => (/^[1-9]$/.test(key) ? toggle(Number(key) - 1) : false));

  const { game } = world;
  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: SWITCHYARD_DURATION_MS }}
      stageFlash={false}
    >
      <div className={styles.boardWrap}>
        <Board
          map={game.map}
          switches={game.switches}
          trains={game.trains}
          puffs={world.smoke.puffs.map((p) => ({ id: p.id, ...puffLook(p, game.now) }))}
          arrivals={world.arrivals}
          now={game.now}
          onToggle={toggle}
          reducedMotion={reducedMotion}
        />
      </div>
    </GameFrame>
  );
}
