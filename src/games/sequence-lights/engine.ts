import { clampLevel, MAX_LEVEL, MIN_LEVEL } from '../../core/difficulty';
import { randInt, type Rng } from '../../core/rng';
import { accuracyOf } from '../shared/scoring';
import type { GameResult } from '../types';

export const ROUNDS = 8;
export const SHOW_MS = 600;
export const GAP_MS = 250;
export const SEQUENCE_MAX_SCORE = 960;
export const SEQUENCE_REFERENCE_SCORE = 600;

export type GridSize = 3 | 4 | 5;

export function spanForLevel(level: number): number {
  return clampLevel(level) + 2;
}

export function gridSizeForSpan(span: number): GridSize {
  if (span <= 5) return 3;
  if (span <= 8) return 4;
  return 5;
}

export function makeSequence(span: number, gridSize: number, rng: Rng): number[] {
  const cells = gridSize * gridSize;
  const seq: number[] = [];
  while (seq.length < span) {
    const cell = randInt(rng, 0, cells - 1);
    if (cell !== seq[seq.length - 1]) seq.push(cell);
  }
  return seq;
}

export interface SequenceState {
  level: number;
  maxLevel: number;
  round: number;
  gridSize: GridSize;
  sequence: number[];
  input: number[];
  score: number;
  correctRounds: number;
  finished: boolean;
}

export type PressOutcome = 'continue' | 'round-correct' | 'round-wrong';

function withRound(level: number, rng: Rng): Pick<SequenceState, 'level' | 'gridSize' | 'sequence' | 'input'> {
  const span = spanForLevel(level);
  const gridSize = gridSizeForSpan(span);
  return { level, gridSize, sequence: makeSequence(span, gridSize, rng), input: [] };
}

export function createSequenceGame(startLevel: number, rng: Rng): SequenceState {
  const level = clampLevel(startLevel);
  return { ...withRound(level, rng), maxLevel: level, round: 0, score: 0, correctRounds: 0, finished: false };
}

function endRound(state: SequenceState, correct: boolean, rng: Rng): SequenceState {
  const level = correct ? Math.min(MAX_LEVEL, state.level + 1) : Math.max(MIN_LEVEL, state.level - 1);
  const round = state.round + 1;
  const finished = round >= ROUNDS;
  return {
    ...state,
    ...(finished ? { level, input: [] } : withRound(level, rng)),
    maxLevel: Math.max(state.maxLevel, level),
    round,
    score: correct ? state.score + state.sequence.length * 10 : state.score,
    correctRounds: correct ? state.correctRounds + 1 : state.correctRounds,
    finished,
  };
}

export function pressCell(
  state: SequenceState,
  cell: number,
  rng: Rng,
): { state: SequenceState; outcome: PressOutcome } {
  if (state.finished) return { state, outcome: 'continue' };
  if (cell !== state.sequence[state.input.length]) {
    return { state: endRound(state, false, rng), outcome: 'round-wrong' };
  }
  const input = [...state.input, cell];
  if (input.length === state.sequence.length) {
    return { state: endRound(state, true, rng), outcome: 'round-correct' };
  }
  return { state: { ...state, input }, outcome: 'continue' };
}

export function sequenceResult(state: SequenceState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correctRounds, ROUNDS),
    levelReached: state.maxLevel,
    durationMs,
  };
}
