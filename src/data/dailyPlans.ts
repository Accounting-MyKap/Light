import { generateDailyPlan } from '../core/dailyPlan';
import { addDays } from '../core/dates';
import { GAMES } from '../games/registry';
import { db, type DailyPlan } from './db';

export function getPlan(day: string): Promise<DailyPlan | undefined> {
  return db.dailyPlans.get(day);
}

export async function getOrCreatePlan(day: string): Promise<DailyPlan> {
  return db.transaction('rw', db.dailyPlans, db.results, async () => {
    const existing = await db.dailyPlans.get(day);
    if (existing) return existing;
    const since = addDays(day, -6);
    const recent = await db.results.where('day').between(since, day, true, true).toArray();
    const yesterday = await db.dailyPlans.get(addDays(day, -1));
    const plan: DailyPlan = {
      day,
      gameIds: generateDailyPlan({
        day,
        games: GAMES,
        recentPlays: recent.map((r) => ({ gameId: r.gameId, day: r.day })),
        yesterdayPlan: yesterday?.gameIds ?? null,
      }),
      completed: [],
    };
    await db.dailyPlans.put(plan);
    return plan;
  });
}

export async function markDailyGameDone(day: string, gameId: string): Promise<DailyPlan> {
  const plan = await getOrCreatePlan(day);
  return db.transaction('rw', db.dailyPlans, async () => {
    const current = (await db.dailyPlans.get(day)) ?? plan;
    if (!current.gameIds.includes(gameId) || current.completed.includes(gameId)) return current;
    const updated = { ...current, completed: [...current.completed, gameId] };
    await db.dailyPlans.put(updated);
    return updated;
  });
}

export function isPlanComplete(plan: DailyPlan): boolean {
  return plan.gameIds.length > 0 && plan.gameIds.every((id) => plan.completed.includes(id));
}

export async function completedDays(): Promise<string[]> {
  const plans = await db.dailyPlans.toArray();
  return plans.filter(isPlanComplete).map((p) => p.day);
}
