import { createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import { pick, type Rng } from '../../core/rng';
import { makeProblem, type Problem } from '../shared/arithmetic';
import { accuracyOf, addPoints } from '../shared/scoring';
import type { GameResult } from '../types';

export const LANES = 3;
export const LIVES = 3;
export const BREAK_MS = 1500;
export const MAX_GAME_MS = 300_000;
export const COMET_CHANCE = 0.1;
export const PACE_RAMP_MS = 150_000;
export const MAX_INPUT_DIGITS = 3;
export const UNIQUE_TRIES = 50;
export const RETRY_SPAWN_MS = 200;
export const STAR_SHOWER_MAX_SCORE = 4000;
export const STAR_SHOWER_REFERENCE_SCORE = 600;

const START_INTERVAL_MS = 3200;
const END_INTERVAL_MS = 1400;
const START_FALL_MS = 9000;
const END_FALL_MS = 6000;

export interface Star {
  id: number;
  problem: Problem;
  /** Level it was created at; worth 10 + level points. */
  level: number;
  /** 0..LANES-1 */
  lane: number;
  /** Game-time ms. */
  bornAt: number;
  fallMs: number;
  comet: boolean;
}

export interface StarShowerState {
  stars: Star[];
  nextId: number;
  nextSpawnAt: number;
  lastLane: number | null;
  lives: number;
  /** End of the break in progress. */
  breakUntil: number | null;
  /** Total of finished breaks. */
  breakMs: number;
  staircase: Staircase;
  input: string;
  score: number;
  correct: number;
  wrong: number;
  lost: number;
  endedAt: number | null;
}

export type StarShowerEvent =
  | { kind: 'spawn'; star: Star }
  | { kind: 'lost'; star: Star; cleared: Star[] }
  | { kind: 'over'; reason: 'lives' | 'time' };

export type Outcome =
  | { kind: 'hit'; popped: Star[]; points: number }
  | { kind: 'comet'; popped: Star[]; points: number }
  | { kind: 'wrong' };

/** Pace after `paceMs` of play (breaks excluded): linear for PACE_RAMP_MS, then fixed. */
export function paceAt(paceMs: number): { intervalMs: number; fallMs: number } {
  const k = Math.min(1, Math.max(0, paceMs / PACE_RAMP_MS));
  return {
    intervalMs: Math.round(START_INTERVAL_MS + (END_INTERVAL_MS - START_INTERVAL_MS) * k),
    fallMs: Math.round(START_FALL_MS + (END_FALL_MS - START_FALL_MS) * k),
  };
}

// The rng is part of the signature for symmetry with the other games; the first star is born by `advance`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createStarShower(startLevel: number, _rng: Rng): StarShowerState {
  return {
    stars: [],
    nextId: 1,
    nextSpawnAt: 0,
    lastLane: null,
    lives: LIVES,
    breakUntil: null,
    breakMs: 0,
    staircase: createStaircase(startLevel),
    input: '',
    score: 0,
    correct: 0,
    wrong: 0,
    lost: 0,
    endedAt: null,
  };
}

/** Result of one spawn attempt at time `t`: a new state, plus the star unless no unique answer was found. */
function spawnAt(state: StarShowerState, t: number, rng: Rng): { state: StarShowerState; star: Star | null } {
  const onScreen = new Set(state.stars.map((s) => s.problem.answer));
  let problem: Problem | null = null;
  for (let i = 0; i < UNIQUE_TRIES; i++) {
    const candidate = makeProblem(state.staircase.level, rng);
    if (!onScreen.has(candidate.answer)) {
      problem = candidate;
      break;
    }
  }
  if (problem === null) return { state: { ...state, nextSpawnAt: t + RETRY_SPAWN_MS }, star: null };

  const lanes = Array.from({ length: LANES }, (_, i) => i).filter((l) => l !== state.lastLane);
  const lane = pick(rng, lanes);
  const comet = !state.stars.some((s) => s.comet) && rng() < COMET_CHANCE;
  const pace = paceAt(t - state.breakMs);
  const star: Star = {
    id: state.nextId,
    problem,
    level: state.staircase.level,
    lane,
    bornAt: t,
    fallMs: pace.fallMs,
    comet,
  };
  return {
    state: {
      ...state,
      stars: [...state.stars, star],
      nextId: state.nextId + 1,
      nextSpawnAt: t + pace.intervalMs,
      lastLane: lane,
    },
    star,
  };
}

/** Moves the game clock to `now`. Returns the same state object when nothing was due. */
export function advance(
  state: StarShowerState,
  now: number,
  rng: Rng,
): { state: StarShowerState; events: StarShowerEvent[] } {
  const events: StarShowerEvent[] = [];
  let current = state;
  while (current.endedAt === null) {
    const landing = current.stars.reduce((min, s) => Math.min(min, s.bornAt + s.fallMs), Infinity);
    const breakEnd = current.breakUntil ?? Infinity;
    const spawn = current.breakUntil === null ? current.nextSpawnAt : Infinity;
    const t = Math.min(landing, breakEnd, spawn, MAX_GAME_MS);
    if (t > now) break;

    // Ties at `t`: landing, then end of break, then spawn, then the time cap.
    if (landing === t) {
      const lander = current.stars.find((s) => s.bornAt + s.fallMs === t) as Star;
      const lives = current.lives - 1;
      events.push({ kind: 'lost', star: lander, cleared: current.stars.filter((s) => s !== lander) });
      current = {
        ...current,
        stars: [],
        lives,
        lost: current.lost + 1,
        breakUntil: lives === 0 ? null : t + BREAK_MS,
        endedAt: lives === 0 ? t : null,
      };
      if (lives === 0) events.push({ kind: 'over', reason: 'lives' });
    }
    if (current.endedAt !== null) break;
    if (current.breakUntil === t) {
      current = { ...current, breakMs: current.breakMs + BREAK_MS, breakUntil: null, nextSpawnAt: t };
    }
    if (current.breakUntil === null && current.nextSpawnAt === t) {
      const r = spawnAt(current, t, rng);
      current = r.state;
      if (r.star) events.push({ kind: 'spawn', star: r.star });
    }
    if (t === MAX_GAME_MS) {
      current = { ...current, endedAt: MAX_GAME_MS };
      events.push({ kind: 'over', reason: 'time' });
    }
  }
  return { state: current, events };
}

/** 0 at birth, 1 at the horizon. */
export function starHeight(star: Star, now: number): number {
  return Math.min(1, Math.max(0, (now - star.bornAt) / star.fallMs));
}

export function typeDigit(state: StarShowerState, digit: number): StarShowerState {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return state;
  if (state.input === '0') return { ...state, input: String(digit) };
  if (state.input.length >= MAX_INPUT_DIGITS) return state;
  return { ...state, input: state.input + String(digit) };
}

export function deleteDigit(state: StarShowerState): StarShowerState {
  return state.input === '' ? state : { ...state, input: state.input.slice(0, -1) };
}

export function submitAnswer(state: StarShowerState): { state: StarShowerState; outcome: Outcome | null } {
  if (state.input === '' || state.stars.length === 0 || state.endedAt !== null) {
    return { state, outcome: null };
  }
  const value = Number(state.input);
  const hit = state.stars.find((s) => s.problem.answer === value);
  if (!hit) {
    return {
      state: {
        ...state,
        input: '',
        wrong: state.wrong + 1,
        staircase: stepStaircase(state.staircase, false),
      },
      outcome: { kind: 'wrong' },
    };
  }
  const popped = hit.comet ? state.stars : [hit];
  const points = popped.reduce((sum, s) => sum + 10 + s.level, 0);
  return {
    state: {
      ...state,
      stars: hit.comet ? [] : state.stars.filter((s) => s !== hit),
      input: '',
      score: addPoints(state.score, points),
      correct: state.correct + 1,
      staircase: stepStaircase(state.staircase, true),
    },
    outcome: { kind: hit.comet ? 'comet' : 'hit', popped, points },
  };
}

/** Requires the game to have ended (`endedAt !== null`). */
export function starShowerResult(state: StarShowerState): GameResult {
  if (state.endedAt === null) throw new Error('starShowerResult called before the game ended');
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.correct + state.wrong + state.lost),
    levelReached: state.staircase.maxLevel,
    durationMs: state.endedAt,
  };
}
