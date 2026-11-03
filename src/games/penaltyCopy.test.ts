import es from '../i18n/es.json';
import en from '../i18n/en.json';
import { ARROWS_WRONG_PENALTY } from './arrows/engine';
import { QUICK_MATH_WRONG_PENALTY } from './quick-math/engine';
import { QUIZ_WRONG_PENALTY } from './quiz/engine';
import { RULE_SWITCH_WRONG_PENALTY } from './rule-switch/engine';
import { SAME_DIFF_WRONG_PENALTY } from './same-different/engine';

const dicts = { es, en } as unknown as Record<string, { games: Record<string, { instructions: string[] }> }>;

test.each([
  ['arrows', ARROWS_WRONG_PENALTY],
  ['rule-switch', RULE_SWITCH_WRONG_PENALTY],
  ['same-different', SAME_DIFF_WRONG_PENALTY],
  ['quick-math', QUICK_MATH_WRONG_PENALTY],
])('%s instructions state that a mistake costs %d points (es and en)', (id, penalty) => {
  for (const lang of ['es', 'en']) {
    expect(dicts[lang].games[id].instructions.join(' '), lang).toMatch(new RegExp(`\\b${penalty}\\b`));
  }
});

test('quiz.instructions states the choice and true/false penalties (es and en)', () => {
  // Phrased per language: a bare «10» would also match «Responde 10 preguntas».
  const patterns = {
    es: [`resta ${QUIZ_WRONG_PENALTY.choice} puntos`, `(${QUIZ_WRONG_PENALTY.truefalse} en las de verdadero o falso)`],
    en: [`costs ${QUIZ_WRONG_PENALTY.choice} points`, `(${QUIZ_WRONG_PENALTY.truefalse} on true-or-false questions)`],
  };
  for (const lang of ['es', 'en'] as const) {
    const text = (dicts[lang] as unknown as { quiz: { instructions: string[] } }).quiz.instructions.join(' ');
    for (const phrase of patterns[lang]) expect(text, lang).toContain(phrase);
  }
});

test('star-shower instructions say a wrong number costs nothing (es and en)', () => {
  expect(dicts.es.games['star-shower'].instructions.join(' ')).toMatch(/no resta/);
  expect(dicts.en.games['star-shower'].instructions.join(' ')).toMatch(/costs no points/);
});
