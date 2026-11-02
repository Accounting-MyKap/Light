import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData } from '../data/db';
import { addResult } from '../data/results';
import { addQuizAnswers } from '../data/quizAnswers';
import { BANK_SIZES } from '../quiz/banks/manifest';
import { ACCOUNTING_CATEGORIES, TRIVIA_CATEGORIES, type QuizCategory, type QuizRoundDetails } from '../quiz/types';
import { makeChoice } from '../test/quizFixtures';
import { seenFor } from './QuizScreen';

beforeEach(clearAllData);

/** `count` distinct answered questions of one category, as one saved round. */
function answered(category: QuizCategory, count: number): QuizRoundDetails {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      question: makeChoice(`${category}-${String(i + 1).padStart(4, '0')}`, category, 1),
      outcome: 'correct' as const,
      chosen: 0,
    })),
  };
}

const sumOfBanks = (categories: readonly QuizCategory[]) =>
  categories.reduce((total, c) => total + BANK_SIZES[c], 0);

const blockOf = (name: string) => screen.getByRole('region', { name });

test('lists both blocks with the mix first', async () => {
  await renderApp('/quiz');
  expect(screen.getByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
  expect(screen.getByText('Rondas de 10 preguntas de cultura general y de contabilidad.')).toBeInTheDocument();
  const blocks = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  expect(blocks).toEqual(['Cultura general', 'Contabilidad']);

  const trivia = within(blockOf('Cultura general')).getAllByRole('link');
  expect(trivia).toHaveLength(9);
  expect(trivia[0]).toHaveAttribute('href', '/play/trivia-mix');
  expect(trivia[1]).toHaveAttribute('href', '/play/trivia-history');
  expect(trivia[8]).toHaveAttribute('href', '/play/trivia-technology');

  const accounting = within(blockOf('Contabilidad')).getAllByRole('link');
  expect(accounting).toHaveLength(5);
  expect(accounting[0]).toHaveAttribute('href', '/play/accounting-mix');
  expect(accounting[1]).toHaveAttribute('href', '/play/accounting-concepts');
  expect(accounting[4]).toHaveAttribute('href', '/play/accounting-lending');
});

test('each card links to its game with best mark and seen count', async () => {
  await addResult({ gameId: 'trivia-history', level: 1, score: 250, accuracy: 1, durationMs: 60000, isDaily: false });
  await addResult({ gameId: 'trivia-history', level: 1, score: 90, accuracy: 1, durationMs: 60000, isDaily: false });
  await addQuizAnswers('r1', answered('history', 3), new Date());
  await renderApp('/quiz');

  const history = screen.getByRole('link', { name: /^Historia/ });
  expect(history).toHaveAttribute('href', '/play/trivia-history');
  expect(within(history).getByText('Historia universal y de América Latina.')).toBeInTheDocument();
  expect(await within(history).findByText('Mejor marca: 250')).toBeInTheDocument();
  expect(await within(history).findByText(`Vistas: 3 de ${BANK_SIZES.history}`)).toBeInTheDocument();

  const science = screen.getByRole('link', { name: /^Ciencias/ });
  expect(within(science).getByText('Mejor marca: —')).toBeInTheDocument();
  expect(within(science).getByText(`Vistas: 0 de ${BANK_SIZES.science}`)).toBeInTheDocument();
});

test('the mix card sums its categories', async () => {
  await addResult({ gameId: 'trivia-mix', level: 1, score: 120, accuracy: 1, durationMs: 60000, isDaily: false });
  await addQuizAnswers('r1', answered('history', 2), new Date());
  await addQuizAnswers('r2', answered('science', 3), new Date());
  await addQuizAnswers('r3', answered('lending', 4), new Date());
  await renderApp('/quiz');

  const triviaMix = screen.getByRole('link', { name: /^Mezcla de cultura general/ });
  expect(triviaMix).toHaveAttribute('href', '/play/trivia-mix');
  expect(await within(triviaMix).findByText('Mejor marca: 120')).toBeInTheDocument();
  expect(await within(triviaMix).findByText(`Vistas: 5 de ${sumOfBanks(TRIVIA_CATEGORIES)}`)).toBeInTheDocument();

  const accountingMix = screen.getByRole('link', { name: /^Mezcla contable/ });
  expect(within(accountingMix).getByText('Mejor marca: —')).toBeInTheDocument();
  expect(within(accountingMix).getByText(`Vistas: 4 de ${sumOfBanks(ACCOUNTING_CATEGORIES)}`)).toBeInTheDocument();
});

test('seen counts never exceed the bank size', async () => {
  const size = BANK_SIZES.history;
  await addQuizAnswers('r1', answered('history', size + 3), new Date());
  await renderApp('/quiz');

  const history = screen.getByRole('link', { name: /^Historia/ });
  expect(await within(history).findByText(`Vistas: ${size} de ${size}`)).toBeInTheDocument();
  const triviaMix = screen.getByRole('link', { name: /^Mezcla de cultura general/ });
  expect(within(triviaMix).getByText(`Vistas: ${size} de ${sumOfBanks(TRIVIA_CATEGORIES)}`)).toBeInTheDocument();
});

test('the two mix cards are featured and the category cards are not', async () => {
  await renderApp('/quiz');
  // CSS modules hash the class names in tests (_cardFeatured_ab12cd), so match on the name.
  const isFeatured = (a: HTMLElement) => /cardFeatured/.test(a.className);
  const cards = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/play/'));
  expect(cards).toHaveLength(14);

  expect(cards.filter(isFeatured).map((a) => a.getAttribute('href'))).toEqual([
    '/play/trivia-mix',
    '/play/accounting-mix',
  ]);
  expect(isFeatured(screen.getByRole('link', { name: /^Historia/ }))).toBe(false);
  expect(isFeatured(screen.getByRole('link', { name: /^Conceptos contables/ }))).toBe(false);
});

test('the nav has five tabs in order', async () => {
  await renderApp('/quiz');
  const nav = screen.getByRole('navigation');
  expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
    'Hoy',
    'Juegos',
    'Preguntas',
    'Progreso',
    'Ajustes',
  ]);
  expect(within(nav).getByRole('link', { name: 'Preguntas' })).toHaveAttribute('aria-current', 'page');
});

describe('seenFor', () => {
  const trivia = { bank: 'trivia', categories: TRIVIA_CATEGORIES } as const;

  test('sums the seen and total counts over the categories', () => {
    const seen = new Map<QuizCategory, number>([
      ['history', 2],
      ['science', 3],
    ]);
    expect(seenFor(trivia, seen)).toEqual({ seen: 5, total: sumOfBanks(TRIVIA_CATEGORIES) });
    expect(seenFor({ bank: 'trivia', categories: ['history'] }, seen)).toEqual({ seen: 2, total: BANK_SIZES.history });
  });

  test('a category with no answers counts as zero and an oversized one is clamped', () => {
    const seen = new Map<QuizCategory, number>([['history', BANK_SIZES.history + 5]]);
    expect(seenFor({ bank: 'trivia', categories: ['history', 'science'] }, seen)).toEqual({
      seen: BANK_SIZES.history,
      total: BANK_SIZES.history + BANK_SIZES.science,
    });
    expect(seenFor(trivia, new Map())).toEqual({ seen: 0, total: sumOfBanks(TRIVIA_CATEGORIES) });
  });
});
