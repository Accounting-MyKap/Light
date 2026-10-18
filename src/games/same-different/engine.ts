import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import { pick, type Rng } from '../../core/rng';
import { MIN_RT_MS } from '../shared/constants';
import { accuracyOf, addPoints } from '../shared/scoring';
import type { GameResult } from '../types';

export type SymbolId =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'cross'
  | 'tri-up'
  | 'tri-down'
  | 'tri-left'
  | 'tri-right'
  | 'diamond'
  | 'dot-tl'
  | 'dot-tr'
  | 'dot-bl'
  | 'dot-br'
  | 'dot-center'
  | 'dot-none';

export const SAME_DIFF_MAX_SCORE = 12000;
export const SAME_DIFF_REFERENCE_SCORE = 1500;
/** A wrong answer costs this much (and resets the streak), so random guessing averages about 0. */
export const SAME_DIFF_WRONG_PENALTY = 10;

const POOL_DISTINCT: readonly SymbolId[] = ['circle', 'square', 'triangle', 'star', 'heart', 'cross'];
const POOL_ORIENTED: readonly SymbolId[] = ['tri-up', 'tri-down', 'tri-left', 'tri-right', 'diamond', 'square'];
const POOL_DOTS: readonly SymbolId[] = ['dot-tl', 'dot-tr', 'dot-bl', 'dot-br', 'dot-center', 'dot-none'];

export function symbolPool(level: number): readonly SymbolId[] {
  const l = clampLevel(level);
  if (l <= 3) return POOL_DISTINCT;
  if (l <= 7) return POOL_ORIENTED;
  return POOL_DOTS;
}

export function timeLimitMs(level: number): number {
  return Math.round(3000 - ((clampLevel(level) - 1) * 2000) / 9);
}

export function streakMultiplier(streak: number): 1 | 2 | 3 {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  return 1;
}

export function nextSymbol(previous: SymbolId, level: number, rng: Rng): SymbolId {
  if (rng() < 0.5) return previous;
  return pick(
    rng,
    symbolPool(level).filter((s) => s !== previous),
  );
}

export interface SameDiffState {
  staircase: Staircase;
  previous: SymbolId;
  current: SymbolId;
  trialStartedAt: number;
  score: number;
  streak: number;
  correct: number;
  total: number;
}

export function createSameDiffGame(startLevel: number, rng: Rng, now: number): SameDiffState {
  const staircase = createStaircase(startLevel);
  const previous = pick(rng, symbolPool(staircase.level));
  return {
    staircase,
    previous,
    current: nextSymbol(previous, staircase.level, rng),
    trialStartedAt: now,
    score: 0,
    streak: 0,
    correct: 0,
    total: 0,
  };
}

function advance(state: SameDiffState, correct: boolean, penalize: boolean, now: number, rng: Rng): SameDiffState {
  const staircase = stepStaircase(state.staircase, correct);
  const streak = correct ? state.streak + 1 : 0;
  return {
    staircase,
    previous: state.current,
    current: nextSymbol(state.current, staircase.level, rng),
    trialStartedAt: now,
    score: addPoints(state.score, correct ? 10 * streakMultiplier(streak) : penalize ? -SAME_DIFF_WRONG_PENALTY : 0),
    streak,
    correct: state.correct + (correct ? 1 : 0),
    total: state.total + 1,
  };
}

export function answerSameDiff(
  state: SameDiffState,
  answer: 'same' | 'different',
  now: number,
  rng: Rng,
): { state: SameDiffState; correct: boolean | null } {
  const rt = now - state.trialStartedAt;
  if (rt < MIN_RT_MS) return { state, correct: null };
  // A late answer counts as a miss, like a timeout, and costs nothing; only a wrong answer deducts.
  const late = rt > timeLimitMs(state.staircase.level);
  const correct = !late && (answer === 'same') === (state.current === state.previous);
  return { state: advance(state, correct, !late, now, rng), correct };
}

export function timeoutSameDiff(state: SameDiffState, now: number, rng: Rng): SameDiffState {
  return advance(state, false, false, now, rng);
}

export function sameDiffResult(state: SameDiffState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
