import { FALLBACKS } from './generator';
import { chooseColumns, layoutChallenge } from './ChallengeView';

test('one clue is always one column', () => {
  expect(chooseColumns(FALLBACKS[5], { width: 400, height: 200 })).toBe(1);
});

test('a tall phone stacks two clues, a short wide zone puts them side by side', () => {
  expect(chooseColumns(FALLBACKS[1], { width: 350, height: 500 })).toBe(1);
  expect(chooseColumns(FALLBACKS[1], { width: 350, height: 160 })).toBe(2);
});

test('four clues go two by two unless the zone is very tall', () => {
  expect(chooseColumns(FALLBACKS[4], { width: 280, height: 330 })).toBe(2);
  expect(chooseColumns(FALLBACKS[4], { width: 280, height: 2000 })).toBe(1);
});

test('before the zone is measured, two columns', () => {
  expect(chooseColumns(FALLBACKS[4], null)).toBe(2);
});

test('the layout of a «which way?» challenge puts the new balance, bigger, under the clues', () => {
  const one = layoutChallenge(FALLBACKS[6], 1);
  expect(one.clues.map((c) => c.y)).toEqual([0, 146]);
  expect(one.question?.y).toBeGreaterThan(146 + 130);
  const two = layoutChallenge(FALLBACKS[6], 2);
  expect(two.clues.map((c) => c.y)).toEqual([0, 0]);
  expect(two.width).toBeGreaterThan(one.width);
});
