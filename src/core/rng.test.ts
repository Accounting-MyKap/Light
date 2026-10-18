import { createRng, randInt, seedFromString, shuffle, pick, randomSeed } from './rng';

test('rng is deterministic and in range', () => {
  const a = createRng(42);
  const b = createRng(42);
  const xs = Array.from({ length: 5 }, a);
  expect(Array.from({ length: 5 }, b)).toEqual(xs);
  xs.forEach((x) => {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});

test('randInt covers inclusive range only', () => {
  const r = createRng(1);
  const seen = new Set(Array.from({ length: 1000 }, () => randInt(r, 1, 3)));
  expect([...seen].sort()).toEqual([1, 2, 3]);
});

test('seedFromString', () => {
  expect(seedFromString('2026-10-18')).toBe(seedFromString('2026-10-18'));
  expect(seedFromString('2026-10-18')).not.toBe(seedFromString('2026-10-19'));
});

test('shuffle is a permutation and does not mutate input', () => {
  const input = [1, 2, 3, 4];
  expect(shuffle(createRng(3), input).sort()).toEqual([1, 2, 3, 4]);
  expect(input).toEqual([1, 2, 3, 4]);
});

test('pick returns an element', () => {
  expect(['a', 'b']).toContain(pick(createRng(5), ['a', 'b']));
});

test('randomSeed is a uint32', () => {
  const s = randomSeed();
  expect(Number.isInteger(s)).toBe(true);
  expect(s).toBeGreaterThanOrEqual(0);
  expect(s).toBeLessThan(2 ** 32);
});
