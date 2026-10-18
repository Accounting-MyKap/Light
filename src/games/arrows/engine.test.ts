import { createRng } from '../../core/rng';
import {
  answerArrow,
  arrowWindowMs,
  arrowsResult,
  createArrowsGame,
  incongruentRatio,
  makeArrowTrial,
  timeoutArrow,
  type Direction,
} from './engine';

const opposite = (d: Direction): Direction => (d === 'left' ? 'right' : 'left');

test('level parameters', () => {
  expect(incongruentRatio(1)).toBeCloseTo(0.3);
  expect(incongruentRatio(10)).toBeCloseTo(0.7);
  expect(arrowWindowMs(1)).toBe(2000);
  expect(arrowWindowMs(10)).toBe(700);
});

test('incongruent frequency follows level', () => {
  const r = createRng(5);
  const n = 2000;
  const inc = Array.from({ length: n }, () => makeArrowTrial(10, r)).filter((t) => !t.congruent).length / n;
  expect(inc).toBeGreaterThan(0.65);
  expect(inc).toBeLessThan(0.75);
});

test('correct answer scores 10 + speed bonus', () => {
  const r = createRng(1);
  const s = createArrowsGame(1, r, 0);
  const { state, correct } = answerArrow(s, s.trial.direction, 1000, r);
  expect(correct).toBe(true);
  expect(state).toMatchObject({ score: 15, correct: 1, total: 1, trialStartedAt: 1000 });
});

test('wrong or late answers count as errors', () => {
  const r = createRng(1);
  const s = createArrowsGame(1, r, 0);
  expect(answerArrow(s, opposite(s.trial.direction), 500, r).state).toMatchObject({ score: 0, correct: 0, total: 1 });
  expect(answerArrow(s, s.trial.direction, 2001, r).correct).toBe(false);
});

test('answers faster than 150 ms are ignored (double tap)', () => {
  const r = createRng(1);
  const s = createArrowsGame(1, r, 0);
  const res = answerArrow(s, s.trial.direction, 149, r);
  expect(res.correct).toBeNull();
  expect(res.state).toBe(s);
});

test('timeout counts as error and starts new trial', () => {
  const r = createRng(1);
  const s = timeoutArrow(createArrowsGame(1, r, 0), 2000, r);
  expect(s).toMatchObject({ total: 1, correct: 0, trialStartedAt: 2000 });
});

test('arrowsResult', () => {
  const r = createRng(2);
  let s = createArrowsGame(1, r, 0);
  let now = 0;
  for (let i = 0; i < 3; i++) {
    now += 1000;
    s = answerArrow(s, s.trial.direction, now, r).state;
  }
  now += 1000;
  s = answerArrow(s, opposite(s.trial.direction), now, r).state;
  expect(arrowsResult(s, 60_000)).toEqual({
    score: s.score,
    accuracy: 0.75,
    levelReached: s.staircase.maxLevel,
    durationMs: 60_000,
  });
});
