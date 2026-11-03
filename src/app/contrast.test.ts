import luzCss from '../games/shared/luz/luz.css?raw';
import { QUIZ_AREAS, V1_AREAS } from '../games/types';
import css from './theme.css?raw';

// Finds the block by its exact selector text followed by ` {`, so `[data-luz] {` never matches the longer
// `[data-luz][data-area='…'] {` selectors that also contain it.
function tokensIn(source: string, selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const block = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

function tokens(selector: string): Record<string, string> {
  return tokensIn(css, selector);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `top` over `bottom` at the given share of `top`, per channel, as a hex color. */
function mix(top: string, bottom: string, share: number): string {
  const channels = [1, 3, 5].map((i) => {
    const mixed = share * parseInt(top.slice(i, i + 2), 16) + (1 - share) * parseInt(bottom.slice(i, i + 2), 16);
    return Math.round(mixed).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['accent-text', 'accent'],
  ['accent-strong', 'bg'],
  ['accent-strong', 'surface'],
  ['success-strong', 'bg'],
  ['success-strong', 'surface'],
];

describe.each([`:root[data-theme='light']`, `:root[data-theme='dark']`])('%s', (selector) => {
  const t = tokens(selector);
  test.each(TEXT_PAIRS)('--%s on --%s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(t[fg], `--${fg} defined`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Luz (always-dark game screens)', () => {
  const luz = tokensIn(luzCss, '[data-luz]');
  // Every area that has games: the five training areas and the two banks of the quiz section.
  const AREAS = [...V1_AREAS, ...QUIZ_AREAS];
  const games = AREAS.map((area): [string, string] => [area, tokensIn(luzCss, `[data-luz][data-area='${area}']`).game]);

  test('each area has a color of its own', () => {
    const colors = games.map(([, game]) => game?.toLowerCase());
    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(AREAS.length);
  });

  test.each([['luz-text'], ['luz-muted'], ['luz-soft']])('--%s on --luz-bg meets WCAG AA (4.5:1)', (fg) => {
    expect(luz[fg], `--${fg} defined`).toBeDefined();
    expect(contrast(luz[fg], luz['luz-bg'])).toBeGreaterThanOrEqual(4.5);
  });

  test.each([['luz-ok'], ['luz-bad']])('--%s on --luz-bg meets 3:1', (fg) => {
    expect(luz[fg], `--${fg} defined`).toBeDefined();
    expect(contrast(luz[fg], luz['luz-bg'])).toBeGreaterThanOrEqual(3);
  });

  describe.each(games)('area %s', (_area, game) => {
    test('--game on --luz-bg meets 3:1', () => {
      expect(game, '--game defined').toBeDefined();
      expect(contrast(game, luz['luz-bg'])).toBeGreaterThanOrEqual(3);
    });
    test('--luz-ink on --game meets WCAG AA (4.5:1)', () => {
      expect(contrast(luz['luz-ink'], game)).toBeGreaterThanOrEqual(4.5);
    });
    // The glow at the top of the screen is the area color at 28% over the background (its strongest point,
    // luz.css `background-image`). Small secondary text in the top band (level line, result title) uses --luz-soft.
    test('--luz-soft over the top glow of the area meets WCAG AA (4.5:1)', () => {
      expect(luz['luz-soft'], '--luz-soft defined').toBeDefined();
      expect(contrast(luz['luz-soft'], mix(game, luz['luz-bg'], 0.28))).toBeGreaterThanOrEqual(4.5);
    });
  });
});

/*
 * The quiz in Luz draws its text on glass cards (white at 4.5 %, luz.css --luz-glass) that can sit over the glow of
 * the area at the top of the screen (28 % of --game over --luz-bg at its strongest). The ✓ / ✗ marks are pills filled
 * with --luz-ok / --luz-bad and written in --luz-ink; a marked option is its glass tinted 10 % with that color
 * (quiz.module.css). --luz-muted and --luz-bad as text do not reach 4.5:1 there, so the quiz does not use them as text.
 */
describe('quiz text in Luz', () => {
  const luz = tokensIn(luzCss, '[data-luz]');
  const GLASS = 0.045;
  const TINT = 0.1;

  test.each([['luz-ok'], ['luz-bad']])('--luz-ink on a --%s mark meets WCAG AA (4.5:1)', (mark) => {
    expect(contrast(luz['luz-ink'], luz[mark])).toBeGreaterThanOrEqual(4.5);
  });

  describe.each(QUIZ_AREAS)('area %s', (area) => {
    const game = tokensIn(luzCss, `[data-luz][data-area='${area}']`).game;
    const glass = mix('#ffffff', mix(game, luz['luz-bg'], 0.28), GLASS);

    test.each([['luz-text'], ['luz-soft'], ['luz-ok']])('--%s on glass over the glow meets WCAG AA (4.5:1)', (fg) => {
      expect(contrast(luz[fg], glass)).toBeGreaterThanOrEqual(4.5);
    });

    test.each([['luz-ok'], ['luz-bad']])('--luz-text on an option tinted with --%s meets WCAG AA (4.5:1)', (tint) => {
      expect(contrast(luz['luz-text'], mix(luz[tint], glass, TINT))).toBeGreaterThanOrEqual(4.5);
    });

    test('--luz-ink on the filled «Siguiente» and option numbers meets WCAG AA (4.5:1)', () => {
      expect(contrast(luz['luz-ink'], game)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
