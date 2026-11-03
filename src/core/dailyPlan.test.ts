import { generateDailyPlan } from './dailyPlan';
import { addDays } from './dates';
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

describe('an area with two games', () => {
  // Math has two games, like Quick Math and Star Shower.
  const G2: { id: string; area: Area }[] = [...G, { id: 'r', area: 'math' }];
  const areaOf2 = (id: string) => G2.find((g) => g.id === id)!.area;
  const DAYS = Array.from({ length: 10 }, (_, i) => addDays('2026-10-20', i));

  test('goes last when one of its games was in yesterday plan, even as the least played', () => {
    // Math is the least played area, and its other game was not in yesterday's plan; three other areas are fresh.
    const recent = plays(['a', 's', 'f'], '2026-10-19');
    for (const day of DAYS) {
      const p = generateDailyPlan({ day, games: G2, recentPlays: recent, yesterdayPlan: ['q', 'm'] });
      expect(p.map(areaOf2), day).not.toContain('math');
    }
  });

  test('does not appear every day over a month of consecutive plans', () => {
    let yesterdayPlan: string[] | null = null;
    let mathDays = 0;
    for (let i = 0; i < 30; i++) {
      const plan = generateDailyPlan({ day: addDays('2026-10-01', i), games: G2, recentPlays: [], yesterdayPlan });
      if (plan.some((id) => areaOf2(id) === 'math')) mathDays++;
      yesterdayPlan = plan;
    }
    expect(mathDays).toBeLessThan(30);
  });
});

test('fewer games than 3', () => {
  expect(generateDailyPlan({ day: '2026-10-20', games: G.slice(0, 2), recentPlays: [], yesterdayPlan: null })).toHaveLength(2);
});
