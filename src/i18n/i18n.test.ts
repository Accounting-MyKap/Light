import { detectLanguage, type Language } from './index';
import es from './es.json';
import en from './en.json';

type Tree = { [key: string]: string | Tree | Tree[] | string[] };

function flatten(tree: unknown, prefix = ''): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  if (Array.isArray(tree)) return tree.flatMap((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i)));
  if (tree && typeof tree === 'object') {
    return Object.entries(tree as Tree).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}
const flattenKeys = (t: unknown) => flatten(t).map(([k]) => k);
const flattenValues = (t: unknown) => flatten(t).map(([, v]) => v);

test.each([
  [null, ['es-CO', 'en'], 'es'],
  [null, ['en-US'], 'en'],
  [null, ['pt-BR'], 'en'],
  [null, [], 'en'],
  ['en', ['es-ES'], 'en'],
  ['es', ['en-US'], 'es'],
])('detectLanguage(%s, %j) = %s', (saved, langs, expected) => {
  expect(detectLanguage(saved as Language | null, langs)).toBe(expected);
});

test('es and en have identical key sets', () => {
  expect(flattenKeys(es).sort()).toEqual(flattenKeys(en).sort());
});

test('no empty strings', () => {
  for (const v of [...flattenValues(es), ...flattenValues(en)]) expect(v.trim()).not.toBe('');
});

test('no medical or cognitive-benefit claims', () => {
  const banned = [
    /alzheimer/i, /demencia/i, /dementia/i, /mejora tu memoria/i, /improve your memory/i,
    /\bIQ\b/, /coeficiente intelectual/i, /cl[ií]nicamente/i, /clinically/i,
    /cient[ií]ficamente probado/i, /scientifically proven/i,
  ];
  for (const v of [...flattenValues(es), ...flattenValues(en)]) {
    for (const re of banned) expect(v).not.toMatch(re);
  }
});
