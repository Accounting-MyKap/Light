import { createRng, randInt, type Rng } from '../../core/rng';
import { answerArrow, createArrowsGame } from '../arrows/engine';
import { answerBalance, choicesOf, createBalanceGame, type BalanceState } from '../balance/engine';
import { answerRule, createRuleSwitchGame } from '../rule-switch/engine';
import { answerSameDiff, createSameDiffGame } from '../same-different/engine';

const TRIALS = 1000;
const START = 1_000_000; // far from 0 so the floor never hides a deduction

interface Sim<S> {
  create: (rng: Rng) => S;
  score: (s: S) => number;
  /** Answers the current trial `rt` ms after it started; `right` decides whether the answer is the correct one. */
  answer: (s: S, right: boolean, rt: number, rng: Rng) => S;
}

function averagePoints<S>(sim: Sim<S>, accuracy: number, rt: number, seed: number): number {
  const rng = createRng(seed);
  let s = sim.create(rng);
  for (let i = 0; i < TRIALS; i++) s = sim.answer(s, rng() < accuracy, rt, rng);
  return (sim.score(s) - START) / TRIALS;
}

const arrows: Sim<ReturnType<typeof createArrowsGame>> = {
  create: (rng) => ({ ...createArrowsGame(1, rng, 0), score: START }),
  score: (s) => s.score,
  answer: (s, right, rt, rng) => {
    const d = s.trial.direction;
    return answerArrow(s, right ? d : d === 'left' ? 'right' : 'left', s.trialStartedAt + rt, rng).state;
  },
};

const ruleSwitch: Sim<ReturnType<typeof createRuleSwitchGame>> = {
  create: (rng) => ({ ...createRuleSwitchGame(1, rng, 0), score: START }),
  score: (s) => s.score,
  answer: (s, right, rt, rng) => {
    const c = s.trial.correctSide;
    return answerRule(s, right ? c : c === 'left' ? 'right' : 'left', s.trialStartedAt + rt, rng).state;
  },
};

const sameDiff: Sim<ReturnType<typeof createSameDiffGame>> = {
  create: (rng) => ({ ...createSameDiffGame(1, rng, 0), score: START }),
  score: (s) => s.score,
  answer: (s, right, rt, rng) => {
    const isSame = s.current === s.previous;
    const choice = right === isSame ? 'same' : 'different';
    return answerSameDiff(s, choice, s.trialStartedAt + rt, rng).state;
  },
};

test.each([
  ['arrows', arrows],
  ['rule-switch', ruleSwitch],
  ['same-different', sameDiff],
] as const)('%s: fast random guessing averages about 0, careful play clearly more', (_, sim) => {
  const guessing = averagePoints(sim as Sim<unknown>, 0.5, 200, 7);
  const careful = averagePoints(sim as Sim<unknown>, 0.9, 600, 7);
  expect(Math.abs(guessing)).toBeLessThan(1.5);
  expect(careful).toBeGreaterThan(5);
});

test('balance: fast random guessing averages 0 or less, careful play clearly more', () => {
  const sim: Sim<BalanceState> = {
    create: (rng) => ({ ...createBalanceGame(1, rng, 0), score: START }),
    score: (s) => s.score,
    answer: (s, right, rt, rng) => {
      const choices = choicesOf(s.challenge);
      const others = choices.filter((c) => c !== s.challenge.answer);
      const choice = right ? s.challenge.answer : others[randInt(rng, 0, others.length - 1)];
      return answerBalance(s, choice, s.shownAt + rt, rng).state;
    },
  };
  // A random guess is right one time in three (three choices) or less (more figures).
  expect(averagePoints(sim as Sim<unknown>, 1 / 3, 200, 7)).toBeLessThan(1.5);
  expect(averagePoints(sim as Sim<unknown>, 0.9, 2000, 7)).toBeGreaterThan(5);
});
