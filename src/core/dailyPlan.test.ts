import { generateDailyPlan } from './dailyPlan';
import type { Area } from '../games/types';

const G: { id: string; area: Area }[] = [
  { id: 'm', area: 'memory' },
  { id: 'a', area: 'attention' },
  { id: 's', area: 'speed' },
  { id: 'f', area: 'flexibility' },
  { id: 'q', area: 'math' },
];
const areaOf = (id: string) => G.find((g) => g.id === id)!.area;
const plays = (ids: string[], day: string) => ids.map((gameId) => ({ gameId, day }));

test('deterministic, 3 distinct areas', () => {
  const input = { day: '2026-10-20', games: G, recentPlays: [], yesterdayPlan: null };
  const p = generateDailyPlan(input);
  expect(generateDailyPlan(input)).toEqual(p);
  expect(p).toHaveLength(3);
  expect(new Set(p.map(areaOf)).size).toBe(3);
});

test('different days can produce different plans', () => {
  const days = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const plans = days.map((day) => generateDailyPlan({ day, games: G, recentPlays: [], yesterdayPlan: null }).join());
  expect(new Set(plans).size).toBeGreaterThan(1);
});

test('prefers least-played areas in last 7 days', () => {
  const recent = plays(['m', 'm', 'a', 'a', 's', 's'], '2026-10-19');
  const p = generateDailyPlan({ day: '2026-10-20', games: G, recentPlays: recent, yesterdayPlan: null });
  expect(p.slice(0, 2).sort()).toEqual(['f', 'q']);
});

test('plays older than 7 days do not count', () => {
  const recent = [...plays(['f', 'f', 'f', 'q', 'q', 'q'], '2026-10-13'), ...plays(['m', 'a', 's'], '2026-10-19')];
  const p = generateDailyPlan({ day: '2026-10-20', games: G, recentPlays: recent, yesterdayPlan: null });
  expect(p.slice(0, 2).sort()).toEqual(['f', 'q']);
});

test('avoids yesterday when possible', () => {
  const p = generateDailyPlan({ day: '2026-10-20', games: G, recentPlays: [], yesterdayPlan: ['m', 'a', 's'] });
  expect(p).toEqual(expect.arrayContaining(['f', 'q']));
});

test('fewer games than 3', () => {
  expect(generateDailyPlan({ day: '2026-10-20', games: G.slice(0, 2), recentPlays: [], yesterdayPlan: null })).toHaveLength(2);
});
