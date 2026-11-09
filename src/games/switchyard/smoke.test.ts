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

test('a frame that comes a little late still gets the puffs it missed', () => {
  const rng = createRng(7);
  let smoke = emitPuffs(empty(), [{ trainId: 1, x: 0, y: 0 }], 0, rng);
  smoke = emitPuffs(smoke, [{ trainId: 1, x: 30, y: 0 }], 3 * PUFF_EVERY_MS, rng);
  expect(smoke.puffs.map((p) => p.born)).toEqual([0, 80, 160, 240]);
});

test('after a stalled frame the chimney lets out one puff, not a cloud of them on one spot', () => {
  const rng = createRng(8);
  let smoke = emitPuffs(empty(), [{ trainId: 1, x: 0, y: 0 }], 0, rng);
  // 1.5 s without a frame: the old rule back-filled 19 puffs at the chimney's new spot.
  smoke = emitPuffs(smoke, [{ trainId: 1, x: 120, y: 0 }], 1520, rng);
  expect(smoke.puffs.map((p) => p.born)).toEqual([0, 1520]);
  expect(smoke.puffs.filter((p) => p.x === 120)).toHaveLength(1);
  // And it goes on puffing at its usual pace from there.
  smoke = emitPuffs(smoke, [{ trainId: 1, x: 126, y: 0 }], 1600, rng);
  expect(smoke.puffs.map((p) => p.born)).toEqual([0, 1520, 1600]);
});

test('whatever the gap, a chimney never adds more than a few puffs in one frame', () => {
  const rng = createRng(9);
  for (const gap of [100, 250, 400, 1000, 5000, 60_000]) {
    const before = emitPuffs(empty(), [{ trainId: 1, x: 0, y: 0 }], 0, rng);
    const after = emitPuffs(before, [{ trainId: 1, x: 50, y: 0 }], gap, rng);
    expect(after.puffs.length - before.puffs.length, `gap ${gap}`).toBeLessThanOrEqual(3);
    expect(after.puffs.length - before.puffs.length, `gap ${gap}`).toBeGreaterThanOrEqual(1);
  }
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
  expect(PUFF_LIFE_MS).toBe(1500);
  expect(agePuffs(smoke, 1499).puffs.some((p) => p.born === 0)).toBe(true);
  expect(agePuffs(smoke, 1500).puffs.some((p) => p.born === 0)).toBe(false);
});

test('a puff grows from 3 to 15 units and fades from 0.6 to nothing', () => {
  const rng = createRng(4);
  const [puff] = emitPuffs(empty(), [{ trainId: 1, x: 100, y: 200 }], 1000, rng).puffs;
  expect(puffLook(puff, 1000)).toEqual({ x: 100, y: 200, r: 3, opacity: 0.6 });
  const end = puffLook(puff, 1000 + PUFF_LIFE_MS);
  expect(end.r).toBeCloseTo(15);
  expect(end.opacity).toBeCloseTo(0);
  const mid = puffLook(puff, 1750);
  expect(mid.r).toBeGreaterThan(3);
  expect(mid.r).toBeLessThan(15);
  expect(Math.hypot(mid.x - 100, mid.y - 200)).toBeLessThan(25);
});

test('smoke rises and trails behind the way the train faces', () => {
  const rng = createRng(5);
  let right = empty();
  let left = empty();
  for (let t = 0; t < 1600; t += 16) {
    right = emitPuffs(right, [{ trainId: 1, x: 0, y: 0, facing: 1 }], t, rng);
    left = emitPuffs(left, [{ trainId: 1, x: 0, y: 0, facing: -1 }], t, rng);
  }
  for (const p of right.puffs) {
    expect(p.dy).toBeLessThanOrEqual(-12);
    expect(p.dx).toBeLessThan(0);
  }
  for (const p of left.puffs) expect(p.dx).toBeGreaterThan(0);
});

test('a train seen from the front puffs its smoke straight up', () => {
  const rng = createRng(6);
  let smoke = empty();
  for (let t = 0; t < 1600; t += 16) smoke = emitPuffs(smoke, [{ trainId: 1, x: 0, y: 0, facing: 0 }], t, rng);
  for (const p of smoke.puffs) {
    expect(p.dy).toBeLessThanOrEqual(-12);
    expect(Math.abs(p.dx)).toBeLessThanOrEqual(3);
  }
});
