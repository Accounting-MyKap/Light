import { clampLevel, createStaircase, nextStartLevel, stepStaircase } from './difficulty';

test.each([
  [5, 0.85, 6],
  [5, 0.84, 5],
  [5, 0.6, 5],
  [5, 0.59, 4],
  [10, 1, 10],
  [1, 0, 1],
])('nextStartLevel(%d, %d) = %d', (l, a, e) => {
  expect(nextStartLevel(l, a)).toBe(e);
});

test('clampLevel', () => {
  expect(clampLevel(0)).toBe(1);
  expect(clampLevel(11)).toBe(10);
  expect(clampLevel(4)).toBe(4);
});

test('staircase: 4 correct up, 2 wrong down, clamps, maxLevel monotonic', () => {
  let s = createStaircase(3);
  for (let i = 0; i < 4; i++) s = stepStaircase(s, true);
  expect(s).toMatchObject({ level: 4, maxLevel: 4, correctStreak: 0 });
  s = stepStaircase(stepStaircase(stepStaircase(s, true), true), true);
  s = stepStaircase(s, false);
  s = stepStaircase(s, true);
  expect(s.level).toBe(4);
  s = stepStaircase(stepStaircase(s, false), false);
  expect(s).toMatchObject({ level: 3, maxLevel: 4 });
  let top = createStaircase(10);
  for (let i = 0; i < 4; i++) top = stepStaircase(top, true);
  expect(top.level).toBe(10);
  let low = createStaircase(1);
  low = stepStaircase(stepStaircase(low, false), false);
  expect(low.level).toBe(1);
});
