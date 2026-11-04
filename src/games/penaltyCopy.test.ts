import es from '../i18n/es.json';
import en from '../i18n/en.json';
import { ARROWS_WRONG_PENALTY } from './arrows/engine';
import { QUICK_MATH_WRONG_PENALTY } from './quick-math/engine';
import { QUIZ_WRONG_PENALTY } from './quiz/engine';
import { RULE_SWITCH_WRONG_PENALTY } from './rule-switch/engine';
import { SAME_DIFF_WRONG_PENALTY } from './same-different/engine';
import { ROUNDS } from './sequence-lights/engine';
import { GAME_DURATION_MS } from './shared/constants';
import { LIVES } from './star-shower/engine';
import { SWITCHYARD_DURATION_MS } from './switchyard/engine';

const dicts = { es, en } as unknown as Record<
  string,
  { games: Record<string, { practice: { recap: string } }> }
>;
const word = (n: number) => new RegExp(`\\b${n}\\b`);

test.each([
  ['arrows', ARROWS_WRONG_PENALTY],
  ['rule-switch', RULE_SWITCH_WRONG_PENALTY],
  ['same-different', SAME_DIFF_WRONG_PENALTY],
  ['quick-math', QUICK_MATH_WRONG_PENALTY],
])('%s recap states that a mistake costs %d points and the seconds of the clock (es and en)', (id, penalty) => {
  for (const lang of ['es', 'en']) {
    const recap = dicts[lang].games[id].practice.recap;
    expect(recap, lang).toMatch(word(penalty));
    expect(recap, lang).toMatch(word(GAME_DURATION_MS / 1000));
  }
});

test('sequence-lights recap states the number of rounds (es and en)', () => {
  for (const lang of ['es', 'en']) {
    expect(dicts[lang].games['sequence-lights'].practice.recap, lang).toMatch(word(ROUNDS));
  }
});

test('switchyard recap states the seconds of its own clock and that a train at another station scores nothing (es and en)', () => {
  expect(SWITCHYARD_DURATION_MS / 1000).toBe(90);
  const nothing = { es: /si llega a otra, no suma/, en: /if it reaches another, it scores nothing/ };
  for (const lang of ['es', 'en'] as const) {
    const recap = dicts[lang].games.switchyard.practice.recap;
    expect(recap, lang).toMatch(word(SWITCHYARD_DURATION_MS / 1000));
    expect(recap, lang).toMatch(nothing[lang]);
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

test('star-shower recap states its lives and that a wrong number costs nothing (es and en)', () => {
  expect(LIVES).toBe(3);
  const nothing = { es: /no resta/, en: /costs no points/ };
  for (const lang of ['es', 'en'] as const) {
    const recap = dicts[lang].games['star-shower'].practice.recap;
    expect(recap, lang).toMatch(word(LIVES));
    expect(recap, lang).toMatch(nothing[lang]);
  }
});
