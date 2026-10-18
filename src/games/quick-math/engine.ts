import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import { randInt, type Rng } from '../../core/rng';
import { accuracyOf, addPoints } from '../shared/scoring';
import type { GameResult } from '../types';

export type Op = '+' | '-' | '×' | '÷' | '+×';

export interface Problem {
  a: number;
  b: number;
  c?: number;
  op: Op;
  answer: number;
}

export const QUICK_MATH_MAX_SCORE = 8000;
export const QUICK_MATH_REFERENCE_SCORE = 500;
export const MAX_INPUT_DIGITS = 4;
/** A wrong answer costs this much; skipping costs nothing. */
export const QUICK_MATH_WRONG_PENALTY = 10;

const add = (a: number, b: number): Problem => ({ a, b, op: '+', answer: a + b });
const sub = (x: number, y: number): Problem => {
  const [a, b] = x >= y ? [x, y] : [y, x];
  return { a, b, op: '-', answer: a - b };
};
const mul = (a: number, b: number): Problem => ({ a, b, op: '×', answer: a * b });

export function makeProblem(level: number, rng: Rng): Problem {
  const n = (min: number, max: number) => randInt(rng, min, max);
  switch (clampLevel(level)) {
    case 1:
      return add(n(1, 9), n(1, 9));
    case 2:
      return rng() < 0.5 ? add(n(1, 9), n(1, 9)) : sub(n(1, 9), n(1, 9));
    case 3:
      return rng() < 0.5 ? add(n(10, 20), n(1, 9)) : sub(n(10, 20), n(1, 9));
    case 4:
      return mul(n(2, 5), n(2, 5));
    case 5:
      return mul(n(2, 9), n(2, 9));
    case 6:
      return add(n(10, 99), n(10, 99));
    case 7:
      return sub(n(10, 99), n(10, 99));
    case 8:
      return mul(n(11, 19), n(2, 9));
    case 9: {
      const b = n(2, 9);
      const quotient = n(2, 12);
      return { a: b * quotient, b, op: '÷', answer: quotient };
    }
    default: {
      const a = n(1, 20);
      const b = n(2, 9);
      const c = n(2, 9);
      return { a, b, c, op: '+×', answer: a + b * c };
    }
  }
}

export function formatProblem(p: Problem): string {
  switch (p.op) {
    case '+':
      return `${p.a} + ${p.b}`;
    case '-':
      return `${p.a} − ${p.b}`;
    case '×':
      return `${p.a} × ${p.b}`;
    case '÷':
      return `${p.a} ÷ ${p.b}`;
    case '+×':
      return `${p.a} + ${p.b} × ${p.c}`;
  }
}

export interface QuickMathState {
  staircase: Staircase;
  problem: Problem;
  input: string;
  score: number;
  correct: number;
  total: number;
}

export function createQuickMathGame(startLevel: number, rng: Rng): QuickMathState {
  const staircase = createStaircase(startLevel);
  return { staircase, problem: makeProblem(staircase.level, rng), input: '', score: 0, correct: 0, total: 0 };
}

export function typeDigit(state: QuickMathState, digit: number): QuickMathState {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
  if (state.input === '0') return { ...state, input: String(digit) };
  if (state.input.length >= MAX_INPUT_DIGITS) return state;
  return { ...state, input: state.input + String(digit) };
}

export function deleteDigit(state: QuickMathState): QuickMathState {
  return state.input === '' ? state : { ...state, input: state.input.slice(0, -1) };
}

function advance(state: QuickMathState, correct: boolean, penalize: boolean, rng: Rng): QuickMathState {
  const staircase = stepStaircase(state.staircase, correct);
  return {
    staircase,
    problem: makeProblem(staircase.level, rng),
    input: '',
    score: addPoints(state.score, correct ? 10 + state.staircase.level : penalize ? -QUICK_MATH_WRONG_PENALTY : 0),
    correct: state.correct + (correct ? 1 : 0),
    total: state.total + 1,
  };
}

export function submitAnswer(state: QuickMathState, rng: Rng): { state: QuickMathState; correct: boolean | null } {
  if (state.input === '') return { state, correct: null };
  const correct = Number(state.input) === state.problem.answer;
  return { state: advance(state, correct, !correct, rng), correct };
}

export function skipProblem(state: QuickMathState, rng: Rng): QuickMathState {
  return advance(state, false, false, rng);
}

export function quickMathResult(state: QuickMathState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
