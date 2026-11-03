import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import type { Rng } from '../../core/rng';
import { MIN_RT_MS } from '../shared/constants';
import { accuracyOf, addPoints, speedBonus } from '../shared/scoring';
import type { GameResult } from '../types';
import type { FigureId } from './figures';
import { makeChallenge, type Challenge } from './generator';
import type { Outcome } from './solver';

export const BALANCE_DURATION_MS = 90_000;
/** A wrong answer costs this much, so fast random guessing averages 0 or less. */
export const BALANCE_WRONG_PENALTY = 15;
export const BALANCE_REFERENCE_SCORE = 600;
/** Theoretical ceiling: 90 s ÷ 0.75 s a challenge × 30 points = 3 600. */
export const BALANCE_MAX_SCORE = 4000;
/** How long an answered challenge stays on screen: short after a hit, longer after a miss to show the right one. */
export const CORRECT_PAUSE_MS = 600;
export const WRONG_PAUSE_MS = 1200;

/** A figure («which is heaviest?») or an outcome («which way will it tip?»). */
export type Choice = FigureId | Outcome;

export interface LastAnswer {
  challenge: Challenge;
  choice: Choice;
  correct: boolean;
  /** Game time when its pause ends and the next challenge shows. */
  until: number;
}

export interface BalanceState {
  staircase: Staircase;
  challenge: Challenge;
  /** Game time when `challenge` is on screen and its answer time starts. */
  shownAt: number;
  last: LastAnswer | null;
  score: number;
  correct: number;
  total: number;
}

/** The speed-bonus window: 3 s at level 1 up to 9 s at level 10, since harder challenges ask for more thought. */
export function balanceWindowMs(level: number): number {
  return Math.round(3000 + ((clampLevel(level) - 1) * 6000) / 9);
}

const OUTCOME_CHOICES: readonly Outcome[] = ['left', 'level', 'right'];

/** The answers on offer, in the order of the buttons. */
export function choicesOf(challenge: Challenge): Choice[] {
  return challenge.kind === 'heaviest' ? [...challenge.figures] : [...OUTCOME_CHOICES];
}

export function createBalanceGame(startLevel: number, rng: Rng, now: number): BalanceState {
  const staircase = createStaircase(startLevel);
  return {
    staircase,
    challenge: makeChallenge(staircase.level, rng),
    shownAt: now,
    last: null,
    score: 0,
    correct: 0,
    total: 0,
  };
}

/**
 * Answers the challenge on screen. Ignored (`correct: null`) during the pause after the last answer and within
 * MIN_RT_MS of the challenge appearing. The next challenge, of the level after this answer, shows after the pause.
 */
export function answerBalance(
  state: BalanceState,
  choice: Choice,
  now: number,
  rng: Rng,
): { state: BalanceState; correct: boolean | null } {
  const rt = now - state.shownAt;
  if (rt < MIN_RT_MS) return { state, correct: null };
  const level = state.staircase.level;
  const correct = choice === state.challenge.answer;
  const points = correct ? 10 + level + speedBonus(rt, balanceWindowMs(level)) : -BALANCE_WRONG_PENALTY;
  const staircase = stepStaircase(state.staircase, correct);
  const until = now + (correct ? CORRECT_PAUSE_MS : WRONG_PAUSE_MS);
  return {
    state: {
      staircase,
      challenge: makeChallenge(staircase.level, rng),
      shownAt: until,
      last: { challenge: state.challenge, choice, correct, until },
      score: addPoints(state.score, points),
      correct: state.correct + (correct ? 1 : 0),
      total: state.total + 1,
    },
    correct,
  };
}

/** What to draw: the answered challenge with its answer during the pause, the current one after. */
export function challengeOnScreen(state: BalanceState, now: number): { challenge: Challenge; last: LastAnswer | null } {
  if (state.last && now < state.last.until) return { challenge: state.last.challenge, last: state.last };
  return { challenge: state.challenge, last: null };
}

export function balanceResult(state: BalanceState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
