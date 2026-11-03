import type { Rng } from '../../core/rng';

/*
 * Locomotive smoke: each chimney lets out a puff every PUFF_EVERY_MS. A puff stays where it was born, drifts a little,
 * grows and fades, so a moving train leaves a trail. Pure functions over game time, so the smoke stops in the pause.
 */

export const PUFF_EVERY_MS = 80;
export const PUFF_LIFE_MS = 1500;

const START_RADIUS = 3;
const END_RADIUS = 15;
const START_OPACITY = 0.6;

export interface Puff {
  id: string;
  x: number;
  y: number;
  born: number;
  /** Drift, in board units per second. */
  dx: number;
  dy: number;
}

export interface SmokeState {
  puffs: Puff[];
  /** When each train last puffed. */
  lastEmit: Map<number, number>;
}

export interface Chimney {
  trainId: number;
  x: number;
  y: number;
}

export function emitPuffs(smoke: SmokeState, sources: readonly Chimney[], now: number, rng: Rng): SmokeState {
  const puffs = [...smoke.puffs];
  const lastEmit = new Map<number, number>();
  const puff = (source: Chimney, born: number) =>
    puffs.push({
      id: `${source.trainId}:${born}`,
      x: source.x,
      y: source.y,
      born,
      dx: (rng() - 0.5) * 16,
      dy: -3 - rng() * 9,
    });

  for (const source of sources) {
    let last = smoke.lastEmit.get(source.trainId);
    if (last === undefined) {
      puff(source, now);
      last = now;
    }
    while (now - last >= PUFF_EVERY_MS) {
      last += PUFF_EVERY_MS;
      puff(source, last);
    }
    lastEmit.set(source.trainId, last);
  }
  return { puffs, lastEmit };
}

export function agePuffs(smoke: SmokeState, now: number): SmokeState {
  return { ...smoke, puffs: smoke.puffs.filter((p) => now - p.born < PUFF_LIFE_MS) };
}

export function puffLook(puff: Puff, now: number): { x: number; y: number; r: number; opacity: number } {
  const age = Math.max(0, now - puff.born);
  const k = Math.min(1, age / PUFF_LIFE_MS);
  const grow = 1 - (1 - k) * (1 - k);
  return {
    x: puff.x + (puff.dx * age) / 1000,
    y: puff.y + (puff.dy * age) / 1000,
    r: START_RADIUS + (END_RADIUS - START_RADIUS) * grow,
    opacity: START_OPACITY * (1 - k),
  };
}
