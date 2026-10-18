import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { registerFakeGameTranslations } from '../test/fakeGame';
import { clearAllData, db } from '../data/db';
import { updateSettings } from '../data/settings';

vi.mock('../games/registry', async () => {
  const { fakeGame } = await import('../test/fakeGame');
  return { GAMES: [fakeGame], getGame: (id: string) => (id === 'fake' ? fakeGame : undefined) };
});

beforeEach(async () => {
  await clearAllData();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

test('a failed save at the end of a game offers a retry instead of freezing', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  vi.spyOn(db.results, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await renderApp('/play/fake');
  registerFakeGameTranslations();
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('No pudimos guardar tu partida.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(await db.results.count()).toBe(1);
});

test('a failing settings read does not blank the app', async () => {
  vi.spyOn(db.settings, 'get').mockRejectedValue(new Error('boom'));
  await renderApp('/');
  expect(await screen.findByRole('navigation')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 1, name: 'Entrenamiento de hoy' })).toBeInTheDocument();
});

test('a failed daily plan creation shows a message', async () => {
  vi.spyOn(db.dailyPlans, 'put').mockRejectedValue(new Error('boom'));
  await renderApp('/');
  expect(
    await screen.findByText('No pudimos preparar tu entrenamiento de hoy. Intenta recargar la página.'),
  ).toBeInTheDocument();
});
