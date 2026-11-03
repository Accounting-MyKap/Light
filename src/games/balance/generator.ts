import { clampLevel } from '../../core/difficulty';
import { randInt, type Rng } from '../../core/rng';
import { FIGURE_IDS, type FigureId } from './figures';
import { determinedOutcome, outcomeOf, uniqueHeaviest, type Balance, type Outcome, type Pan, type Weights } from './solver';

export type ChallengeKind = 'heaviest' | 'tilt';

export type Challenge =
  | { kind: 'heaviest'; figures: FigureId[]; clues: Balance[]; answer: FigureId }
  | { kind: 'tilt'; figures: FigureId[]; clues: Balance[]; question: Balance; answer: Outcome };

const FIGURE_COUNTS = [3, 3, 4, 5, 2, 3, 3, 3, 4, 4];
const CLUE_COUNTS = [2, 2, 3, 4, 1, 2, 2, 2, 3, 3];
/** Most figures one pan holds. */
export const MAX_PAN = 6;
/** Hidden weights stay at or below this. */
const MAX_WEIGHT = 10;
const ATTEMPTS = 200;
const QUESTION_TRIES = 60;
const OUTCOMES: readonly Outcome[] = ['left', 'right', 'level'];

/** Levels 1–4 ask for the heaviest figure; levels 5–10, which way a new balance tips. */
export function challengeKind(level: number): ChallengeKind {
  return clampLevel(level) <= 4 ? 'heaviest' : 'tilt';
}

export function figureCountForLevel(level: number): number {
  return FIGURE_COUNTS[clampLevel(level) - 1];
}

export function clueCountForLevel(level: number): number {
  return CLUE_COUNTS[clampLevel(level) - 1];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const pick = <T,>(items: readonly T[], rng: Rng): T => items[randInt(rng, 0, items.length - 1)];
const repeat = (figure: FigureId, count: number): Pan => Array.from({ length: count }, () => figure);

/** A balance with its true outcome under the hidden weights. */
function weigh(left: Pan, right: Pan, weights: Weights): Balance {
  return { left, right, outcome: outcomeOf(left, right, weights) };
}

/** The same balance with its pans swapped (and its outcome mirrored). */
function mirror(b: Balance): Balance {
  const outcome = b.outcome === 'left' ? 'right' : b.outcome === 'right' ? 'left' : 'level';
  return { left: b.right, right: b.left, outcome };
}

const key = (pan: readonly FigureId[]) => [...pan].sort().join(',');
function sameBalance(a: Pick<Balance, 'left' | 'right'>, b: Pick<Balance, 'left' | 'right'>): boolean {
  return (
    (key(a.left) === key(b.left) && key(a.right) === key(b.right)) ||
    (key(a.left) === key(b.right) && key(a.right) === key(b.left))
  );
}

/** True when `big` holds every figure of `small` (with repeats): then the balance needs no clue to be read. */
function contains(big: readonly FigureId[], small: readonly FigureId[]): boolean {
  const left = [...big];
  return small.every((f) => {
    const i = left.indexOf(f);
    if (i === -1) return false;
    left.splice(i, 1);
    return true;
  });
}

// «Which is heaviest?» (levels 1–4).

function heaviest(level: number, rng: Rng): Challenge | null {
  const k = figureCountForLevel(level);
  // `order` goes from the heaviest to the lightest; the hidden weights are distinct and fall along it.
  const order = shuffle(FIGURE_IDS, rng).slice(0, k);
  const values = shuffle(
    Array.from({ length: MAX_WEIGHT }, (_, i) => i + 1),
    rng,
  )
    .slice(0, k)
    .sort((a, b) => b - a);
  const weights: Record<number, number> = Object.fromEntries(order.map((f, i) => [f, values[i]]));

  // Pairs (heavier, lighter): a chain at levels 1–3; at level 4 each figure meets a random heavier one (a tree),
  // and at least one figure never meets the heaviest.
  const pairs: [FigureId, FigureId][] =
    level <= 3
      ? order.slice(1).map((f, i) => [order[i], f])
      : order.slice(1).map((f, i) => [order[randInt(rng, 0, i)], f]);
  if (level === 4 && pairs.every(([heavier]) => heavier === order[0])) return null;

  let clues = pairs.map(([heavier, lighter]) => weigh([heavier], [lighter], weights));
  if (level >= 2) clues = shuffle(clues, rng).map((clue) => (rng() < 0.5 ? mirror(clue) : clue));

  const answer = uniqueHeaviest(order, clues);
  if (answer !== order[0]) return null;
  return { kind: 'heaviest', figures: shuffle(order, rng), clues, answer };
}

// «Which way will it tip?» (levels 5–10).

/** Hidden weights and the clues that state them, per the level's recipe. */
function tiltClues(level: number, figures: FigureId[], rng: Rng): { weights: Weights; clues: Balance[] } | null {
  const weights: Record<number, number> = {};
  const clues: Balance[] = [];
  const equivalence = (heavy: FigureId, light: FigureId) => {
    const times = weights[heavy] / weights[light];
    clues.push(weigh([heavy], repeat(light, times), weights));
  };

  if (level === 5) {
    const [a, b] = figures;
    weights[b] = randInt(rng, 1, 3);
    weights[a] = weights[b] * randInt(rng, 2, 3);
    equivalence(a, b);
  } else if (level <= 7) {
    // A = m1·B and B = m2·C, with C = 1 so A stays at or below 9.
    const [a, b, c] = figures;
    weights[c] = 1;
    weights[b] = randInt(rng, 2, 3);
    weights[a] = weights[b] * randInt(rng, 2, 3);
    equivalence(a, b);
    equivalence(b, c);
  } else if (level === 8) {
    // A = m·B, and a tipped clue between C and A.
    const [a, b, c] = figures;
    weights[b] = randInt(rng, 1, 2);
    weights[a] = weights[b] * randInt(rng, 2, 3);
    do weights[c] = randInt(rng, 1, MAX_WEIGHT);
    while (weights[c] === weights[a]);
    equivalence(a, b);
    clues.push(weigh([c], [a], weights));
  } else {
    // Levels 9–10: a tree of three equivalences from a base figure of weight 1, every weight distinct.
    const [base, ...rest] = figures;
    weights[base] = 1;
    const placed: FigureId[] = [base];
    for (const f of rest) {
      const options = placed.flatMap((p) =>
        [2, 3]
          .map((m) => ({ p, w: weights[p] * m }))
          .filter(({ w }) => w <= MAX_WEIGHT && !Object.values(weights).includes(w)),
      );
      if (options.length === 0) return null;
      const { p, w } = pick(options, rng);
      weights[f] = w;
      equivalence(f, p);
      placed.push(f);
    }
    // Level 10: half the time the last clue tips instead (the figure against a different, lighter or heavier one).
    if (level === 10 && rng() < 0.5) {
      const last = rest[rest.length - 1];
      const others = placed.filter((f) => f !== last && weights[f] !== weights[last]);
      clues[clues.length - 1] = weigh([last], [pick(others, rng)], weights);
    }
  }
  return {
    weights,
    clues: shuffle(clues, rng).map((clue) => (rng() < 0.5 ? mirror(clue) : clue)),
  };
}

/** Random pans for the new balance, per the level: one kind per pan at 5–6, mixed (2–3 kinds) from 7. */
function randomQuestionPans(level: number, figures: FigureId[], rng: Rng): [Pan, Pan] {
  const pan = (kinds: FigureId[]): Pan => {
    const total = randInt(rng, kinds.length, Math.min(MAX_PAN, kinds.length + 4));
    const counts = kinds.map(() => 1);
    for (let i = kinds.length; i < total; i++) counts[randInt(rng, 0, kinds.length - 1)]++;
    return kinds.flatMap((f, i) => repeat(f, counts[i]));
  };
  if (level <= 6) {
    const [x, y] = shuffle(figures, rng);
    return [pan([x]), pan([y])];
  }
  const maxKinds = level >= 9 ? 3 : 2;
  const kindsOf = () => shuffle(figures, rng).slice(0, randInt(rng, 1, maxKinds));
  let left = kindsOf();
  const right = kindsOf();
  // At least one pan mixes kinds.
  if (left.length < 2 && right.length < 2) left = shuffle(figures, rng).slice(0, 2);
  return [pan(left), pan(right)];
}

function tilt(level: number, target: Outcome, rng: Rng): Challenge | null {
  const figures = shuffle(FIGURE_IDS, rng).slice(0, figureCountForLevel(level));
  const made = tiltClues(level, figures, rng);
  if (!made) return null;
  const { weights, clues } = made;
  if (clues.some((clue, i) => clues.some((other, j) => j > i && sameBalance(clue, other)))) return null;

  for (let i = 0; i < QUESTION_TRIES; i++) {
    const [left, right] = randomQuestionPans(level, figures, rng);
    if (contains(left, right) || contains(right, left)) continue;
    if (outcomeOf(left, right, weights) !== target) continue;
    const question = { left, right, outcome: target };
    if (clues.some((clue) => sameBalance(clue, question))) continue;
    if (determinedOutcome(figures, clues, question) !== target) continue;
    return { kind: 'tilt', figures, clues, question, answer: target };
  }
  return null;
}

const level = (left: Pan, right: Pan): Balance => ({ left, right, outcome: 'level' });
const leftDown = (left: Pan, right: Pan): Balance => ({ left, right, outcome: 'left' });
const rightDown = (left: Pan, right: Pan): Balance => ({ left, right, outcome: 'right' });

/** Hand-made challenges, one per level, used only if every attempt to generate one failed. */
export const FALLBACKS: Record<number, Challenge> = {
  1: { kind: 'heaviest', figures: [1, 0, 2], clues: [leftDown([0], [1]), leftDown([1], [2])], answer: 0 },
  2: { kind: 'heaviest', figures: [2, 1, 0], clues: [rightDown([2], [1]), leftDown([0], [1])], answer: 0 },
  3: {
    kind: 'heaviest',
    figures: [3, 1, 0, 2],
    clues: [leftDown([1], [2]), rightDown([1], [0]), leftDown([2], [3])],
    answer: 0,
  },
  4: {
    kind: 'heaviest',
    figures: [4, 2, 0, 3, 1],
    clues: [leftDown([0], [1]), rightDown([2], [1]), leftDown([0], [3]), rightDown([4], [3])],
    answer: 0,
  },
  5: {
    kind: 'tilt',
    figures: [0, 1],
    clues: [level([0], [1, 1])],
    question: rightDown([0], [1, 1, 1]),
    answer: 'right',
  },
  6: {
    kind: 'tilt',
    figures: [0, 1, 2],
    clues: [level([0], [1, 1]), level([1], [2, 2, 2])],
    question: leftDown([0], [2, 2, 2, 2, 2]),
    answer: 'left',
  },
  7: {
    kind: 'tilt',
    figures: [0, 1, 2],
    clues: [level([0], [1, 1]), level([1], [2, 2])],
    question: level([0, 2], [1, 2, 2, 2]),
    answer: 'level',
  },
  8: {
    kind: 'tilt',
    figures: [0, 1, 2],
    clues: [level([0], [1, 1]), leftDown([2], [0])],
    question: leftDown([2], [1, 1]),
    answer: 'left',
  },
  9: {
    kind: 'tilt',
    figures: [3, 0, 1, 2],
    clues: [level([0], [3, 3]), level([1], [0, 0]), level([2], [3, 3, 3])],
    question: rightDown([2], [1]),
    answer: 'right',
  },
  10: {
    kind: 'tilt',
    figures: [3, 0, 1, 2],
    clues: [level([0], [3, 3]), level([1], [0, 0]), level([2], [3, 3, 3])],
    question: level([1, 3], [2, 0]),
    answer: 'level',
  },
};

/** A challenge for the level, whose answer the clues decide. */
export function makeChallenge(levelValue: number, rng: Rng): Challenge {
  const lvl = clampLevel(levelValue);
  // The outcome is drawn once, before any attempt, so an outcome that is harder to build («level») still comes up a
  // third of the time.
  const target = pick(OUTCOMES, rng);
  for (let i = 0; i < ATTEMPTS; i++) {
    const challenge = challengeKind(lvl) === 'heaviest' ? heaviest(lvl, rng) : tilt(lvl, target, rng);
    if (challenge) return challenge;
  }
  return FALLBACKS[lvl];
}
