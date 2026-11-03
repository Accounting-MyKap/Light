import { createRng } from '../../core/rng';
import type { FigureId } from './figures';
import {
  FALLBACKS,
  challengeKind,
  clueCountForLevel,
  figureCountForLevel,
  makeChallenge,
  type Challenge,
} from './generator';
import { consistentWeights, determinedOutcome, outcomeOf, uniqueHeaviest, type Balance, type Outcome } from './solver';

const SEEDS = 2000;
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The challenges of one level, one per seed, made once and shared by the tests below. */
const made = new Map<number, Challenge[]>();
function challenges(level: number): Challenge[] {
  if (!made.has(level)) {
    made.set(
      level,
      Array.from({ length: SEEDS }, (_, seed) => makeChallenge(level, createRng(seed + 1))),
    );
  }
  return made.get(level)!;
}

const sorted = (pan: readonly FigureId[]) => [...pan].sort().join(',');
const sameBalance = (a: Pick<Balance, 'left' | 'right'>, b: Pick<Balance, 'left' | 'right'>) =>
  (sorted(a.left) === sorted(b.left) && sorted(a.right) === sorted(b.right)) ||
  (sorted(a.left) === sorted(b.right) && sorted(a.right) === sorted(b.left));
const allBalances = (c: Challenge) => (c.kind === 'tilt' ? [...c.clues, c.question] : c.clues);

test('the recipe of each level: kind, figures and clues', () => {
  expect(LEVELS.map(challengeKind)).toEqual([...Array(4).fill('heaviest'), ...Array(6).fill('tilt')]);
  expect(LEVELS.map(figureCountForLevel)).toEqual([3, 3, 4, 5, 2, 3, 3, 3, 4, 4]);
  expect(LEVELS.map(clueCountForLevel)).toEqual([2, 2, 3, 4, 1, 2, 2, 2, 3, 3]);
});

describe.each(LEVELS)('level %i', (level) => {
  test('follows its recipe, with distinct figures and at most 6 on a pan', () => {
    for (const c of challenges(level)) {
      expect(c.kind).toBe(challengeKind(level));
      expect(c.figures).toHaveLength(figureCountForLevel(level));
      expect(new Set(c.figures).size).toBe(c.figures.length);
      expect(c.clues).toHaveLength(clueCountForLevel(level));
      for (const b of allBalances(c)) {
        for (const pan of [b.left, b.right]) {
          expect(pan.length).toBeGreaterThanOrEqual(1);
          expect(pan.length).toBeLessThanOrEqual(6);
          for (const f of pan) expect(c.figures).toContain(f);
        }
      }
    }
  });

  test('has one answer, and the clues can all be true at once', () => {
    for (const c of challenges(level)) {
      if (c.kind === 'heaviest') {
        // Any order of k figures can be had with weights 1 to k, so that range is enough to show the clues agree.
        expect(consistentWeights(c.figures, c.clues, c.figures.length).length).toBeGreaterThan(0);
        expect(uniqueHeaviest(c.figures, c.clues)).toBe(c.answer);
        continue;
      }
      expect(consistentWeights(c.figures, c.clues).length).toBeGreaterThan(0);
      expect(c.question.outcome).toBe(c.answer);
      expect(determinedOutcome(c.figures, c.clues, c.question)).toBe(c.answer);
    }
  }, 60_000);

  test('never repeats a balance on screen, and never falls back to the hand-made challenge', () => {
    for (const c of challenges(level)) {
      const balances = allBalances(c);
      for (let i = 0; i < balances.length; i++) {
        for (let j = i + 1; j < balances.length; j++) expect(sameBalance(balances[i], balances[j])).toBe(false);
      }
      expect(c).not.toBe(FALLBACKS[level]);
    }
  });
});

test('«which is heaviest?» clues weigh one figure against one, never level', () => {
  for (const level of [1, 2, 3, 4]) {
    for (const c of challenges(level)) {
      for (const clue of c.clues) {
        expect(clue.left).toHaveLength(1);
        expect(clue.right).toHaveLength(1);
        expect(clue.outcome).not.toBe('level');
      }
    }
  }
});

test('level 1 is a chain read from the left: the heavier figure is always on the left, the winner first', () => {
  for (const c of challenges(1)) {
    expect(c.clues.map((clue) => clue.outcome)).toEqual(['left', 'left']);
    expect(c.clues[0].left[0]).toBe(c.answer);
    expect(c.clues[1].left[0]).toBe(c.clues[0].right[0]);
  }
});

test('levels 2 to 4 put the heavier figure on either side', () => {
  for (const level of [2, 3, 4]) {
    const outcomes = challenges(level).flatMap((c) => c.clues.map((clue) => clue.outcome));
    expect(outcomes).toContain('left');
    expect(outcomes).toContain('right');
  }
});

test('level 4 always has a figure that is never weighed against the heaviest', () => {
  for (const c of challenges(4)) {
    const rivals = new Set(
      c.clues.filter((clue) => clue.left[0] === c.answer || clue.right[0] === c.answer).flatMap((clue) => [...clue.left, ...clue.right]),
    );
    expect(c.figures.some((f) => !rivals.has(f))).toBe(true);
  }
});

test('a tipped clue appears only where the recipe allows it: exactly one at level 8, at most one at level 10', () => {
  const tipped = (c: Challenge) => c.clues.filter((clue) => clue.outcome !== 'level').length;
  for (const level of [5, 6, 7, 9]) for (const c of challenges(level)) expect(tipped(c)).toBe(0);
  for (const c of challenges(8)) expect(tipped(c)).toBe(1);
  const atTen = challenges(10).map(tipped);
  expect(Math.max(...atTen)).toBe(1);
  expect(atTen).toContain(0);
});

test('levels 6 has one kind of figure per pan on the new balance; level 7 mixes kinds', () => {
  const kinds = (pan: readonly FigureId[]) => new Set(pan).size;
  for (const c of challenges(6)) {
    if (c.kind !== 'tilt') throw new Error('tilt expected');
    expect(kinds(c.question.left)).toBe(1);
    expect(kinds(c.question.right)).toBe(1);
  }
  for (const c of challenges(7)) {
    if (c.kind !== 'tilt') throw new Error('tilt expected');
    expect(Math.max(kinds(c.question.left), kinds(c.question.right))).toBeGreaterThanOrEqual(2);
  }
});

test.each([5, 6, 7, 8, 9, 10])('level %i: left, right and level each come up 25 to 42 % of the time', (level) => {
  const counts: Record<Outcome, number> = { left: 0, right: 0, level: 0 };
  for (const c of challenges(level)) counts[c.answer as Outcome]++;
  for (const outcome of ['left', 'right', 'level'] as const) {
    expect(counts[outcome] / SEEDS, outcome).toBeGreaterThanOrEqual(0.25);
    expect(counts[outcome] / SEEDS, outcome).toBeLessThanOrEqual(0.42);
  }
});

test('the hand-made fallbacks are valid challenges of their level', () => {
  for (const level of LEVELS) {
    const c = FALLBACKS[level];
    expect(c.kind).toBe(challengeKind(level));
    expect(c.figures).toHaveLength(figureCountForLevel(level));
    expect(c.clues).toHaveLength(clueCountForLevel(level));
    if (c.kind === 'heaviest') expect(uniqueHeaviest(c.figures, c.clues)).toBe(c.answer);
    else expect(determinedOutcome(c.figures, c.clues, c.question)).toBe(c.answer);
  }
});

test('the figures of a challenge are in no telling order', () => {
  // The heaviest figure is not always the first button.
  const firsts = challenges(3).map((c) => (c.kind === 'heaviest' ? c.figures[0] === c.answer : false));
  expect(firsts.filter(Boolean).length / SEEDS).toBeLessThan(0.4);
});

test('a challenge is quick to make: under 20 ms on average at every level', () => {
  for (const level of LEVELS) {
    const rng = createRng(99);
    const start = performance.now();
    for (let i = 0; i < 100; i++) makeChallenge(level, rng);
    expect((performance.now() - start) / 100, `level ${level}`).toBeLessThan(20);
  }
});

test('clues are true for the hidden weights the solver finds', () => {
  for (const c of challenges(8)) {
    const [vector] = consistentWeights(c.figures, c.clues);
    const weights = Object.fromEntries(c.figures.map((f, i) => [f, vector[i]]));
    for (const clue of c.clues) expect(outcomeOf(clue.left, clue.right, weights)).toBe(clue.outcome);
  }
});

test('the new balance always needs the clues: neither pan holds everything the other one does', () => {
  const contains = (big: readonly FigureId[], small: readonly FigureId[]) => {
    const left = [...big];
    return small.every((f) => {
      const i = left.indexOf(f);
      if (i === -1) return false;
      left.splice(i, 1);
      return true;
    });
  };
  for (const level of [5, 6, 7, 8, 9, 10]) {
    for (const c of challenges(level)) {
      if (c.kind !== 'tilt') continue;
      expect(contains(c.question.left, c.question.right) || contains(c.question.right, c.question.left)).toBe(false);
    }
  }
});
