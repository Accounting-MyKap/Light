import { CATALOG_AREAS, catalogAreas } from './catalog';
import { GAMES } from './registry';

test('catalog areas with games, in catalog order', () => {
  expect(catalogAreas(GAMES)).toEqual(['speed', 'memory', 'attention', 'flexibility', 'math']);
  expect(CATALOG_AREAS).toHaveLength(7);
});

test('no games, no areas', () => {
  expect(catalogAreas([])).toEqual([]);
});
