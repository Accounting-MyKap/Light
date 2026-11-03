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

// Pisos del diseño (§6; docs/quiz/guia-de-contenido.md, sección 2). Son mínimos: agregar preguntas no toca esta prueba.
test.each(ALL_CATEGORIES)('%s meets the minimum size: ≥ 100 questions, ≥ 35/35/15', (c) => {
  const qs = files[path(c)].questions;
  const byDifficulty = countBy(qs, 'difficulty');
  expect(qs.length).toBeGreaterThanOrEqual(100);
  expect(byDifficulty['1'] ?? 0).toBeGreaterThanOrEqual(35);
  expect(byDifficulty['2'] ?? 0).toBeGreaterThanOrEqual(35);
  expect(byDifficulty['3'] ?? 0).toBeGreaterThanOrEqual(15);
});

test('the quiz has at least 1,200 questions', () =>
  expect(Object.values(BANK_SIZES).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1200));
