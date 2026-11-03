import { createElement } from 'react';
import { render } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { Board } from './Board';
import { ALL_MAPS, STATION_STYLES, mapFor, mirrorMap, stationCountForLevel, type TrackMap } from './maps';
import { SCENES, themeFor, type SceneTheme } from './themes';

beforeEach(async () => {
  await initI18n('es');
  // jsdom has no 2D canvas; the board copes with a missing context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});
afterEach(() => vi.restoreAllMocks());

const boardOf = (map: TrackMap) =>
  createElement(Board, { map, switches: map.switches.map(() => 0 as const), trains: [], onToggle: () => undefined });

test.each<[number, SceneTheme]>([
  [3, 'meadow'],
  [4, 'meadow'],
  [5, 'autumn'],
  [6, 'autumn'],
  [7, 'snow'],
])('a map with %i stations is drawn as %s', (stations, theme) => {
  expect(themeFor(mapFor(stations, false))).toBe(theme);
});

test('the scene changes with the level band: 1–4 meadow, 5–8 autumn, 9–10 snow', () => {
  const byLevel = Array.from({ length: 10 }, (_, i) => themeFor(mapFor(stationCountForLevel(i + 1), false)));
  expect(byLevel).toEqual([...Array(4).fill('meadow'), ...Array(4).fill('autumn'), 'snow', 'snow']);
});

test('a mirrored map keeps the scene of its map', () => {
  for (const map of ALL_MAPS) expect(themeFor(mirrorMap(map))).toBe(themeFor(map));
  for (const n of [3, 4, 5, 6, 7]) expect(themeFor(mapFor(n, true))).toBe(themeFor(mapFor(n, false)));
});

test('the board says its scene on its ground', () => {
  for (const [stations, theme] of [
    [3, 'meadow'],
    [5, 'autumn'],
    [7, 'snow'],
  ] as const) {
    const { container, unmount } = render(boardOf(mapFor(stations, false)));
    expect(container.querySelector('svg g[data-theme]')?.getAttribute('data-theme')).toBe(theme);
    unmount();
  }
});

/* ------------------------------------------------------------------------------------------------- readability */

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `top` over `bottom` at the given share of `top`, per channel. */
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

/** The cyan of the attention area: the ring of the switches. */
const SWITCH_RING = '#3fd4ff';
/** The marks of a right and a wrong arrival. */
const ARRIVAL_MARKS = ['#4dffa6', '#ff5d7a'];

test.each<SceneTheme>(['meadow', 'autumn', 'snow'])(
  'on the %s ground the stations, the switches and the arrival marks stand out (≥ 3:1)',
  (theme) => {
    const scene = SCENES[theme];
    const [center, edge] = scene.ground;
    // The lightest spots of the ground: its center, under one patch and under two overlapping patches.
    const onePatch = mix(scene.patch, center, scene.patchOpacity);
    const grounds = [center, edge, onePatch, mix(scene.patch, onePatch, scene.patchOpacity)];
    for (const ground of grounds) {
      for (const color of [...STATION_STYLES.map((s) => s.color), SWITCH_RING, ...ARRIVAL_MARKS]) {
        expect(contrast(color, ground), `${color} on ${ground}`).toBeGreaterThanOrEqual(3);
      }
    }
  },
);

test('every scene stays a night of the Luz style: a dark ground (luminance under that of #3a3a3a)', () => {
  for (const scene of Object.values(SCENES)) {
    for (const stop of scene.ground) expect(luminance(stop)).toBeLessThan(luminance('#3a3a3a'));
  }
});
