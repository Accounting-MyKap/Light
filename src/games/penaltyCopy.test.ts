import es from '../i18n/es.json';
import en from '../i18n/en.json';
import { ARROWS_WRONG_PENALTY } from './arrows/engine';
import { QUICK_MATH_WRONG_PENALTY } from './quick-math/engine';
import { RULE_SWITCH_WRONG_PENALTY } from './rule-switch/engine';
import { SAME_DIFF_WRONG_PENALTY } from './same-different/engine';
import { ROUNDS } from './sequence-lights/engine';
import { GAME_DURATION_MS } from './shared/constants';

const dicts = { es, en } as unknown as Record<string, { games: Record<string, { practice: { recap: string } }> }>;
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
