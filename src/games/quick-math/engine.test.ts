import { createRng } from '../../core/rng';
import {
  createQuickMathGame,
  deleteDigit,
  quickMathResult,
  skipProblem,
  submitAnswer,
  typeDigit,
  type QuickMathState,
} from './engine';

test('input rules', () => {
  let s = createQuickMathGame(1, createRng(1));
  s = typeDigit(typeDigit(s, 0), 5);
  expect(s.input).toBe('5');
  s = typeDigit(typeDigit(typeDigit(typeDigit(s, 1), 2), 3), 4);
  expect(s.input).toBe('5123');
  s = deleteDigit(deleteDigit(deleteDigit(deleteDigit(deleteDigit(s)))));
  expect(s.input).toBe('');
  const empty = submitAnswer(s, createRng(1));
  expect(empty.correct).toBeNull();
  expect(empty.state).toBe(s);
});

test('answer 0 is valid', () => {
  const r = createRng(2);
  const s: QuickMathState = { ...createQuickMathGame(1, r), problem: { a: 5, b: 5, op: '-', answer: 0 } };
  const typed = typeDigit(s, 0);
  expect(typed.input).toBe('0');
  expect(submitAnswer(typed, r).correct).toBe(true);
});

test('scoring and skip', () => {
  const r = createRng(3);
  let s = createQuickMathGame(1, r);
  for (const d of String(s.problem.answer)) s = typeDigit(s, Number(d));
  const ok = submitAnswer(s, r);
  expect(ok.correct).toBe(true);
  expect(ok.state).toMatchObject({ score: 11, correct: 1, total: 1, input: '' });
  let w = typeDigit(ok.state, ok.state.problem.answer === 9 ? 8 : 9);
  w = submitAnswer(w, r).state;
  expect(w).toMatchObject({ score: 1, correct: 1, total: 2 }); // 11 - 10 for the wrong answer
  const skipped = skipProblem(w, r);
  expect(skipped).toMatchObject({ total: 3, correct: 1, input: '', score: 1 }); // skipping costs nothing
  expect(skipped.problem).not.toBe(w.problem);
});

test('quickMathResult', () => {
  const r = createRng(4);
  let s = createQuickMathGame(1, r);
  for (const d of String(s.problem.answer)) s = typeDigit(s, Number(d));
  s = submitAnswer(s, r).state;
  s = skipProblem(s, r);
  expect(quickMathResult(s, 60_000)).toEqual({ score: 11, accuracy: 0.5, levelReached: 1, durationMs: 60_000 });
});

describe('wrong answers deduct points', () => {
  const withProblem = (score: number): QuickMathState => ({
    ...createQuickMathGame(1, createRng(41)),
    score,
    problem: { a: 2, b: 3, op: '+', answer: 5 },
  });
  test('a wrong answer costs 10 points, never below 0', () => {
    expect(submitAnswer(typeDigit(withProblem(50), 9), createRng(1)).state.score).toBe(40);
    expect(submitAnswer(typeDigit(withProblem(4), 9), createRng(1)).state.score).toBe(0);
  });
  test('skipping costs nothing', () => {
    expect(skipProblem(withProblem(50), createRng(1)).score).toBe(50);
  });
});
