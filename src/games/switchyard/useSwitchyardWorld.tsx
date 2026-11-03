import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../../core/motion';
import { createRng, randomSeed } from '../../core/rng';
import { ARRIVAL_SHOW_MS, Board } from './Board';
import { BOARD } from './maps';
import { toggleSwitch, type Arrival, type SwitchyardState, type Train } from './engine';
import { agePuffs, emitPuffs, puffLook, type SmokeState } from './smoke';
import { chimneyOf, trainSprite } from './sprite';
import styles from './switchyard.module.css';

/*
 * The moving yard shared by the game and its practice: a requestAnimationFrame loop advances the engine to a clock,
 * lets the smoke out of the chimneys and keeps the arrival marks on their stations for a moment.
 */

export interface World {
  game: SwitchyardState;
  smoke: SmokeState;
  /** Arrivals still showing their mark on the station. */
  arrivals: Arrival[];
}

export interface SwitchyardWorldOptions {
  /** The loop runs, and the switches answer, only while active. */
  active: boolean;
  /** The time the yard is advanced to on each frame. */
  now: () => number;
  /** Moves the yard to `to`: the game runs the engine as it is, the practice adds its own trains around it. */
  advance: (game: SwitchyardState, to: number) => { state: SwitchyardState; arrivals: Arrival[] };
  /** Called once for every train that reaches a station, before the frame is drawn. */
  onArrival: (arrival: Arrival) => void;
  /** Called once for every train that comes out of the tunnel while the yard runs. */
  onSpawn?: (train: Train) => void;
  /** Called after a switch flipped, by a tap or a key. */
  onFlip?: (index: number) => void;
}

export interface SwitchyardWorld {
  world: World;
  /** The latest world, for callbacks that run between renders. */
  current: () => World;
  /** Flips switch `index`. False when the yard is not active or there is no such switch. Stable. */
  toggle: (index: number) => boolean;
  /** Moving trains are the game, so they move anyway; the smoke is decoration and stays off with reduced motion. */
  reducedMotion: boolean;
}

export function useSwitchyardWorld(initial: () => SwitchyardState, options: SwitchyardWorldOptions): SwitchyardWorld {
  const [smokeRng] = useState(() => createRng(randomSeed()));
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const [world, setWorld] = useState<World>(() => ({
    game: initial(),
    smoke: { puffs: [], lastEmit: new Map() },
    arrivals: [],
  }));
  const worldRef = useRef(world);

  // The latest callbacks, so the loop never calls stale ones and never restarts because of them.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const commit = useCallback((next: World) => {
    worldRef.current = next;
    setWorld(next);
  }, []);

  const { active } = options;

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const { now: clock, advance, onArrival, onSpawn } = optionsRef.current;
      const now = clock();
      const current = worldRef.current;
      const { state, arrivals } = advance(current.game, now);
      if (onSpawn && state.trains !== current.game.trains) {
        // Train ids are never reused, so a train is new when the last frame did not have its id.
        const before = new Set(current.game.trains.map((train) => train.id));
        for (const train of state.trains) if (!before.has(train.id)) onSpawn(train);
      }
      for (const arrival of arrivals) onArrival(arrival);

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
  }, [active, smokeRng, reducedMotion, commit]);

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
      optionsRef.current.onFlip?.(index);
      return true;
    },
    [commit],
  );

  const current = useCallback(() => worldRef.current, []);

  return { world, current, toggle, reducedMotion };
}

/**
 * The width that lets the whole board fit in the measured box, keeping its proportions. Undefined until the box has
 * a size (or where ResizeObserver does not exist), and the board then takes the width of its box.
 */
function useFittedWidth(box: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const fit = (w: number, h: number) => {
      if (w > 0 && h > 0) setWidth(Math.floor(Math.min(w, (h * BOARD.width) / BOARD.height)));
    };
    // Measured now, before the first paint: the observer reports only after it, and the board would show for a frame
    // at the whole width of its box (overflowing it on a wide screen). The box's size never depends on the board's.
    const rect = el.getBoundingClientRect();
    fit(rect.width, rect.height);
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width, entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return width;
}

/** The yard drawn as large as its box allows, with its switches, trains, smoke and arrival marks. */
export function WorldBoard({
  world,
  onToggle,
  reducedMotion,
}: {
  world: World;
  onToggle: (index: number) => void;
  reducedMotion: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const boardWidth = useFittedWidth(boxRef);
  const { game } = world;
  return (
    <div ref={boxRef} className={styles.boardWrap}>
      <Board
        map={game.map}
        switches={game.switches}
        trains={game.trains}
        puffs={world.smoke.puffs.map((p) => ({ id: p.id, ...puffLook(p, game.now) }))}
        arrivals={world.arrivals}
        now={game.now}
        onToggle={onToggle}
        reducedMotion={reducedMotion}
        width={boardWidth}
      />
    </div>
  );
}
