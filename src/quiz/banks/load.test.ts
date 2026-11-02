import { loadQuestions } from './load';
import { BANK_SIZES } from './manifest';
import type { QuizCategory } from '../types';

test('loads the requested categories and tags each question', async () => {
  const qs = await loadQuestions(['history', 'colombia']);
  expect(qs).toHaveLength(BANK_SIZES.history + BANK_SIZES.colombia);
  expect(new Set(qs.map((q) => q.category))).toEqual(new Set(['history', 'colombia']));
});

test('rejects an unknown category', () => expect(loadQuestions(['nope' as QuizCategory])).rejects.toThrow());

test('every loaded question carries the category of its own bank', async () => {
  const qs = await loadQuestions(['science', 'lending']);
  expect(qs.every((q) => q.id.startsWith(`${q.category}-`))).toBe(true);
});

test('changing a result does not affect the next load', async () => {
  const first = await loadQuestions(['math']);
  first.pop();
  expect(await loadQuestions(['math'])).toHaveLength(BANK_SIZES.math);
});
