import es from '../i18n/es.json';
import en from '../i18n/en.json';
import { ARROWS_WRONG_PENALTY } from './arrows/engine';
import { QUICK_MATH_WRONG_PENALTY } from './quick-math/engine';
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
