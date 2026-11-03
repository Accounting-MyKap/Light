import type { FigureId } from './figures';

/** The figures on one pan, with repeats (two squares are `[1, 1]`). */
export type Pan = FigureId[];
/** `left`: the left pan is heavier and goes down; `right`: the right one; `level`: they weigh the same. */
export type Outcome = 'left' | 'right' | 'level';

export interface Balance {
  left: Pan;
  right: Pan;
  outcome: Outcome;
}

export type Weights = Readonly<Record<number, number>>;

export function panWeight(pan: readonly FigureId[], weights: Weights): number {
  return pan.reduce((sum, figure) => sum + weights[figure], 0);
}

export function outcomeOf(left: readonly FigureId[], right: readonly FigureId[], weights: Weights): Outcome {
  const difference = panWeight(left, weights) - panWeight(right, weights);
  return difference > 0 ? 'left' : difference < 0 ? 'right' : 'level';
}

/**
 * Every weight vector (one integer from 1 to `max` per figure, in the order of `figures`) that keeps every clue
 * true. It assigns the figures one by one and checks a clue as soon as all its figures have a weight, so clues prune
 * the search early.
 */
export function consistentWeights(figures: readonly FigureId[], clues: readonly Balance[], max = 20): number[][] {
  const position = new Map(figures.map((f, i) => [f, i] as const));
  // A clue is checked once its last figure (in assignment order) has a weight.
  const checkAt: Balance[][] = figures.map(() => []);
  for (const clue of clues) {
    const last = Math.max(...[...clue.left, ...clue.right].map((f) => position.get(f) ?? -1));
    if (last < 0) continue;
    checkAt[last].push(clue);
  }
  const found: number[][] = [];
  const weights: Record<number, number> = {};
  const assign = (index: number) => {
    if (index === figures.length) {
      found.push(figures.map((f) => weights[f]));
      return;
    }
    for (let w = 1; w <= max; w++) {
      weights[figures[index]] = w;
      if (checkAt[index].every((clue) => outcomeOf(clue.left, clue.right, weights) === clue.outcome)) assign(index + 1);
    }
    delete weights[figures[index]];
  };
  assign(0);
  return found;
}

/**
 * The figure that is surely the heaviest, from clues that each compare two single figures and never balance, or null
 * when the clues leave it open. With strict comparisons the heaviest is certain exactly when one figure never loses
 * and every figure is in some clue (in a finite order, a lone maximal element is the greatest).
 */
export function uniqueHeaviest(figures: readonly FigureId[], clues: readonly Balance[]): FigureId | null {
  const mentioned = new Set<FigureId>();
  const losers = new Set<FigureId>();
  for (const { left, right, outcome } of clues) {
    if (left.length !== 1 || right.length !== 1 || outcome === 'level') return null;
    mentioned.add(left[0]);
    mentioned.add(right[0]);
    losers.add(outcome === 'left' ? right[0] : left[0]);
  }
  if (figures.some((f) => !mentioned.has(f))) return null;
  const winners = figures.filter((f) => !losers.has(f));
  return winners.length === 1 ? winners[0] : null;
}

/** The outcome the new balance surely has, given the clues, or null when the clues leave it open. */
export function determinedOutcome(
  figures: readonly FigureId[],
  clues: readonly Balance[],
  question: { left: readonly FigureId[]; right: readonly FigureId[] },
  max = 20,
): Outcome | null {
  let seen: Outcome | null = null;
  for (const vector of consistentWeights(figures, clues, max)) {
    const weights = Object.fromEntries(figures.map((f, i) => [f, vector[i]]));
    const outcome = outcomeOf(question.left, question.right, weights);
    if (seen !== null && outcome !== seen) return null;
    seen = outcome;
  }
  return seen;
}
