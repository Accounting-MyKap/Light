import { validateBank } from './validate';
import {
  ACCOUNTING_CATEGORIES,
  ALL_CATEGORIES,
  CATEGORIES_BY_BANK,
  TRIVIA_CATEGORIES,
  correctIndex,
  optionTexts,
} from './types';
import type { ChoiceQuestion, Difficulty, Question } from './types';
import { makeChoice, makePool, makeTrueFalse, rawBank } from '../test/quizFixtures';

const POOL = { 1: 4, 2: 4, 3: 4 } as const;

const valid = () => rawBank('history', makePool('history', POOL));

/** Un banco válido de 12 preguntas con una sola cosa cambiada por `mutate`. */
function bankWith(mutate: (qs: Question[]) => void): unknown {
  const qs = makePool('history', POOL);
  mutate(qs);
  return rawBank('history', qs);
}

const errorsOf = (raw: unknown) => validateBank(raw, 'history');

test('the categories are the 12 of the spec, in order', () => {
  expect(ALL_CATEGORIES).toEqual([
    'history', 'science', 'geography', 'math', 'arts', 'entertainment', 'sports', 'technology',
    'concepts', 'colombia', 'us', 'lending',
  ]);
  expect(CATEGORIES_BY_BANK.trivia).toEqual(TRIVIA_CATEGORIES);
  expect(CATEGORIES_BY_BANK.accounting).toEqual(ACCOUNTING_CATEGORIES);
});

test('a valid bank has no errors', () => {
  expect(validateBank(valid(), 'history')).toEqual([]);
  for (const category of ALL_CATEGORIES) {
    expect(validateBank(rawBank(category, makePool(category, POOL)), category)).toEqual([]);
  }
});

test('the bank category must match the file', () => {
  expect(validateBank(valid(), 'science').join('\n')).toMatch(/^bank:/m);
  const raw = valid() as { category: string };
  raw.category = 'science';
  expect(errorsOf(raw).join('\n')).toMatch(/^bank:/m);
});

test('malformed files return errors instead of throwing', () => {
  for (const raw of [null, undefined, 42, 'x', [], {}, { category: 'history' }, { category: 'history', questions: 'x' }]) {
    const errors = errorsOf(raw);
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(e).toMatch(/^bank:/);
  }
  const errors = errorsOf({ category: 'history', questions: [null, 5, 'x', []] });
  expect(errors.length).toBeGreaterThanOrEqual(4);
  expect(errors.join('\n')).toMatch(/^questions\[0\]:/m);
});

test('ids follow <category>-NNNN and are unique', () => {
  const badFormat = errorsOf(bankWith((qs) => { qs[0].id = 'hist-1'; }));
  expect(badFormat.some((e) => e.startsWith('hist-1:'))).toBe(true);

  const wrongCategory = errorsOf(bankWith((qs) => { qs[0].id = 'science-0001'; }));
  expect(wrongCategory.some((e) => e.startsWith('science-0001:'))).toBe(true);

  const noPadding = errorsOf(bankWith((qs) => { qs[0].id = 'history-12345'; }));
  expect(noPadding.some((e) => e.startsWith('history-12345:'))).toBe(true);

  const duplicated = errorsOf(bankWith((qs) => { qs[1].id = qs[0].id; }));
  expect(duplicated).toHaveLength(1);
  expect(duplicated[0]).toMatch(/^history-0001:.*duplicate/);

  const missing = errorsOf(bankWith((qs) => { (qs[0] as unknown as Record<string, unknown>).id = 7; }));
  expect(missing.some((e) => e.startsWith('questions[0]:'))).toBe(true);
});

test('difficulty is 1, 2 or 3', () => {
  for (const bad of [4, 0, 1.5, '2', undefined]) {
    const errors = errorsOf(bankWith((qs) => { qs[0].difficulty = bad as unknown as Difficulty; }));
    expect(errors.some((e) => e.startsWith('history-0001:') && /difficulty/.test(e)), String(bad)).toBe(true);
  }
});

test('the question type is choice or truefalse', () => {
  const errors = errorsOf(bankWith((qs) => { (qs[0] as unknown as Record<string, unknown>).type = 'open'; }));
  expect(errors.some((e) => e.startsWith('history-0001:') && /type/.test(e))).toBe(true);
});

test('choice questions have 4 distinct options per language', () => {
  const threeOptions = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.es.options = ['A', 'B', 'C'] as unknown as ChoiceQuestion['es']['options'];
  }));
  expect(threeOptions.some((e) => e.startsWith('history-0001:') && /es\.options/.test(e))).toBe(true);

  const fiveOptions = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.en.options = ['A', 'B', 'C', 'D', 'E'] as unknown as ChoiceQuestion['en']['options'];
  }));
  expect(fiveOptions.some((e) => e.startsWith('history-0001:') && /en\.options/.test(e))).toBe(true);

  const notAnArray = errorsOf(bankWith((qs) => {
    (qs[0] as unknown as { es: { options: unknown } }).es.options = 'A, B, C, D';
  }));
  expect(notAnArray.some((e) => e.startsWith('history-0001:') && /es\.options/.test(e))).toBe(true);

  const repeated = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.es.options = ['París', 'Lyon', ' parís', 'Niza'];
  }));
  expect(repeated.some((e) => e.startsWith('history-0001:') && /es\.options.*distinct/.test(e))).toBe(true);

  const repeatedEnglish = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.en.options = ['Paris', 'Lyon', 'PARIS', 'Nice'];
  }));
  expect(repeatedEnglish.some((e) => e.startsWith('history-0001:') && /en\.options.*distinct/.test(e))).toBe(true);
});

test('true/false questions have a boolean answer and no options', () => {
  const tf = (answer: boolean) => makeTrueFalse('history-0001', 'history', 1, answer);
  const withTf = (q: Question) => bankWith((qs) => { qs[0] = q; });

  expect(errorsOf(withTf(tf(true)))).toEqual([]);
  expect(errorsOf(withTf(tf(false)))).toEqual([]);

  const missingAnswer = tf(true) as unknown as Record<string, unknown>;
  delete missingAnswer.answer;
  expect(errorsOf(withTf(missingAnswer as unknown as Question)).some((e) => e.startsWith('history-0001:') && /answer/.test(e))).toBe(true);

  const stringAnswer = { ...tf(true), answer: 'true' } as unknown as Question;
  expect(errorsOf(withTf(stringAnswer)).some((e) => e.startsWith('history-0001:') && /answer/.test(e))).toBe(true);

  for (const lang of ['es', 'en'] as const) {
    const withOptions = tf(true) as unknown as Record<string, Record<string, unknown>>;
    withOptions[lang].options = ['A', 'B', 'C', 'D'];
    const errors = errorsOf(withTf(withOptions as unknown as Question));
    expect(errors.some((e) => e.startsWith('history-0001:') && new RegExp(`${lang}\\.options`).test(e)), lang).toBe(true);
  }
});

test('texts are trimmed, non-empty and within the limits', () => {
  const tooLong = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.es.question = 'a'.repeat(161);
    q.es.options = [q.es.options[0], 'b'.repeat(61), q.es.options[2], q.es.options[3]];
    q.es.explanation = 'c'.repeat(221);
  }));
  expect(tooLong).toHaveLength(3);
  for (const e of tooLong) expect(e).toMatch(/^history-0001:/);

  const atTheLimit = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.en.question = 'a'.repeat(160);
    q.en.options = [q.en.options[0], 'b'.repeat(60), q.en.options[2], q.en.options[3]];
    q.en.explanation = 'c'.repeat(220);
  }));
  expect(atTheLimit).toEqual([]);

  const empty = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.es.question = '';
    q.en.explanation = '   ';
  }));
  expect(empty).toHaveLength(2);
  expect(empty.every((e) => e.startsWith('history-0001:'))).toBe(true);

  const untrimmed = errorsOf(bankWith((qs) => {
    const q = qs[0] as ChoiceQuestion;
    q.en.question = ' Question ';
    q.es.options = [q.es.options[0], 'Lyon ', q.es.options[2], q.es.options[3]];
  }));
  expect(untrimmed).toHaveLength(2);
  expect(untrimmed.every((e) => e.startsWith('history-0001:'))).toBe(true);

  const notAString = errorsOf(bankWith((qs) => {
    (qs[0] as unknown as { es: { explanation: unknown } }).es.explanation = 5;
  }));
  expect(notAString.some((e) => e.startsWith('history-0001:') && /es\.explanation/.test(e))).toBe(true);

  const missingLanguage = errorsOf(bankWith((qs) => {
    delete (qs[0] as unknown as Record<string, unknown>).en;
  }));
  expect(missingLanguage.some((e) => e.startsWith('history-0001:') && /\ben\b/.test(e))).toBe(true);
});

test('the limits also apply to true/false questions', () => {
  const q = makeTrueFalse('history-0001', 'history', 1, true);
  q.en.question = 'a'.repeat(161);
  q.es.explanation = 'c'.repeat(221);
  const errors = errorsOf(bankWith((qs) => { qs[0] = q; }));
  expect(errors).toHaveLength(2);
});

test('rejects all/none of the above', () => {
  const phrases: Array<['es' | 'en', string]> = [
    ['es', 'Todas las anteriores'],
    ['es', 'ninguna de las anteriores'],
    ['en', 'All of the above'],
    ['en', 'None of the above'],
  ];
  for (const [lang, phrase] of phrases) {
    const errors = errorsOf(bankWith((qs) => {
      const q = qs[0] as ChoiceQuestion;
      q[lang].options = [q[lang].options[0], q[lang].options[1], q[lang].options[2], phrase];
    }));
    expect(errors.some((e) => e.startsWith('history-0001:') && new RegExp(`${lang}\\.options`).test(e)), phrase).toBe(true);
  }
});

test('asOf is YYYY-MM', () => {
  const withAsOf = (asOf: unknown) => bankWith((qs) => { (qs[0] as unknown as Record<string, unknown>).asOf = asOf; });
  expect(errorsOf(withAsOf('2026-11'))).toEqual([]);
  expect(errorsOf(withAsOf(undefined))).toEqual([]);
  for (const bad of ['2026-13', '2026-00', '11-2026', '2026-1', '2026-11-02', 202611]) {
    const errors = errorsOf(withAsOf(bad));
    expect(errors.some((e) => e.startsWith('history-0001:') && /asOf/.test(e)), String(bad)).toBe(true);
  }
});

test('at most 25 % true/false', () => {
  const withTrueFalse = (indexes: number[]) => bankWith((qs) => {
    for (const i of indexes) qs[i] = makeTrueFalse(qs[i].id, 'history', qs[i].difficulty, i % 2 === 0);
  });
  expect(errorsOf(withTrueFalse([0, 4, 8]))).toEqual([]);
  const errors = errorsOf(withTrueFalse([0, 1, 4, 8]));
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatch(/^bank:.*true\/false/);
});

test('at least 10 questions and one of each difficulty', () => {
  const few = validateBank(rawBank('history', makePool('history', { 1: 3, 2: 3, 3: 3 })), 'history');
  expect(few).toHaveLength(1);
  expect(few[0]).toMatch(/^bank:.*10/);

  const noHard = validateBank(rawBank('history', makePool('history', { 1: 6, 2: 6, 3: 0 })), 'history');
  expect(noHard).toHaveLength(1);
  expect(noHard[0]).toMatch(/^bank:.*difficulty 3/);

  const onlyOne = validateBank(rawBank('history', makePool('history', { 1: 12, 2: 0, 3: 0 })), 'history');
  expect(onlyOne).toHaveLength(2);

  expect(validateBank(rawBank('history', makePool('history', { 1: 4, 2: 3, 3: 3 })), 'history')).toEqual([]);
});

test('correctIndex and optionTexts', () => {
  const labels = { true: 'Verdadero', false: 'Falso' };
  const choice = makeChoice('history-0001', 'history', 1);

  expect(correctIndex(choice)).toBe(0);
  expect(correctIndex(makeTrueFalse('history-0002', 'history', 1, true))).toBe(0);
  expect(correctIndex(makeTrueFalse('history-0003', 'history', 1, false))).toBe(1);

  expect(optionTexts(choice, 'es', labels)).toEqual([
    'Correcta history-0001', 'Incorrecta A history-0001', 'Incorrecta B history-0001', 'Incorrecta C history-0001',
  ]);
  expect(optionTexts(choice, 'en', labels)[0]).toBe('Correct history-0001');
  expect(optionTexts(makeTrueFalse('history-0003', 'history', 1, false), 'es', labels)).toEqual(['Verdadero', 'Falso']);
  expect(optionTexts(makeTrueFalse('history-0003', 'history', 1, true), 'en', { true: 'True', false: 'False' })).toEqual(['True', 'False']);
});
