import { createRng } from '../../core/rng';
import {
  answerRule,
  baseSwitchInterval,
  COLOR_STYLE,
  createRuleSwitchGame,
  makeRuleTrial,
  ruleSwitchResult,
  ruleWindowMs,
  switchInterval,
  timeoutRule,
  type RuleSwitchState,
  type Side,
} from './engine';

const other = (s: Side): Side => (s === 'left' ? 'right' : 'left');

test('trial invariants', () => {
  const r = createRng(3);
  for (let i = 0; i < 500; i++) {
    for (const rule of ['color', 'shape'] as const) {
      const t = makeRuleTrial(rule, r);
      const sides = [t.left, t.right];
      const colorOnly = sides.filter((c) => c.color === t.stimulus.color && c.shape !== t.stimulus.shape);
      const shapeOnly = sides.filter((c) => c.shape === t.stimulus.shape && c.color !== t.stimulus.color);
      expect(colorOnly).toHaveLength(1);
      expect(shapeOnly).toHaveLength(1);
      const target = t.correctSide === 'left' ? t.left : t.right;
      expect(target).toBe(rule === 'color' ? colorOnly[0] : shapeOnly[0]);
    }
  }
});

test('color styles pair every color with its own pattern', () => {
  expect(COLOR_STYLE.blue).toEqual({ hex: '#3D7BFF', pattern: 'solid' });
  expect(COLOR_STYLE.orange).toEqual({ hex: '#FF9F1C', pattern: 'stripes' });
  expect(COLOR_STYLE.purple).toEqual({ hex: '#B05CFF', pattern: 'dots' });
});

test('switch intervals and windows', () => {
  expect(baseSwitchInterval(1)).toBe(6);
  expect(baseSwitchInterval(10)).toBe(2);
  const r = createRng(4);
  for (let i = 0; i < 200; i++) {
    const v = switchInterval(10, r);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(3);
  }
  expect(ruleWindowMs(1)).toBe(3000);
  expect(ruleWindowMs(10)).toBe(1200);
});

test('rule flips when countdown reaches zero and marks justSwitched', () => {
  const r = createRng(5);
  const s: RuleSwitchState = { ...createRuleSwitchGame(1, r, 0), trialsUntilSwitch: 1 };
  const flipped = answerRule(s, s.trial.correctSide, 1000, r).state;
  expect(flipped.rule).not.toBe(s.rule);
  expect(flipped.justSwitched).toBe(true);
  expect(flipped.trialsUntilSwitch).toBeGreaterThanOrEqual(5);
  const next = answerRule(flipped, flipped.trial.correctSide, 2000, r).state;
  expect(next.justSwitched).toBe(false);
  expect(next.rule).toBe(flipped.rule);
});

test('scoring: 10 + speed bonus, +5 right after a switch', () => {
  const r = createRng(6);
  const s = createRuleSwitchGame(1, r, 0);
  expect(answerRule(s, s.trial.correctSide, 1500, r).state.score).toBe(15);
  expect(answerRule({ ...s, justSwitched: true }, s.trial.correctSide, 1500, r).state.score).toBe(20);
  expect(answerRule(s, other(s.trial.correctSide), 1500, r).state).toMatchObject({ score: 0, total: 1, correct: 0 });
});

test('timeout and fast answers', () => {
  const r = createRng(7);
  const s = createRuleSwitchGame(1, r, 0);
  expect(timeoutRule(s, 3000, r)).toMatchObject({ total: 1, correct: 0, trialStartedAt: 3000 });
  expect(timeoutRule(s, 3000, r).trialsUntilSwitch).toBe(s.trialsUntilSwitch - 1);
  const fast = answerRule(s, s.trial.correctSide, 100, r);
  expect(fast.correct).toBeNull();
  expect(fast.state).toBe(s);
  expect(answerRule(s, s.trial.correctSide, 3001, r).correct).toBe(false);
});

test('ruleSwitchResult', () => {
  const r = createRng(8);
  let s = createRuleSwitchGame(1, r, 0);
  s = answerRule(s, s.trial.correctSide, 500, r).state;
  s = answerRule(s, other(s.trial.correctSide), 1000, r).state;
  expect(ruleSwitchResult(s, 60_000)).toEqual({
    score: s.score,
    accuracy: 0.5,
    levelReached: s.staircase.maxLevel,
    durationMs: 60_000,
  });
});

describe('wrong answers deduct points', () => {
  test('a wrong answer costs 20 points, never below 0', () => {
    const r = createRng(21);
    const s = { ...createRuleSwitchGame(1, r, 0), score: 50 };
    expect(answerRule(s, other(s.trial.correctSide), 1000, r).state.score).toBe(30);
    expect(answerRule({ ...s, score: 5 }, other(s.trial.correctSide), 1000, r).state.score).toBe(0);
  });
  test('late answers and timeouts cost nothing', () => {
    const r = createRng(22);
    const s = { ...createRuleSwitchGame(1, r, 0), score: 50 };
    expect(answerRule(s, other(s.trial.correctSide), 3001, r).state.score).toBe(50);
    expect(timeoutRule(s, 3000, r).score).toBe(50);
  });
});
