import { FIGURES } from './figures';
import { consistentWeights, determinedOutcome, outcomeOf, panWeight, uniqueHeaviest, type Balance } from './solver';

const level = (left: Balance['left'], right: Balance['right']): Balance => ({ left, right, outcome: 'level' });
const leftDown = (left: Balance['left'], right: Balance['right']): Balance => ({ left, right, outcome: 'left' });

test('six figures, each with its own shape and color', () => {
  expect(FIGURES.map((f) => f.id)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(FIGURES.map((f) => f.shape)).toEqual(['circle', 'square', 'triangle', 'diamond', 'star', 'hexagon']);
  expect(FIGURES.map((f) => f.color)).toEqual(['#ffb52e', '#3fd4ff', '#ff5fd2', '#8dff6a', '#ff8f5e', '#eef1ff']);
});

test('a pan weighs the sum of its figures', () => {
  expect(panWeight([0, 1, 1], { 0: 4, 1: 2 })).toBe(8);
});

test('the heavier side goes down; equal sides stay level', () => {
  expect(outcomeOf([0], [1, 1], { 0: 4, 1: 2 })).toBe('level');
  expect(outcomeOf([0], [1], { 0: 4, 1: 2 })).toBe('left');
  expect(outcomeOf([1], [0], { 0: 4, 1: 2 })).toBe('right');
});

test('consistent weights keep every clue true', () => {
  const all = consistentWeights([0, 1], [level([0], [1, 1])], 6);
  expect(all).toEqual([
    [2, 1],
    [4, 2],
    [6, 3],
  ]);
});

test('a chain names one heaviest figure', () => {
  expect(uniqueHeaviest([0, 1, 2], [leftDown([0], [1]), leftDown([1], [2])])).toBe(0);
  // Read from the right: 1 beats 2, and 0 beats 1.
  expect(
    uniqueHeaviest([0, 1, 2], [
      { left: [2], right: [1], outcome: 'right' },
      { left: [1], right: [0], outcome: 'right' },
    ]),
  ).toBe(0);
});

test('two figures that both beat a third leave the heaviest open', () => {
  expect(uniqueHeaviest([0, 1, 2], [leftDown([0], [1]), leftDown([2], [1])])).toBeNull();
});

test('a figure no clue mentions leaves the heaviest open', () => {
  expect(uniqueHeaviest([0, 1, 2], [leftDown([0], [1])])).toBeNull();
});

test('an equivalence decides a new balance', () => {
  const clues = [level([0], [1, 1])];
  expect(determinedOutcome([0, 1], clues, { left: [0], right: [1, 1, 1] })).toBe('right');
  expect(determinedOutcome([0, 1], clues, { left: [0, 0], right: [1, 1, 1, 1] })).toBe('level');
  expect(determinedOutcome([0, 1], clues, { left: [0, 1], right: [1, 1] })).toBe('left');
});

test('a tilted clue decides some balances and leaves others open', () => {
  const clues = [level([0], [1, 1]), leftDown([2], [0])];
  expect(determinedOutcome([0, 1, 2], clues, { left: [2], right: [1] })).toBe('left');
  expect(determinedOutcome([0, 1, 2], clues, { left: [2], right: [1, 1, 1] })).toBeNull();
});

test('a balance with a figure no clue ties to the others is open', () => {
  expect(determinedOutcome([0, 1, 2], [level([0], [1, 1])], { left: [2], right: [1] })).toBeNull();
});
