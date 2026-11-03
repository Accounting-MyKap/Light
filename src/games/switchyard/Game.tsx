import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { createRng, randomSeed } from '../../core/rng';
import { useCountdown, useGameClock } from '../shared/clock';
import { useFeedback } from '../shared/feedback';
import { GameFrame } from '../shared/GameFrame';
import { useGameKeys } from '../shared/useGameKeys';
import type { GameProps } from '../types';
import { ARRIVAL_SHOW_MS, Board } from './Board';
import { BOARD } from './maps';
import {
  SWITCHYARD_DURATION_MS,
  advanceSwitchyard,
  createSwitchyardGame,
  switchyardResult,
  toggleSwitch,
  type Arrival,
  type SwitchyardState,
} from './engine';
import { agePuffs, emitPuffs, puffLook, type SmokeState } from './smoke';
import { chimneyOf, trainSprite } from './sprite';
import styles from './switchyard.module.css';

/**
 * The width that lets the whole board fit in the measured box, keeping its proportions. Undefined until measured (or
 * where ResizeObserver does not exist), and the board then takes the width of its box.
 */
function useFittedWidth(box: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) setWidth(Math.floor(Math.min(w, (h * BOARD.width) / BOARD.height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return width;
}

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
  const boxRef = useRef<HTMLDivElement>(null);
  const boardWidth = useFittedWidth(boxRef);

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
          .map((train) => {
            const sprite = trainSprite(state.map, train);
            const facing: 1 | -1 | 0 = sprite.loco.view === 'side' ? sprite.loco.facing : 0;
            return { trainId: train.id, facing, ...chimneyOf(sprite) };
          });
        smoke = agePuffs(emitPuffs(smoke, chimneys, now, smokeRng), now);
      }
      const shown = [...current.arrivals, ...arrivals].filter((a) => now - a.at < ARRIVAL_SHOW_MS);

      if (state !== current.game) commit({ game: state, smoke, arrivals: shown });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, clock, rng, smokeRng, reducedMotion, commit]);

  // Stable, so the switch buttons are not drawn again on every frame.
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const toggle = useCallback(
    (index: number) => {
      if (!activeRef.current) return false;
      const current = worldRef.current;
      if (index < 0 || index >= current.game.switches.length) return false;
      commit({ ...current, game: toggleSwitch(current.game, index) });
      return true;
    },
    [commit],
  );

  useGameKeys((key) => (/^[1-9]$/.test(key) ? toggle(Number(key) - 1) : false));

  const { game } = world;
  return (
    <GameFrame
      score={game.score}
      level={game.staircase.level}
      time={{ remainingMs: remaining, totalMs: SWITCHYARD_DURATION_MS }}
      stageFlash={false}
    >
      <div ref={boxRef} className={styles.boardWrap}>
        <Board
          map={game.map}
          switches={game.switches}
          trains={game.trains}
          puffs={world.smoke.puffs.map((p) => ({ id: p.id, ...puffLook(p, game.now) }))}
          arrivals={world.arrivals}
          now={game.now}
          onToggle={toggle}
          reducedMotion={reducedMotion}
          width={boardWidth}
          smokeCanvas={!reducedMotion}
        />
      </div>
    </GameFrame>
  );
}
