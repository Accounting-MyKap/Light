import { createRng } from '../../core/rng';
import {
  answerSameDiff,
  createSameDiffGame,
  nextSymbol,
  sameDiffResult,
  streakMultiplier,
  symbolPool,
  timeLimitMs,
  timeoutSameDiff,
  type SameDiffState,
} from './engine';

const rightAnswer = (s: SameDiffState) => (s.current === s.previous ? 'same' : 'different');
const wrongAnswer = (s: SameDiffState) => (s.current === s.previous ? 'different' : 'same');

test('pools and time limits by level', () => {
  expect(symbolPool(3)).toContain('heart');
  expect(symbolPool(4)).toContain('tri-up');
  expect(symbolPool(7)).toContain('diamond');
  expect(symbolPool(8)).toContain('dot-tl');
  expect(timeLimitMs(1)).toBe(3000);
  expect(timeLimitMs(10)).toBe(1000);
});

test.each([
  [4, 1],
  [5, 2],
  [9, 2],
  [10, 3],
])('streakMultiplier(%d)=%d', (s, m) => expect(streakMultiplier(s)).toBe(m));

test('nextSymbol is same ~50% and different never equals previous', () => {
  const r = createRng(9);
  let same = 0;
  for (let i = 0; i < 2000; i++) {
    const n = nextSymbol('circle', 2, r);
    if (n === 'circle') same++;
    else expect(symbolPool(2)).toContain(n);
  }
  expect(same / 2000).toBeGreaterThan(0.45);
  expect(same / 2000).toBeLessThan(0.55);
});

test('streak multiplies points and resets on error', () => {
  const r = createRng(1);
  let s = createSameDiffGame(1, r, 0);
  let now = 0;
  const points: number[] = [];
  for (let i = 0; i < 5; i++) {
    now += 200;
    const before = s.score;
    s = answerSameDiff(s, rightAnswer(s), now, r).state;
    points.push(s.score - before);
  }
  expect(points).toEqual([10, 10, 10, 10, 20]);
  expect(s.score).toBe(60);
  now += 200;
  s = answerSameDiff(s, wrongAnswer(s), now, r).state;
  expect(s).toMatchObject({ streak: 0, score: 50, correct: 5, total: 6 });
});

test('after answering, previous becomes old current', () => {
  const r = createRng(2);
  const s = createSameDiffGame(1, r, 0);
  const next = answerSameDiff(s, rightAnswer(s), 500, r).state;
  expect(next.previous).toBe(s.current);
  expect(next.trialStartedAt).toBe(500);
});

test('late answers are errors', () => {
  const r = createRng(3);
  const s = createSameDiffGame(1, r, 0);
  expect(answerSameDiff(s, rightAnswer(s), 3001, r).correct).toBe(false);
});

test('timeout is an error; answers under 150 ms are ignored', () => {
  const r = createRng(4);
  const s = createSameDiffGame(1, r, 0);
  const t = timeoutSameDiff({ ...s, streak: 3 }, 3000, r);
  expect(t).toMatchObject({ total: 1, correct: 0, streak: 0, trialStartedAt: 3000, previous: s.current });
  const fast = answerSameDiff(s, rightAnswer(s), 100, r);
  expect(fast.correct).toBeNull();
  expect(fast.state).toBe(s);
});

test('sameDiffResult', () => {
  const r = createRng(5);
  let s = createSameDiffGame(1, r, 0);
  s = answerSameDiff(s, rightAnswer(s), 300, r).state;
  s = answerSameDiff(s, wrongAnswer(s), 600, r).state;
  expect(sameDiffResult(s, 60_000)).toEqual({
    score: 0, // +10, then -10 for the mistake
    accuracy: 0.5,
    levelReached: s.staircase.maxLevel,
    durationMs: 60_000,
  });
});

describe('wrong answers deduct points', () => {
  test('a wrong answer costs 10 points and resets the streak, never below 0', () => {
    const r = createRng(31);
    const s = { ...createSameDiffGame(1, r, 0), score: 50, streak: 3 };
    expect(answerSameDiff(s, wrongAnswer(s), 500, r).state).toMatchObject({ score: 40, streak: 0 });
    expect(answerSameDiff({ ...s, score: 4 }, wrongAnswer(s), 500, r).state.score).toBe(0);
  });
  test('late answers and timeouts cost nothing', () => {
    const r = createRng(32);
    const s = { ...createSameDiffGame(1, r, 0), score: 50 };
    expect(answerSameDiff(s, wrongAnswer(s), 3001, r).state.score).toBe(50);
    expect(timeoutSameDiff(s, 3000, r).score).toBe(50);
  });
});
