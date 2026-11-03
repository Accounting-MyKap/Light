import { createRng, type Rng } from '../../core/rng';
import { makeChoice, makePool } from '../../test/quizFixtures';
import { TRIVIA_CATEGORIES, type Question, type QuizCategory } from '../../quiz/types';
import { OLDEST_SEEN_CHOICES, difficultyWeights, pickQuestion, type PickInput } from './selection';

const constantRng = (value: number): Rng => () => value;

function input(pool: readonly Question[], over: Partial<PickInput> = {}): PickInput {
  return {
    pool,
    history: new Map(),
    usedIds: new Set(),
    askedCategories: [],
    level: 1,
    rng: createRng(1),
    ...over,
  };
}

/** Pool with `perDifficulty` questions of each difficulty in each of the given categories. */
function multiPool(categories: readonly QuizCategory[], perDifficulty: number): Question[] {
  return categories.flatMap((c) => makePool(c, { 1: perDifficulty, 2: perDifficulty, 3: perDifficulty }));
}

test('difficulty weights by level band', () => {
  expect(difficultyWeights(1)).toEqual({ 1: 0.7, 2: 0.3, 3: 0 });
  expect(difficultyWeights(3)).toEqual({ 1: 0.7, 2: 0.3, 3: 0 });
  expect(difficultyWeights(4)).toEqual({ 1: 0.2, 2: 0.6, 3: 0.2 });
  expect(difficultyWeights(7)).toEqual({ 1: 0.2, 2: 0.6, 3: 0.2 });
  expect(difficultyWeights(8)).toEqual({ 1: 0, 2: 0.4, 3: 0.6 });
  expect(difficultyWeights(10)).toEqual({ 1: 0, 2: 0.4, 3: 0.6 });
});

test('draws the difficulty against cumulative weights in the order 1, 2, 3', () => {
  const pool = makePool('history', { 1: 3, 2: 3, 3: 3 });
  const drawn = (level: number, r: number) => pickQuestion(input(pool, { level, rng: constantRng(r) }))?.difficulty;
  expect(drawn(1, 0.69)).toBe(1);
  expect(drawn(1, 0.71)).toBe(2);
  expect(drawn(1, 0.999)).toBe(2);
  expect(drawn(5, 0.19)).toBe(1);
  expect(drawn(5, 0.2)).toBe(2);
  expect(drawn(5, 0.79)).toBe(2);
  expect(drawn(5, 0.81)).toBe(3);
  expect(drawn(9, 0)).toBe(2);
  expect(drawn(9, 0.39)).toBe(2);
  expect(drawn(9, 0.41)).toBe(3);
});

test('level 1 never picks a hard question while easy and medium remain', () => {
  const pool = multiPool(['history', 'science', 'math'], 5);
  for (let seed = 1; seed <= 300; seed++) {
    const q = pickQuestion(input(pool, { level: 1, rng: createRng(seed) }));
    expect(q).not.toBeNull();
    expect(q?.difficulty).not.toBe(3);
  }
});

test('prefers questions never answered', () => {
  const pool = makePool('history', { 1: 30, 2: 0, 3: 0 });
  const fresh = pool[17];
  const history = new Map(pool.filter((q) => q !== fresh).map((q, i) => [q.id, 1000 + i]));
  expect(history.size).toBe(29);
  for (let seed = 1; seed <= 100; seed++) {
    expect(pickQuestion(input(pool, { history, rng: createRng(seed) }))).toBe(fresh);
  }
});

test('when every question was answered, picks among the 10 oldest', () => {
  expect(OLDEST_SEEN_CHOICES).toBe(10);
  const pool = makePool('history', { 1: 30, 2: 0, 3: 0 });
  // Times 1..30 ms assigned out of pool order, so the pool order says nothing about age.
  const timeOf = new Map(pool.map((q, i) => [q.id, ((i * 7) % 30) + 1]));
  const seen = new Set<number>();
  for (let seed = 1; seed <= 300; seed++) {
    const q = pickQuestion(input(pool, { history: timeOf, rng: createRng(seed) }));
    const time = timeOf.get(q?.id ?? '') ?? Infinity;
    expect(time).toBeLessThanOrEqual(10);
    seen.add(time);
  }
  expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

describe('freshness across difficulties (40/40/20 bank)', () => {
  const pool = makePool('history', { 1: 40, 2: 40, 3: 20 });
  const seenAt = (questions: readonly Question[]) => new Map(questions.map((q, i) => [q.id, 1000 + i]));

  test('with every easy question answered, level 1 picks an unseen medium one', () => {
    const history = seenAt(pool.filter((q) => q.difficulty === 1));
    for (let seed = 1; seed <= 200; seed++) {
      const q = pickQuestion(input(pool, { history, level: 1, rng: createRng(seed) }));
      expect(q?.difficulty).toBe(2);
      expect(history.has(q?.id ?? '')).toBe(false);
    }
  });

  test('with every easy and medium question answered, level 1 picks an unseen hard one', () => {
    const history = seenAt(pool.filter((q) => q.difficulty !== 3));
    for (let seed = 1; seed <= 200; seed++) {
      const q = pickQuestion(input(pool, { history, level: 1, rng: createRng(seed) }));
      expect(q?.difficulty).toBe(3);
      expect(history.has(q?.id ?? '')).toBe(false);
    }
  });

  test('prefers unseen questions at weighted difficulties, nearest first, before weight-0 ones', () => {
    // Level 10 weighs 2 and 3 only. Hard all seen, drawn 3: unseen medium (weighted) wins over unseen easy.
    const drawnAt10 = (history: ReadonlyMap<string, number>, seed: number) =>
      pickQuestion(input(pool, { history, level: 10, rng: createRng(seed) }))?.difficulty;
    const hardSeen = seenAt(pool.filter((q) => q.difficulty === 3));
    for (let seed = 1; seed <= 100; seed++) expect(drawnAt10(hardSeen, seed)).toBe(2);
    // Medium and hard all seen: only easy (weight 0 at level 10) is still unseen.
    const mediumHardSeen = seenAt(pool.filter((q) => q.difficulty !== 1));
    for (let seed = 1; seed <= 100; seed++) expect(drawnAt10(mediumHardSeen, seed)).toBe(1);
  });

  test('looks for unseen questions across difficulties only inside the chosen category', () => {
    const mixed = [...pool, ...makePool('science', { 1: 2, 2: 0, 3: 0 })];
    const history = seenAt(mixed.filter((q) => q.category === 'science'));
    // science is the least used of the round, so it is chosen; all of it is seen → oldest-seen science.
    const asked: QuizCategory[] = ['history'];
    for (let seed = 1; seed <= 50; seed++) {
      expect(pickQuestion(input(mixed, { history, askedCategories: asked, rng: createRng(seed) }))?.category).toBe(
        'science',
      );
    }
  });

  test('with every question answered, picks among the 10 oldest of the drawn difficulty', () => {
    // Times assigned out of pool order; at level 1 hard is never drawn and easy/medium are fully seen.
    const history = new Map(pool.map((q, i) => [q.id, ((i * 37) % pool.length) + 1]));
    const oldestOf = (d: number) =>
      pool
        .filter((q) => q.difficulty === d)
        .sort((a, b) => (history.get(a.id) ?? 0) - (history.get(b.id) ?? 0))
        .slice(0, OLDEST_SEEN_CHOICES)
        .map((q) => q.id);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const q = pickQuestion(input(pool, { history, level: 1, rng: createRng(seed) }));
      expect(q).not.toBeNull();
      if (!q) return;
      expect(q.difficulty).not.toBe(3);
      expect(oldestOf(q.difficulty)).toContain(q.id);
      seen.add(q.id);
    }
    expect(seen.size).toBeGreaterThan(OLDEST_SEEN_CHOICES);
  });
});

test('the fresh pick is random among the unseen candidates', () => {
  const pool = makePool('history', { 1: 4, 2: 0, 3: 0 });
  const history = new Map([
    [pool[0].id, 10],
    [pool[2].id, 20],
  ]);
  const picked = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    picked.add(pickQuestion(input(pool, { history, rng: createRng(seed) }))?.id ?? '');
  }
  expect([...picked].sort()).toEqual([pool[1].id, pool[3].id]);
});

test('a two-way category tie is broken at random', () => {
  const pool = multiPool(['history', 'science'], 3);
  const picked = new Set<QuizCategory>();
  for (let seed = 1; seed <= 40; seed++) {
    const q = pickQuestion(input(pool, { rng: createRng(seed) }));
    if (q) picked.add(q.category);
  }
  expect([...picked].sort()).toEqual(['history', 'science']);
});

test('with fewer than 10 candidates all answered, picks among all of them', () => {
  const pool = makePool('history', { 1: 4, 2: 0, 3: 0 });
  const history = new Map(pool.map((q, i) => [q.id, 100 - i]));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) {
    const q = pickQuestion(input(pool, { history, rng: createRng(seed) }));
    seen.add(q?.id ?? '');
  }
  expect(seen.size).toBe(4);
});

test('never repeats a question within a round', () => {
  const pool = multiPool(['history', 'science', 'geography'], 2);
  for (let seed = 1; seed <= 20; seed++) {
    const rng = createRng(seed);
    const usedIds = new Set<string>();
    const askedCategories: QuizCategory[] = [];
    for (let i = 0; i < pool.length; i++) {
      const q = pickQuestion(input(pool, { usedIds, askedCategories, level: (i % 10) + 1, rng }));
      expect(q).not.toBeNull();
      if (!q) return;
      expect(usedIds.has(q.id)).toBe(false);
      usedIds.add(q.id);
      askedCategories.push(q.category);
    }
    expect(usedIds.size).toBe(pool.length);
    expect(pickQuestion(input(pool, { usedIds, askedCategories, rng }))).toBeNull();
  }
});

test('returns null for an empty pool', () => {
  expect(pickQuestion(input([]))).toBeNull();
});

test('fills a round from a pool of exactly 10 hard questions at level 1', () => {
  const pool = makePool('history', { 1: 0, 2: 0, 3: 10 });
  const rng = createRng(3);
  const usedIds = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const q = pickQuestion(input(pool, { usedIds, level: 1, rng }));
    expect(q).not.toBeNull();
    if (!q) return;
    expect(q.difficulty).toBe(3);
    usedIds.add(q.id);
  }
  expect(usedIds.size).toBe(10);
  expect(pickQuestion(input(pool, { usedIds, level: 1, rng }))).toBeNull();
});

test('falls back to the nearest difficulty, lower first', () => {
  const pool = [
    makeChoice('a-1', 'history', 1),
    makeChoice('a-2', 'history', 1),
    makeChoice('c-1', 'history', 3),
    makeChoice('c-2', 'history', 3),
  ];
  // Level 5 with r in [0.2, 0.8) draws difficulty 2, which the pool lacks: 1 wins the tie against 3.
  for (const r of [0.25, 0.5, 0.75]) {
    const q = pickQuestion(input(pool, { level: 5, rng: constantRng(r) }));
    expect(q?.difficulty).toBe(1);
  }
});

test('falls back upward when nothing lower exists, then to the farthest difficulty', () => {
  const onlyHard = makePool('history', { 1: 0, 2: 0, 3: 3 });
  // Level 1, r = 0.1 draws difficulty 1: neither 1 nor 2 exist, so ±2 reaches 3.
  expect(pickQuestion(input(onlyHard, { level: 1, rng: constantRng(0.1) }))?.difficulty).toBe(3);
  const onlyEasy = makePool('history', { 1: 3, 2: 0, 3: 0 });
  // Level 10, r = 0.9 draws difficulty 3: 2 is missing, then 1.
  expect(pickQuestion(input(onlyEasy, { level: 10, rng: constantRng(0.9) }))?.difficulty).toBe(1);
  const easyAndMedium = [makeChoice('e', 'history', 1), makeChoice('m', 'history', 2)];
  // Difficulty 3 drawn: nearest is 2, not 1.
  expect(pickQuestion(input(easyAndMedium, { level: 10, rng: constantRng(0.9) }))?.id).toBe('m');
  const mediumAndHard = [makeChoice('m', 'history', 2), makeChoice('h', 'history', 3)];
  // Difficulty 1 drawn: nearest is 2.
  expect(pickQuestion(input(mediumAndHard, { level: 1, rng: constantRng(0.1) }))?.id).toBe('m');
});

test('mix: no category three times in a row and at most 2 per category in 10 picks over 8 categories', () => {
  const pool = multiPool(TRIVIA_CATEGORIES, 4);
  for (let seed = 1; seed <= 50; seed++) {
    const rng = createRng(seed);
    const usedIds = new Set<string>();
    const asked: QuizCategory[] = [];
    for (let i = 0; i < 10; i++) {
      const q = pickQuestion(input(pool, { usedIds, askedCategories: asked, level: i + 1, rng }));
      expect(q).not.toBeNull();
      if (!q) return;
      usedIds.add(q.id);
      asked.push(q.category);
    }
    const counts = new Map<QuizCategory, number>();
    for (const c of asked) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    for (let i = 2; i < asked.length; i++) {
      expect(asked[i] === asked[i - 1] && asked[i] === asked[i - 2]).toBe(false);
    }
  }
});

test('picks among the least used categories of the round', () => {
  const pool = multiPool(['history', 'science', 'geography'], 3);
  const asked: QuizCategory[] = ['history', 'science', 'history'];
  for (let seed = 1; seed <= 50; seed++) {
    const q = pickQuestion(input(pool, { askedCategories: asked, rng: createRng(seed) }));
    expect(q?.category).toBe('geography');
  }
});

test('ignores categories with no unused questions, even if they are the least used', () => {
  const pool = multiPool(['history', 'science', 'geography'], 2);
  const usedIds = new Set(pool.filter((q) => q.category === 'geography').map((q) => q.id));
  const asked: QuizCategory[] = ['history', 'science', 'history', 'science'];
  for (let seed = 1; seed <= 50; seed++) {
    const q = pickQuestion(input(pool, { usedIds, askedCategories: asked, rng: createRng(seed) }));
    expect(q?.category).not.toBe('geography');
  }
});

test('drops the category of the last two questions when both were the same', () => {
  const pool = multiPool(['history', 'science'], 3);
  // history is the least used by far, but it was just asked twice in a row.
  const asked: QuizCategory[] = ['science', 'science', 'science', 'history', 'history'];
  for (let seed = 1; seed <= 50; seed++) {
    const q = pickQuestion(input(pool, { askedCategories: asked, rng: createRng(seed) }));
    expect(q?.category).toBe('science');
  }
});

test('keeps the repeated category when no other category has unused questions', () => {
  const pool = multiPool(['history', 'science'], 2);
  const usedIds = new Set(pool.filter((q) => q.category === 'science').map((q) => q.id));
  const asked: QuizCategory[] = ['history', 'history'];
  for (let seed = 1; seed <= 20; seed++) {
    const q = pickQuestion(input(pool, { usedIds, askedCategories: asked, rng: createRng(seed) }));
    expect(q?.category).toBe('history');
  }
});

test('the category step does not apply to a single-category pool', () => {
  const pool = makePool('history', { 1: 3, 2: 3, 3: 3 });
  const asked: QuizCategory[] = ['history', 'history'];
  for (let seed = 1; seed <= 20; seed++) {
    expect(pickQuestion(input(pool, { askedCategories: asked, rng: createRng(seed) }))).not.toBeNull();
  }
});

test('when the chosen category lacks the drawn difficulty, stays in the category and uses the nearest', () => {
  const pool = [
    makeChoice('h-easy', 'history', 1),
    makeChoice('s-hard', 'science', 3),
    makeChoice('s-medium', 'science', 2),
  ];
  // science is the least used and has no easy question: the nearest there is medium, not history's easy one.
  const asked: QuizCategory[] = ['history', 'history', 'science'];
  const q = pickQuestion(input(pool, { askedCategories: asked, level: 1, rng: constantRng(0.1) }));
  expect(q?.id).toBe('s-medium');
});

test('does not mutate its inputs', () => {
  const pool = Object.freeze(multiPool(['history', 'science'], 3));
  const poolIds = pool.map((q) => q.id);
  const history = new Map([[pool[0].id, 5]]);
  const usedIds = new Set([pool[1].id]);
  const asked: QuizCategory[] = ['history'];
  pickQuestion(input(pool, { history, usedIds, askedCategories: asked }));
  expect(pool.map((q) => q.id)).toEqual(poolIds);
  expect([...history]).toEqual([[pool[0].id, 5]]);
  expect([...usedIds]).toEqual([pool[1].id]);
  expect(asked).toEqual(['history']);
});

test('is deterministic for a given seed', () => {
  const pool = multiPool(TRIVIA_CATEGORIES, 4);
  const history = new Map(pool.filter((_, i) => i % 3 === 0).map((q, i) => [q.id, i]));
  const run = (seed: number) => {
    const rng = createRng(seed);
    const usedIds = new Set<string>();
    const asked: QuizCategory[] = [];
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const q = pickQuestion(input(pool, { history, usedIds, askedCategories: asked, level: i + 1, rng }));
      if (!q) throw new Error('pool exhausted');
      usedIds.add(q.id);
      asked.push(q.category);
      ids.push(q.id);
    }
    return ids;
  };
  expect(run(42)).toEqual(run(42));
  expect(run(42)).not.toEqual(run(43));
});
