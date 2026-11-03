import { GAMES, getGame } from './registry';
import { V1_AREAS } from './types';
import es from '../i18n/es.json';
import en from '../i18n/en.json';

type GameTexts = { title: string; description: string; skill: string; practice?: { recap?: string } };
const dicts = [es, en] as unknown as Array<{ games: Record<string, GameTexts | undefined> }>;

test('registry entries are valid', () => {
  const ids = GAMES.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const g of GAMES) {
    expect(V1_AREAS).toContain(g.area);
    expect(g.maxScore).toBeGreaterThan(g.referenceScore);
    expect(g.referenceScore).toBeGreaterThan(0);
    expect(g.Thumb).toBeTypeOf('function');
    expect(g.Practice, `${g.id} Practice`).toBeTypeOf('function');
    for (const dict of dicts) {
      const texts = dict.games[g.id];
      expect(texts?.title, `${g.id} title`).toBeTruthy();
      expect(texts?.description, `${g.id} description`).toBeTruthy();
      expect(texts?.skill, `${g.id} skill`).toBeTruthy();
      expect(texts?.practice?.recap, `${g.id} practice.recap`).toBeTruthy();
    }
  }
  expect(getGame('nope')).toBeUndefined();
});

test('skill texts', () => {
  expect(es.games['same-different'].skill).toBe('Velocidad de procesamiento');
  expect(en.games['rule-switch'].skill).toBe('Task switching');
});
