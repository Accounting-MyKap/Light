import { ACCOUNTING_CATEGORIES, TRIVIA_CATEGORIES } from '../../quiz/types';
import type { GameDefinition } from '../types';
import { makeQuizGame } from './makeQuizGame';

/** The 14 games of the quiz section, in the order the app lists them: the trivia block, then the accounting one. */
export const QUIZ_GAME_LIST: readonly GameDefinition[] = [
  makeQuizGame({ id: 'trivia-mix', bank: 'trivia', categories: TRIVIA_CATEGORIES }),
  ...TRIVIA_CATEGORIES.map((category) =>
    makeQuizGame({ id: `trivia-${category}`, bank: 'trivia', categories: [category] }),
  ),
  makeQuizGame({ id: 'accounting-mix', bank: 'accounting', categories: ACCOUNTING_CATEGORIES }),
  ...ACCOUNTING_CATEGORIES.map((category) =>
    makeQuizGame({ id: `accounting-${category}`, bank: 'accounting', categories: [category] }),
  ),
];
