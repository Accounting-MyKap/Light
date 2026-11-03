import type { Area, GameDefinition } from './types';

export const CATALOG_AREAS: readonly Area[] = [
  'speed',
  'memory',
  'attention',
  'flexibility',
  'logic',
  'math',
  'language',
];

/** Areas of the catalog that have at least one game, in catalog order. */
export function catalogAreas(games: readonly GameDefinition[]): Area[] {
  return CATALOG_AREAS.filter((a) => games.some((g) => g.area === a));
}
