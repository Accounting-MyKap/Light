import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { getPlan, markDailyGameDone } from '../data/dailyPlans';
import { addResult } from '../data/results';

const DAY = '2026-10-20';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  await clearAllData();
});
afterEach(() => {
  vi.useRealTimers();
});

async function plan() {
  await vi.waitFor(async () => expect(await getPlan(DAY)).toBeDefined());
  return (await getPlan(DAY))!;
}

test('shows streak, the 3 planned games in order and a start link', async () => {
  await renderApp('/');
  const p = await plan();
  expect(await screen.findByText('0 días seguidos')).toBeInTheDocument();
  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(3);
  const start = await screen.findByRole('link', { name: 'Comenzar' });
  expect(start).toHaveAttribute('href', `/play/${p.gameIds[0]}?daily=${DAY}`);
});

test('continue points to the next unfinished game', async () => {
  await renderApp('/');
  const p = await plan();
  await markDailyGameDone(DAY, p.gameIds[0]);
  const link = await screen.findByRole('link', { name: 'Continuar' });
  expect(link).toHaveAttribute('href', `/play/${p.gameIds[1]}?daily=${DAY}`);
  expect(within(screen.getAllByRole('listitem')[0]).getByText('Hecho')).toBeInTheDocument();
});

test('completed day shows the summary with today scores and streak 1', async () => {
  await renderApp('/');
  const p = await plan();
  for (const [i, id] of p.gameIds.entries()) {
    await addResult({ gameId: id, level: 1, score: 100 + i, accuracy: 1, durationMs: 60000, isDaily: true });
    await markDailyGameDone(DAY, id);
  }
  expect(await screen.findByRole('heading', { name: '¡Entrenamiento de hoy completado!' })).toBeInTheDocument();
  expect(await screen.findByText('1 día seguido')).toBeInTheDocument();
  for (const score of ['100', '101', '102']) expect(screen.getByText(score)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Continuar' })).not.toBeInTheDocument();
  expect(await db.dailyPlans.count()).toBe(1);
});
