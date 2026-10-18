import { clampLevel, createStaircase, stepStaircase, type Staircase } from '../../core/difficulty';
import { pick, randInt, type Rng } from '../../core/rng';
import { MIN_RT_MS } from '../shared/constants';
import { accuracyOf, addPoints, speedBonus } from '../shared/scoring';
import type { GameResult } from '../types';

export type Shape = 'circle' | 'square' | 'triangle';
export type CardColor = 'blue' | 'orange' | 'purple';
export type Rule = 'color' | 'shape';
export type Side = 'left' | 'right';

export interface Card {
  shape: Shape;
  color: CardColor;
}

export const SHAPES: readonly Shape[] = ['circle', 'square', 'triangle'];
export const COLORS: readonly CardColor[] = ['blue', 'orange', 'purple'];

/** Every color has its own pattern so color is never the only cue. */
export const COLOR_STYLE: Record<CardColor, { hex: string; pattern: 'solid' | 'stripes' | 'dots' }> = {
  blue: { hex: '#3D7BFF', pattern: 'solid' },
  orange: { hex: '#FF9F1C', pattern: 'stripes' },
  purple: { hex: '#B05CFF', pattern: 'dots' },
};

export const RULE_SWITCH_MAX_SCORE = 10000;
export const RULE_SWITCH_REFERENCE_SCORE = 1400;
/** A wrong answer costs this much, so fast random guessing averages about 0. */
export const RULE_SWITCH_WRONG_PENALTY = 20;

export interface RuleTrial {
  stimulus: Card;
  left: Card;
  right: Card;
  correctSide: Side;
}

export function makeRuleTrial(rule: Rule, rng: Rng): RuleTrial {
  const stimulus: Card = { shape: pick(rng, SHAPES), color: pick(rng, COLORS) };
  const colorMatch: Card = { color: stimulus.color, shape: pick(rng, SHAPES.filter((s) => s !== stimulus.shape)) };
  const shapeMatch: Card = { shape: stimulus.shape, color: pick(rng, COLORS.filter((c) => c !== stimulus.color)) };
  const colorOnLeft = rng() < 0.5;
  const left = colorOnLeft ? colorMatch : shapeMatch;
  const right = colorOnLeft ? shapeMatch : colorMatch;
  const correctIsColor = rule === 'color';
  return { stimulus, left, right, correctSide: correctIsColor === colorOnLeft ? 'left' : 'right' };
}

export function baseSwitchInterval(level: number): number {
  return Math.round(6 - ((clampLevel(level) - 1) * 4) / 9);
}

export function switchInterval(level: number, rng: Rng): number {
  return Math.max(1, baseSwitchInterval(level) + randInt(rng, -1, 1));
}

export function ruleWindowMs(level: number): number {
  return Math.round(3000 - ((clampLevel(level) - 1) * 1800) / 9);
}

export interface RuleSwitchState {
  staircase: Staircase;
  rule: Rule;
  trialsUntilSwitch: number;
  justSwitched: boolean;
  trial: RuleTrial;
  trialStartedAt: number;
  score: number;
  correct: number;
  total: number;
}

export function createRuleSwitchGame(startLevel: number, rng: Rng, now: number): RuleSwitchState {
  const staircase = createStaircase(startLevel);
  const rule: Rule = rng() < 0.5 ? 'color' : 'shape';
  return {
    staircase,
    rule,
    trialsUntilSwitch: switchInterval(staircase.level, rng),
    justSwitched: false,
    trial: makeRuleTrial(rule, rng),
    trialStartedAt: now,
    score: 0,
    correct: 0,
    total: 0,
  };
}

function advance(state: RuleSwitchState, correct: boolean, points: number, now: number, rng: Rng): RuleSwitchState {
  const staircase = stepStaircase(state.staircase, correct);
  let rule = state.rule;
  let trialsUntilSwitch = state.trialsUntilSwitch - 1;
  let justSwitched = false;
  if (trialsUntilSwitch <= 0) {
    rule = rule === 'color' ? 'shape' : 'color';
    trialsUntilSwitch = switchInterval(staircase.level, rng);
    justSwitched = true;
  }
  return {
    staircase,
    rule,
    trialsUntilSwitch,
    justSwitched,
    trial: makeRuleTrial(rule, rng),
    trialStartedAt: now,
    score: addPoints(state.score, points),
    correct: state.correct + (correct ? 1 : 0),
    total: state.total + 1,
  };
}

export function answerRule(
  state: RuleSwitchState,
  side: Side,
  now: number,
  rng: Rng,
): { state: RuleSwitchState; correct: boolean | null } {
  const rt = now - state.trialStartedAt;
  if (rt < MIN_RT_MS) return { state, correct: null };
  const windowMs = ruleWindowMs(state.staircase.level);
  // A late answer counts as a miss, like a timeout, and costs nothing; only a wrong answer deducts.
  const late = rt > windowMs;
  const correct = !late && side === state.trial.correctSide;
  const points = correct
    ? 10 + speedBonus(rt, windowMs) + (state.justSwitched ? 5 : 0)
    : late
      ? 0
      : -RULE_SWITCH_WRONG_PENALTY;
  return { state: advance(state, correct, points, now, rng), correct };
}

export function timeoutRule(state: RuleSwitchState, now: number, rng: Rng): RuleSwitchState {
  return advance(state, false, 0, now, rng);
}

export function ruleSwitchResult(state: RuleSwitchState, durationMs: number): GameResult {
  return {
    score: state.score,
    accuracy: accuracyOf(state.correct, state.total),
    levelReached: state.staircase.maxLevel,
    durationMs,
  };
}
