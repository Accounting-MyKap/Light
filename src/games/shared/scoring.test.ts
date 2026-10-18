import { accuracyOf, speedBonus } from './scoring';

test.each([
  [0, 1000, 10],
  [500, 1000, 5],
  [1000, 1000, 0],
  [1500, 1000, 0],
])('speedBonus(%d,%d)=%d', (rt, w, e) => {
  expect(speedBonus(rt, w)).toBe(e);
});

test('accuracyOf', () => {
  expect(accuracyOf(0, 0)).toBe(0);
  expect(accuracyOf(3, 4)).toBe(0.75);
});
