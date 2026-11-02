import { validateBank } from './validate';
import { ALL_CATEGORIES } from './types';
import type { QuizCategory } from './types';
import { BANK_SIZES } from './banks/manifest';

interface BankFile {
  category: QuizCategory;
  questions: { id: string }[];
}

const files = import.meta.glob<BankFile>('./banks/*.json', { eager: true, import: 'default' });

const path = (c: QuizCategory) => `./banks/${c}.json`;
const toCategory = (p: string) => p.replace('./banks/', '').replace('.json', '');

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
