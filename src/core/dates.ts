const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as 'YYYY-MM-DD'. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUtcMs(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

const DAY_MS = 86_400_000;

/** Calendar arithmetic in UTC so daylight-saving changes never skip or repeat a day. */
export function addDays(day: string, delta: number): string {
  const date = new Date(toUtcMs(day) + delta * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}
