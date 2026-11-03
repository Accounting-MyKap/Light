import type { TrackMap } from './maps';

/*
 * The scenery around the tracks changes with the size of the map, so each band of levels has a night of its own: a
 * meadow (3–4 stations, levels 1–4), an autumn forest (5–6 stations, levels 5–8) and a snowy night (7 stations,
 * levels 9–10). Only the look changes: every plant, stone and pond stands where the map put it, and the stations,
 * trains, tracks and switches look the same in every scene.
 */

export type SceneTheme = 'meadow' | 'autumn' | 'snow';

/** The scene of a map, by its number of stations; a mirrored map keeps it. */
export function themeFor(map: TrackMap): SceneTheme {
  const stations = map.stations.length;
  if (stations >= 7) return 'snow';
  if (stations >= 5) return 'autumn';
  return 'meadow';
}

/** A crown of leaves or needles: its body, its shaded side and its lit side. */
export interface Foliage {
  body: string;
  shade: string;
  light: string;
}

export interface Scene {
  /** The ground's radial gradient, from its center to its edge. */
  ground: readonly [string, string];
  /** The large soft patches on the ground: grass, fallen leaves or snow. */
  patch: string;
  patchOpacity: number;
  /** A pond: its bank, its water (or ice) from the center to the edge, its rim and the moon shining in it. */
  pond: {
    bank: string;
    water: readonly [string, string];
    rim: string;
    moon: string;
    moonOpacity: number;
    /** What floats on it: a lily pad, a fallen leaf; nothing on the ice. */
    floating?: string;
    reeds: string;
    cattails: string;
  };
  /** Pines, round trees and bushes, in their two variants. */
  pine: readonly [Foliage, Foliage];
  tree: readonly [Foliage, Foliage];
  bush: readonly [Foliage, Foliage];
  berries: string;
  bark: string;
  /** A rock's body and its top face, in its two variants. */
  rock: readonly [readonly [string, string], readonly [string, string]];
  /** Grass blades, flower stems and reeds on the ground. */
  grass: string;
  /** What lies on the ground in little groups: flower petals, fallen leaves, or a snow mound (light, then shade). */
  spots: readonly string[];
  /** The snow on the trees, the rocks and the ground; none where it does not snow. */
  snow?: string;
  /** The mound the tunnel goes into: its body, its lit top and the tufts of grass on it (none under snow). */
  mound: { body: string; top: string; grass?: string };
}

const MEADOW_LEAF: Foliage = { body: '#246a50', shade: '#1c4f3f', light: '#2f8462' };

/** The pines stay dark green in every scene, so they read against the warm and the white ones. */
const PINES: readonly [Foliage, Foliage] = [MEADOW_LEAF, { ...MEADOW_LEAF, body: '#22625e' }];

export const SCENES: Record<SceneTheme, Scene> = {
  meadow: {
    ground: ['#13282b', '#0a151b'],
    patch: '#1a3a33',
    patchOpacity: 0.45,
    pond: {
      bank: '#1a3a33',
      water: ['#1b4a63', '#0c263a'],
      rim: '#2a5a6a',
      moon: '#f4f1d0',
      moonOpacity: 0.55,
      floating: '#2f8462',
      reeds: '#3c7a55',
      cattails: '#7a5544',
    },
    pine: PINES,
    tree: [MEADOW_LEAF, { ...MEADOW_LEAF, body: '#2a6a4a' }],
    bush: [MEADOW_LEAF, MEADOW_LEAF],
    berries: '#ff8fa3',
    bark: '#4a3530',
    rock: [
      ['#4b5370', '#646d90'],
      ['#454c68', '#5d6687'],
    ],
    grass: '#3c8a62',
    spots: ['#ffd6e8', '#fff2a8', '#cfc2ff', '#ffffff'],
    mound: { body: '#16302b', top: '#1d3d34', grass: '#3c8a62' },
  },
  autumn: {
    ground: ['#272114', '#110e0a'],
    patch: '#4a3018',
    patchOpacity: 0.3,
    pond: {
      bank: '#2a2216',
      water: ['#143542', '#081822'],
      rim: '#2b4650',
      moon: '#f4e2bc',
      moonOpacity: 0.45,
      floating: '#c8682c',
      reeds: '#8a7a42',
      cattails: '#5e3b28',
    },
    pine: PINES,
    tree: [
      { body: '#b9602a', shade: '#86391d', light: '#de9446' },
      { body: '#a23a2c', shade: '#6e2320', light: '#cf6a3c' },
    ],
    bush: [
      { body: '#aa7a2c', shade: '#74481c', light: '#d6a64a' },
      { body: '#b0532a', shade: '#7a2e1c', light: '#d8803f' },
    ],
    berries: '#e8483a',
    bark: '#4a3328',
    rock: [
      ['#4f4f60', '#6a6a7e'],
      ['#48485a', '#626276'],
    ],
    grass: '#8c7a3c',
    spots: ['#d0702c', '#b8432f', '#d9a23e', '#9e5a2a'],
    mound: { body: '#2a2518', top: '#3a3221', grass: '#8c7a3c' },
  },
  snow: {
    ground: ['#212a3a', '#0e131d'],
    patch: '#c9d6ea',
    patchOpacity: 0.08,
    pond: {
      bank: '#9aabc2',
      water: ['#9fb4ca', '#62799a'],
      rim: '#d4e0ee',
      moon: '#ffffff',
      moonOpacity: 0.7,
      reeds: '#66728a',
      cattails: '#4a3a35',
    },
    pine: [
      { body: '#1f4d48', shade: '#173b38', light: '#2a6058' },
      { body: '#1e4652', shade: '#163640', light: '#295a66' },
    ],
    tree: [
      { body: '#2b4d58', shade: '#1f3a44', light: '#3d6670' },
      { body: '#33495e', shade: '#243649', light: '#46607a' },
    ],
    bush: [
      { body: '#2a4650', shade: '#1f363f', light: '#3a5d68' },
      { body: '#2a4650', shade: '#1f363f', light: '#3a5d68' },
    ],
    berries: '#ff5d6c',
    bark: '#3e3236',
    rock: [
      ['#4b5370', '#646d90'],
      ['#454c68', '#5d6687'],
    ],
    grass: '#7d8fa8',
    spots: ['#d6e1ef', '#a3b4cb'],
    snow: '#d6e1ef',
    mound: { body: '#7d8ea8', top: '#c3d0e2' },
  },
};
