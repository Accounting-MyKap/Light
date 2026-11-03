import { createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import type { Rng } from '../../core/rng';
import { makeProblem, type Problem } from '../shared/arithmetic';
import { accuracyOf, addPoints } from '../shared/scoring';
import type { GameResult } from '../types';

export const QUICK_MATH_MAX_SCORE = 8000;
export const QUICK_MATH_REFERENCE_SCORE = 500;
export const MAX_INPUT_DIGITS = 4;
/** A wrong answer costs this much; skipping costs nothing. */
export const QUICK_MATH_WRONG_PENALTY = 10;

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
