import { validateBank } from './validate';
import { ALL_CATEGORIES } from './types';
import type { QuizCategory } from './types';
import { BANK_SIZES } from './banks/manifest';

interface BankFile {
  category: QuizCategory;
  questions: { id: string; difficulty: number }[];
}

const files = import.meta.glob<BankFile>('./banks/*.json', { eager: true, import: 'default' });

const path = (c: QuizCategory) => `./banks/${c}.json`;
const toCategory = (p: string) => p.replace('./banks/', '').replace('.json', '');

/** Cuántos elementos hay por cada valor de `key`: `{ valor: cantidad }`. */
const countBy = <T, K extends keyof T>(items: readonly T[], key: K): Record<string, number> =>
  items.reduce<Record<string, number>>((counts, item) => {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

test('there is exactly one bank per category', () => {
  expect(Object.keys(files).map(toCategory).sort()).toEqual([...ALL_CATEGORIES].sort());
});

test.each(ALL_CATEGORIES)('%s bank is valid', (c) => {
  expect(validateBank(files[path(c)], c)).toEqual([]);
});

test('ids are unique across banks', () => {
  const ids = Object.values(files).flatMap((file) => file.questions.map((q) => q.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test.each(ALL_CATEGORIES)('manifest size of %s matches its file', (c) => {
  expect(BANK_SIZES[c]).toBe(files[path(c)].questions.length);
});

// Puerta de lanzamiento (docs/quiz/guia-de-contenido.md, sección 2): ampliar un banco la actualiza a propósito.
test.each(ALL_CATEGORIES)('%s has the launch size: 100 questions, 40/40/20', (c) => {
  const qs = files[path(c)].questions;
  expect(qs).toHaveLength(100);
  expect(countBy(qs, 'difficulty')).toEqual({ 1: 40, 2: 40, 3: 20 });
});

test('the quiz launches with 1,200 questions', () =>
  expect(Object.values(BANK_SIZES).reduce((a, b) => a + b, 0)).toBe(1200));
