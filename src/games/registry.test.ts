import { GAMES, QUIZ_GAMES, TRAINING_GAMES, getGame } from './registry';
import { QuizReview } from './quiz/QuizReview';
import { SwitchyardResultDetails } from './switchyard/ResultDetails';
import { QUIZ_AREAS, V1_AREAS, type GameDefinition } from './types';
import { ACCOUNTING_CATEGORIES, CATEGORIES_BY_BANK, TRIVIA_CATEGORIES } from '../quiz/types';
import es from '../i18n/es.json';
import en from '../i18n/en.json';

type GameTexts = { title: string; description: string; skill: string; practice?: { recap?: string } };
const dicts = [es, en] as unknown as Array<{ games: Record<string, GameTexts | undefined> }>;

/** The instructions live under `instructionsKey` when a game sets it, and under `games.<id>.instructions` otherwise. */
function instructionsOf(dict: unknown, game: GameDefinition): string[] | undefined {
  const key = game.instructionsKey ?? `games.${game.id}.instructions`;
  const found = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
  return Array.isArray(found) ? (found as string[]) : undefined;
}

const QUIZ_IDS = [
  'trivia-mix',
  'trivia-history',
  'trivia-science',
  'trivia-geography',
  'trivia-math',
  'trivia-arts',
  'trivia-entertainment',
  'trivia-sports',
  'trivia-technology',
  'accounting-mix',
  'accounting-concepts',
  'accounting-colombia',
  'accounting-us',
  'accounting-lending',
];

test('registry entries are valid', () => {
  const ids = GAMES.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(GAMES.map((g) => g.id)).toEqual([...TRAINING_GAMES, ...QUIZ_GAMES].map((g) => g.id));
  for (const g of TRAINING_GAMES) expect(V1_AREAS).toContain(g.area);
  for (const g of QUIZ_GAMES) expect(QUIZ_AREAS).toContain(g.area);
  for (const g of GAMES) {
    expect(g.maxScore).toBeGreaterThan(g.referenceScore);
    expect(g.referenceScore).toBeGreaterThan(0);
    expect(g.Thumb).toBeTypeOf('function');
    // Every game teaches itself one way: a guided practice, or the instructions with an Example.
    expect(Boolean(g.Practice) !== Boolean(g.Example), `${g.id} has exactly one of Practice or Example`).toBe(true);
    for (const dict of dicts) {
      const texts = dict.games[g.id];
      expect(texts?.title, `${g.id} title`).toBeTruthy();
      expect(texts?.description, `${g.id} description`).toBeTruthy();
      expect(texts?.skill, `${g.id} skill`).toBeTruthy();
      if (g.Practice) expect(texts?.practice?.recap, `${g.id} practice.recap`).toBeTruthy();
      else expect(instructionsOf(dict, g)?.length ?? 0, `${g.id} instructions`).toBeGreaterThanOrEqual(2);
    }
  }
  expect(getGame('nope')).toBeUndefined();
});

test('training games are the 5 v1 games, Guardagujas and Lluvia de estrellas', () =>
  expect(TRAINING_GAMES.map((g) => g.id)).toEqual([
    'sequence-lights',
    'arrows',
    'same-different',
    'rule-switch',
    'quick-math',
    'switchyard',
    'star-shower',
  ]));

test('every training game has a guided practice; only the quiz games keep the instructions', () => {
  expect(GAMES.filter((g) => g.Practice).map((g) => g.id)).toEqual(TRAINING_GAMES.map((g) => g.id));
  expect(TRAINING_GAMES).toHaveLength(7);
  expect(GAMES.filter((g) => g.Example).map((g) => g.id)).toEqual(QUIZ_IDS);
});

test('only the quiz games carry a quiz config', () => {
  expect(TRAINING_GAMES.every((g) => g.quiz === undefined)).toBe(true);
  expect(QUIZ_GAMES.every((g) => g.quiz !== undefined)).toBe(true);
});

test('quiz games show the review of mistakes on the result, Guardagujas its trains; other training games add nothing', () => {
  expect(QUIZ_GAMES.every((g) => g.ResultDetails === QuizReview)).toBe(true);
  expect(getGame('switchyard')?.ResultDetails).toBe(SwitchyardResultDetails);
  expect(TRAINING_GAMES.filter((g) => g.ResultDetails !== undefined).map((g) => g.id)).toEqual(['switchyard']);
});

test('quiz games are the 14 ids, their area is their bank and mixes cover the bank', () => {
  expect(QUIZ_GAMES.map((g) => g.id)).toEqual(QUIZ_IDS);
  for (const g of QUIZ_GAMES) {
    const quiz = g.quiz!;
    expect(g.area, g.id).toBe(quiz.bank);
    expect(g.instructionsKey, g.id).toBe('quiz.instructions');
    if (g.id.endsWith('-mix')) {
      expect(quiz.categories, g.id).toEqual(CATEGORIES_BY_BANK[quiz.bank]);
    } else {
      expect(quiz.categories, g.id).toHaveLength(1);
      expect(g.id, g.id).toBe(`${quiz.bank}-${quiz.categories[0]}`);
    }
  }
  expect(getGame('trivia-mix')?.quiz?.categories).toEqual(TRIVIA_CATEGORIES);
  expect(getGame('accounting-mix')?.quiz?.categories).toEqual(ACCOUNTING_CATEGORIES);
});

test('quiz games share a max score of 300', () => {
  for (const g of QUIZ_GAMES) {
    expect(g.maxScore, g.id).toBe(300);
    expect(g.referenceScore, g.id).toBe(200);
  }
});

test('each quiz game has its own component, created once at module level', () => {
  expect(new Set(QUIZ_GAMES.map((g) => g.Component)).size).toBe(QUIZ_GAMES.length);
});

test('skill texts', () => {
  expect(es.games['same-different'].skill).toBe('Velocidad de procesamiento');
  expect(en.games['rule-switch'].skill).toBe('Task switching');
});
