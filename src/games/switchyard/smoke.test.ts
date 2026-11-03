import { createRng } from '../../core/rng';
import { PUFF_EVERY_MS, PUFF_LIFE_MS, agePuffs, emitPuffs, puffLook, type SmokeState } from './smoke';

const empty = (): SmokeState => ({ puffs: [], lastEmit: new Map() });

test('a chimney puffs every 80 ms', () => {
  const rng = createRng(1);
  let smoke = empty();
  for (let t = 0; t < 800; t += 16) smoke = emitPuffs(smoke, [{ trainId: 3, x: 10, y: 20 }], t, rng);
  expect(PUFF_EVERY_MS).toBe(80);
  expect(smoke.puffs).toHaveLength(10);
  expect(smoke.puffs.map((p) => p.born)).toEqual([0, 80, 160, 240, 320, 400, 480, 560, 640, 720]);
  expect(new Set(smoke.puffs.map((p) => p.id)).size).toBe(10);
});

test('each train puffs on its own, and a train that left stops being tracked', () => {
  const rng = createRng(2);
  let smoke = emitPuffs(empty(), [{ trainId: 1, x: 0, y: 0 }, { trainId: 2, x: 50, y: 0 }], 0, rng);
  expect(smoke.puffs).toHaveLength(2);
  expect(new Set(smoke.puffs.map((p) => p.id)).size).toBe(2);
  smoke = emitPuffs(smoke, [{ trainId: 2, x: 50, y: 0 }], 80, rng);
  expect([...smoke.lastEmit.keys()]).toEqual([2]);
});

test('old puffs fade away and are dropped', () => {
  const rng = createRng(3);
  let smoke = emitPuffs(empty(), [{ trainId: 1, x: 0, y: 0 }], 0, rng);
  smoke = emitPuffs(smoke, [{ trainId: 1, x: 0, y: 0 }], 500, rng);
  expect(PUFF_LIFE_MS).toBe(1100);
  expect(agePuffs(smoke, 1099).puffs.some((p) => p.born === 0)).toBe(true);
  expect(agePuffs(smoke, 1100).puffs.some((p) => p.born === 0)).toBe(false);
});

test('a puff grows from 2.5 to 10 units and fades from 0.5 to nothing', () => {
  const rng = createRng(4);
  const [puff] = emitPuffs(empty(), [{ trainId: 1, x: 100, y: 200 }], 1000, rng).puffs;
  expect(puffLook(puff, 1000)).toEqual({ x: 100, y: 200, r: 2.5, opacity: 0.5 });
  const end = puffLook(puff, 1000 + PUFF_LIFE_MS);
  expect(end.r).toBeCloseTo(10);
  expect(end.opacity).toBeCloseTo(0);
  const mid = puffLook(puff, 1550);
  expect(mid.r).toBeGreaterThan(2.5);
  expect(mid.r).toBeLessThan(10);
  expect(Math.hypot(mid.x - 100, mid.y - 200)).toBeLessThan(10);
});
