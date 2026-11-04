import { createRng } from '../../core/rng';
import { speedBonus } from '../shared/scoring';
import {
  BALANCE_DURATION_MS,
  BALANCE_MAX_SCORE,
  BALANCE_REFERENCE_SCORE,
  BALANCE_WRONG_PENALTY,
  CORRECT_PAUSE_MS,
  WRONG_PAUSE_MS,
  answerBalance,
  balanceResult,
  balanceWindowMs,
  challengeOnScreen,
  choicesOf,
  createBalanceGame,
  type BalanceState,
  type Choice,
} from './engine';

const rng = () => createRng(42);
const wrongChoice = (s: BalanceState): Choice => choicesOf(s.challenge).find((c) => c !== s.challenge.answer)!;

test('the constants of the spec', () => {
  expect(BALANCE_DURATION_MS).toBe(90_000);
  expect(BALANCE_WRONG_PENALTY).toBe(15);
  expect(BALANCE_REFERENCE_SCORE).toBe(600);
  expect(BALANCE_MAX_SCORE).toBe(4000);
  expect(CORRECT_PAUSE_MS).toBe(600);
  expect(WRONG_PAUSE_MS).toBe(1200);
});

test('the speed window grows from 3 s at level 1 to 9 s at level 10', () => {
  expect(balanceWindowMs(1)).toBe(3000);
  expect(balanceWindowMs(10)).toBe(9000);
  expect(balanceWindowMs(4)).toBe(5000);
});

test('the choices: the figures of «which is heaviest?», the three outcomes of «which way?»', () => {
  const heavy = createBalanceGame(1, rng(), 0);
  expect(choicesOf(heavy.challenge)).toEqual(heavy.challenge.figures);
  const tilt = createBalanceGame(6, rng(), 0);
  expect(choicesOf(tilt.challenge)).toEqual(['left', 'level', 'right']);
});

test('a right answer earns 10 + level + the speed bonus', () => {
  const s = createBalanceGame(1, rng(), 0);
  const { state, correct } = answerBalance(s, s.challenge.answer, 500, rng());
  expect(correct).toBe(true);
  expect(state.score).toBe(10 + 1 + speedBonus(500, 3000));
  expect(state.correct).toBe(1);
  expect(state.total).toBe(1);
});

test('a wrong answer costs 15, and the score never goes below 0', () => {
  const s = { ...createBalanceGame(3, rng(), 0), score: 20 };
  const { state, correct } = answerBalance(s, wrongChoice(s), 2000, rng());
  expect(correct).toBe(false);
  expect(state.score).toBe(5);
  const again = answerBalance(state, wrongChoice(state), state.shownAt + 2000, rng()).state;
  expect(again.score).toBe(0);
});

test('an answer within 150 ms of the challenge appearing is ignored', () => {
  const s = createBalanceGame(1, rng(), 1000);
  expect(answerBalance(s, s.challenge.answer, 1100, rng())).toEqual({ state: s, correct: null });
});

test('after an answer the challenge stays on screen for the pause, then the next one shows', () => {
  const s = createBalanceGame(1, rng(), 0);
  const right = answerBalance(s, s.challenge.answer, 1000, rng()).state;
  expect(right.shownAt).toBe(1000 + CORRECT_PAUSE_MS);
  expect(challengeOnScreen(right, 1500)).toEqual({ challenge: s.challenge, last: right.last });
  expect(right.last).toEqual({ challenge: s.challenge, choice: s.challenge.answer, correct: true, until: 1600 });
  expect(challengeOnScreen(right, 1600)).toEqual({ challenge: right.challenge, last: null });

  const wrong = answerBalance(s, wrongChoice(s), 1000, rng()).state;
  expect(wrong.shownAt).toBe(1000 + WRONG_PAUSE_MS);
});

test('answers during the pause are ignored, so a double tap costs nothing twice', () => {
  const s = createBalanceGame(1, rng(), 0);
  const once = answerBalance(s, wrongChoice(s), 1000, rng()).state;
  expect(answerBalance(once, wrongChoice(once), 1100, rng())).toEqual({ state: once, correct: null });
  expect(answerBalance(once, once.challenge.answer, 2000, rng()).correct).toBeNull();
});

test('the speed bonus counts from when the next challenge appears, not from the answer before', () => {
  const s = createBalanceGame(1, rng(), 0);
  const first = answerBalance(s, s.challenge.answer, 1000, rng()).state;
  const at = first.shownAt + 400;
  const second = answerBalance(first, first.challenge.answer, at, rng()).state;
  expect(second.score - first.score).toBe(10 + 1 + speedBonus(400, 3000));
});

test('four right answers in a row raise the level, and the next challenge is of the new level', () => {
  let s = createBalanceGame(4, rng(), 0);
  for (let i = 0; i < 4; i++) s = answerBalance(s, s.challenge.answer, s.shownAt + 1000, rng()).state;
  expect(s.staircase.level).toBe(5);
  expect(s.challenge.kind).toBe('tilt');
});

test('two wrong answers in a row lower the level', () => {
  let s = createBalanceGame(5, rng(), 0);
  for (let i = 0; i < 2; i++) s = answerBalance(s, wrongChoice(s), s.shownAt + 1000, rng()).state;
  expect(s.staircase.level).toBe(4);
  expect(s.challenge.kind).toBe('heaviest');
});

test('the result: score, accuracy, highest level and duration', () => {
  let s = createBalanceGame(2, rng(), 0);
  s = answerBalance(s, s.challenge.answer, 1000, rng()).state;
  s = answerBalance(s, wrongChoice(s), s.shownAt + 1000, rng()).state;
  expect(balanceResult(s, 90_000)).toEqual({ score: s.score, accuracy: 0.5, levelReached: 2, durationMs: 90_000 });
});
