import { createRng } from '../../core/rng';
import {
  ROUNDS,
  createSequenceGame,
  gridSizeForSpan,
  makeSequence,
  pressCell,
  sequenceResult,
  spanForLevel,
  type PressOutcome,
  type SequenceState,
} from './engine';

test.each([
  [1, 3],
  [10, 12],
])('spanForLevel(%d)=%d', (l, s) => expect(spanForLevel(l)).toBe(s));

test.each([
  [3, 3],
  [5, 3],
  [6, 4],
  [8, 4],
  [9, 5],
  [12, 5],
])('gridSizeForSpan(%d)=%d', (s, g) => expect(gridSizeForSpan(s)).toBe(g));

test('makeSequence', () => {
  const seq = makeSequence(5, 3, createRng(7));
  expect(seq).toHaveLength(5);
  seq.forEach((c) => {
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(9);
  });
  seq.slice(1).forEach((c, i) => expect(c).not.toBe(seq[i]));
});

test('full correct input scores span×10 and levels up', () => {
  const rng = createRng(1);
  let s = createSequenceGame(1, rng);
  const seq = s.sequence;
  let out: PressOutcome = 'continue';
  for (const c of seq) ({ state: s, outcome: out } = pressCell(s, c, rng));
  expect(out).toBe('round-correct');
  expect(s).toMatchObject({ score: 30, level: 2, maxLevel: 2, round: 1, correctRounds: 1, input: [] });
  expect(s.sequence).toHaveLength(4);
});

test('partial correct input continues', () => {
  const rng = createRng(1);
  const s = createSequenceGame(1, rng);
  const r = pressCell(s, s.sequence[0], rng);
  expect(r.outcome).toBe('continue');
  expect(r.state.input).toEqual([s.sequence[0]]);
});

test('wrong press ends round, drops level (min 1)', () => {
  const rng = createRng(2);
  let s = createSequenceGame(2, rng);
  const wrong = (s.sequence[0] + 1) % (s.gridSize * s.gridSize);
  const r = pressCell(s, wrong, rng);
  expect(r.outcome).toBe('round-wrong');
  expect(r.state).toMatchObject({ level: 1, score: 0, round: 1, correctRounds: 0, input: [] });
  s = createSequenceGame(1, rng);
  expect(pressCell(s, (s.sequence[0] + 1) % 9, rng).state.level).toBe(1);
});

function failRound(s: SequenceState, rng: ReturnType<typeof createRng>): SequenceState {
  const wrong = (s.sequence[0] + 1) % (s.gridSize * s.gridSize);
  return pressCell(s, wrong, rng).state;
}

test('finishes after 8 rounds and ignores further presses', () => {
  const rng = createRng(3);
  let s = createSequenceGame(1, rng);
  for (let i = 0; i < ROUNDS; i++) {
    expect(s.finished).toBe(false);
    s = failRound(s, rng);
  }
  expect(s.finished).toBe(true);
  const after = pressCell(s, 0, rng);
  expect(after.state).toBe(s);
  expect(after.outcome).toBe('continue');
});

test('sequenceResult', () => {
  const rng = createRng(4);
  let s = createSequenceGame(1, rng);
  for (let i = 0; i < 2; i++) {
    for (const c of s.sequence) s = pressCell(s, c, rng).state;
  }
  for (let i = 0; i < 6; i++) s = failRound(s, rng);
  expect(s.finished).toBe(true);
  expect(sequenceResult(s, 70_000)).toEqual({
    score: s.score,
    accuracy: 0.25,
    levelReached: s.maxLevel,
    durationMs: 70_000,
  });
  expect(s.maxLevel).toBe(3);
  expect(s.score).toBe(70);
});
