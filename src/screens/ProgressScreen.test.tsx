import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp';
import { clearAllData, db } from '../data/db';
import { addResult } from '../data/results';

const base = { level: 1, accuracy: 1, durationMs: 60000, isDaily: false };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 10));
  await clearAllData();
});
afterEach(() => {
  vi.useRealTimers();
});

test('empty state', async () => {
  await renderApp('/progress');
  expect(await screen.findByText('Todavía no hay partidas. ¡Juega una para ver tu progreso!')).toBeInTheDocument();
});

test('area meters, streaks, days trained and charts', async () => {
  await addResult({ ...base, gameId: 'arrows', score: 100, playedAt: new Date(2026, 9, 18, 9) });
  await addResult({ ...base, gameId: 'arrows', score: 200, playedAt: new Date(2026, 9, 19, 9) });
  await addResult({ ...base, gameId: 'quick-math', score: 50, playedAt: new Date(2026, 9, 19, 9) });
  await db.dailyPlans.put({ day: '2026-10-19', gameIds: ['arrows', 'quick-math', 'rule-switch'], completed: ['arrows', 'quick-math', 'rule-switch'] });
  await renderApp('/progress');
  const attention = await screen.findByRole('meter', { name: 'Atención' });
  expect(attention).toHaveAttribute('value', '143');
  expect(screen.getByRole('meter', { name: 'Matemáticas' })).toHaveAttribute('value', '100');
  expect(screen.queryByRole('meter', { name: 'Memoria' })).not.toBeInTheDocument();
  expect(screen.getByText('Racha actual: 1')).toBeInTheDocument();
  expect(screen.getByText('Mejor racha: 1')).toBeInTheDocument();
  expect(screen.getByText('Días entrenados: 2')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /máximo 200, último 200/ })).toBeInTheDocument();
  expect(screen.getByText('Juega al menos dos partidas para ver tu evolución.')).toBeInTheDocument();
});
