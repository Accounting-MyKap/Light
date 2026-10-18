import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import type { Rng } from '../../core/rng';
import { MIN_RT_MS } from '../shared/constants';
import { accuracyOf, addPoints, speedBonus } from '../shared/scoring';
import type { GameResult } from '../types';

export type Direction = 'left' | 'right';

export interface ArrowTrial {
  direction: Direction;
  congruent: boolean;
}

export const ARROWS_MAX_SCORE = 8000;
export const ARROWS_REFERENCE_SCORE = 1400;
/** A wrong answer costs this much, so fast random guessing averages about 0. */
export const ARROWS_WRONG_PENALTY = 20;

export function incongruentRatio(level: number): number {
  return 0.3 + ((clampLevel(level) - 1) * 0.4) / 9;
}

export function arrowWindowMs(level: number): number {
  return Math.round(2000 - ((clampLevel(level) - 1) * 1300) / 9);
}

export function makeArrowTrial(level: number, rng: Rng): ArrowTrial {
  return {
    direction: rng() < 0.5 ? 'left' : 'right',
    congruent: rng() >= incongruentRatio(level),
  };
}

export interface ArrowsState {
  staircase: Staircase;
  trial: ArrowTrial;
  trialStartedAt: number;
  score: number;
  correct: number;
  total: number;
}

export function createArrowsGame(startLevel: number, rng: Rng, now: number): ArrowsState {
  const staircase = createStaircase(startLevel);
  return { staircase, trial: makeArrowTrial(staircase.level, rng), trialStartedAt: now, score: 0, correct: 0, total: 0 };
}

function advance(state: ArrowsState, correct: boolean, points: number, now: number, rng: Rng): ArrowsState {
  const staircase = stepStaircase(state.staircase, correct);
  return {
    staircase,
    trial: makeArrowTrial(staircase.level, rng),
    trialStartedAt: now,
    score: addPoints(state.score, points),
    correct: state.correct + (correct ? 1 : 0),
    total: state.total + 1,
  };
}

export function answerArrow(
  state: ArrowsState,
  answer: Direction,
  now: number,
  rng: Rng,
): { state: ArrowsState; correct: boolean | null } {
  const rt = now - state.trialStartedAt;
  if (rt < MIN_RT_MS) return { state, correct: null };
  const windowMs = arrowWindowMs(state.staircase.level);
  // A late answer counts as a miss, like a timeout, and costs nothing; only a wrong answer deducts.
  const late = rt > windowMs;
  const correct = !late && answer === state.trial.direction;
  const points = correct ? 10 + speedBonus(rt, windowMs) : late ? 0 : -ARROWS_WRONG_PENALTY;
  return { state: advance(state, correct, points, now, rng), correct };
}

export function timeoutArrow(state: ArrowsState, now: number, rng: Rng): ArrowsState {
  return advance(state, false, 0, now, rng);
}

export function arrowsResult(state: ArrowsState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
