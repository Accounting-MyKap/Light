import { createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import { shuffle, type Rng } from '../../core/rng';
import { correctIndex, type AnswerOutcome, type Question, type QuizRoundItem } from '../../quiz/types';
import { MIN_RT_MS } from '../shared/constants';
import { accuracyOf, addPoints, speedBonus } from '../shared/scoring';
import type { GameResult } from '../types';
import { pickQuestion } from './selection';

export const QUIZ_ROUND_LENGTH = 10;
export const QUIZ_QUESTION_MS = 20_000;
/** The last seconds of a question, when the time bar turns urgent (half of every question would be too much). */
export const QUIZ_URGENT_MS = 5_000;
export const QUIZ_CORRECT_POINTS = 20;
/** 10 questions × (20 + the maximum speed bonus of 10). */
export const QUIZ_MAX_SCORE = 300;
export const QUIZ_REFERENCE_SCORE = 200;
/** A wrong answer costs this much, so random guessing averages about 0; «No sé» and time-outs cost nothing. */
export const QUIZ_WRONG_PENALTY = { choice: 10, truefalse: 30 } as const;

export interface CurrentQuestion {
  question: Question;
  /** Canonical option indices in the order they are shown on screen. */
  order: number[];
  askedAt: number;
}

export interface QuizRoundState {
  pool: readonly Question[];
  /** questionId → last time it was answered (ms), as it was when the round started. */
  history: ReadonlyMap<string, number>;
  staircase: Staircase;
  score: number;
  correct: number;
  /** Resolved questions only: one per answered, skipped or timed-out question. */
  items: QuizRoundItem[];
  current: CurrentQuestion;
  phase: 'asking' | 'feedback' | 'finished';
}

function askQuestion(
  state: Pick<QuizRoundState, 'pool' | 'history' | 'staircase' | 'items'>,
  rng: Rng,
  now: number,
): CurrentQuestion | null {
  const question = pickQuestion({
    pool: state.pool,
    history: state.history,
    usedIds: new Set(state.items.map((item) => item.question.id)),
    askedCategories: state.items.map((item) => item.question.category),
    level: state.staircase.level,
    rng,
  });
  if (question === null) return null;
  const order = question.type === 'choice' ? shuffle(rng, [0, 1, 2, 3]) : [0, 1];
  return { question, order, askedAt: now };
}

/**
 * Starts a round with its first question. Throws if the pool has no question to ask: the UI only calls this
 * with a loaded bank of at least `QUIZ_ROUND_LENGTH` questions, so that is a programming error.
 */
export function createQuizRound(
  pool: readonly Question[],
  history: ReadonlyMap<string, number>,
  startLevel: number,
  rng: Rng,
  now: number,
): QuizRoundState {
  const base = { pool, history, staircase: createStaircase(startLevel), items: [] as QuizRoundItem[] };
  const current = askQuestion(base, rng, now);
  if (current === null) throw new Error('Cannot start a quiz round with an empty question pool');
  return { ...base, score: 0, correct: 0, current, phase: 'asking' };
}

/** Closes the current question: records the item, steps the staircase once and applies the points. */
function resolve(state: QuizRoundState, outcome: AnswerOutcome, chosen: number | null, points: number): QuizRoundState {
  const correct = outcome === 'correct';
  return {
    ...state,
    staircase: stepStaircase(state.staircase, correct),
    score: addPoints(state.score, points),
    correct: state.correct + (correct ? 1 : 0),
    items: [...state.items, { question: state.current.question, outcome, chosen }],
    phase: 'feedback',
  };
}

/** `shownIndex` is the position on screen; it is mapped through `current.order` to the canonical index. */
export function answerQuestion(state: QuizRoundState, shownIndex: number, now: number): QuizRoundState {
  if (state.phase !== 'asking') return state;
  const { question, order, askedAt } = state.current;
  if (!Number.isInteger(shownIndex) || shownIndex < 0 || shownIndex >= order.length) return state;
  const rt = now - askedAt;
  if (rt < MIN_RT_MS) return state;

  const chosen = order[shownIndex];
  if (chosen === correctIndex(question)) {
    return resolve(state, 'correct', chosen, QUIZ_CORRECT_POINTS + speedBonus(rt, QUIZ_QUESTION_MS));
  }
  return resolve(state, 'wrong', chosen, -QUIZ_WRONG_PENALTY[question.type]);
}

export function dontKnow(state: QuizRoundState): QuizRoundState {
  return state.phase === 'asking' ? resolve(state, 'skipped', null, 0) : state;
}

export function timeOutQuestion(state: QuizRoundState): QuizRoundState {
  return state.phase === 'asking' ? resolve(state, 'timeout', null, 0) : state;
}

/**
 * Moves from the feedback of one question to the next one, or to `finished` after the tenth. If the pool runs
 * out first (not possible with the real banks) the round also finishes early.
 */
export function nextQuestion(state: QuizRoundState, rng: Rng, now: number): QuizRoundState {
  if (state.phase !== 'feedback') return state;
  if (state.items.length >= QUIZ_ROUND_LENGTH) return { ...state, phase: 'finished' };
  const current = askQuestion(state, rng, now);
  if (current === null) return { ...state, phase: 'finished' };
  return { ...state, current, phase: 'asking' };
}

/** The most recently resolved question, for the feedback screen. */
export function lastItem(state: QuizRoundState): QuizRoundItem | undefined {
  return state.items[state.items.length - 1];
}

export function quizResult(state: QuizRoundState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, QUIZ_ROUND_LENGTH),
    levelReached: state.staircase.maxLevel,
    durationMs,
    quiz: { items: state.items },
  };
}
