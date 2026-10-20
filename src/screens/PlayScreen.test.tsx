import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { registerFakeGameTranslations } from '../test/fakeGame';
import { clearAllData, db } from '../data/db';
import { getSettings, updateSettings } from '../data/settings';
import { fetchPercentile, getRemote, requestSync } from '../sync';

// UI code reaches sync only through this module, so one mock keeps these tests off the network.
vi.mock('../sync');

vi.mock('../games/registry', async () => {
  const { fakeGame, fakeGame2 } = await import('../test/fakeGame');
  const games = [fakeGame, fakeGame2];
  return { GAMES: games, getGame: (id: string) => games.find((g) => g.id === id) };
});

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

// Finishing a game asks for a sync twice: once to upload the result, once from the percentile line on the result screen.
const FINISH_SYNCS = 2;

beforeEach(async () => {
  vi.mocked(requestSync).mockReset().mockResolvedValue(null);
  vi.mocked(getRemote).mockReset().mockReturnValue(null);
  vi.mocked(fetchPercentile).mockReset().mockResolvedValue(null);
  await clearAllData();
});
afterEach(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  vi.restoreAllMocks();
});

async function open(route: string) {
  await renderApp(route);
  registerFakeGameTranslations();
}

test('first visit shows instructions, then plays and shows result with new best', async () => {
  await open('/play/fake');
  expect(await screen.findByRole('heading', { name: 'Juego falso' })).toBeInTheDocument();
  expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
  expect(screen.getByText('fake example')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toContain('fake'));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(await db.results.count()).toBe(1);
});

test('second visit skips instructions but offers how-to-play', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  expect(await screen.findByRole('button', { name: '¿Cómo se juega?' })).toBeInTheDocument();
  expect(screen.queryByText('Primera instrucción falsa')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
  expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
});

test('hidden tab pauses the game', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  expect(screen.getByText('paused:false')).toBeInTheDocument();
  setHidden(true);
  expect(screen.getByText('Pausado')).toBeInTheDocument();
  expect(screen.getByText('paused:true')).toBeInTheDocument();
  setHidden(false);
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.getByText('paused:false')).toBeInTheDocument();
});

test('exit from pause does not save', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  expect(screen.getByText('paused:true')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect(await db.results.count()).toBe(0);
});

test('unknown game id', async () => {
  await open('/play/nope');
  expect(await screen.findByText('No encontramos ese juego')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
});

test('daily mode offers the next game of the plan', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['fake', 'other', 'third'], completed: [] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Siguiente juego' }));
  expect(await screen.findByText('No encontramos ese juego')).toBeInTheDocument();
  expect((await db.dailyPlans.get('2026-10-20'))?.completed).toEqual(['fake']);
});

test('daily mode on the last game offers the summary', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['other', 'fake'], completed: ['other'] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Ver resumen' }));
  expect(await screen.findByRole('navigation')).toBeInTheDocument();
});

test('exiting a later daily game returns to Today, not to the previous game', async () => {
  await updateSettings({ seenInstructions: ['fake', 'fake2'] });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['fake', 'fake2'], completed: [] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Siguiente juego' }));
  expect(await screen.findByRole('heading', { name: 'Segundo juego falso' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(await screen.findByRole('heading', { name: 'Entrenamiento de hoy' })).toBeInTheDocument();
});

test('finishing a game requests a sync', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  expect(requestSync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(requestSync).toHaveBeenCalledTimes(FINISH_SYNCS);
  // The sync starts after the result is in storage, so it has something to upload.
  expect(await db.results.where('synced').equals(0).count()).toBe(1);
  // Starting another round is not a finished game.
  await userEvent.click(screen.getByRole('button', { name: 'Jugar de nuevo' }));
  expect(screen.getByText('paused:false')).toBeInTheDocument();
  expect(requestSync).toHaveBeenCalledTimes(FINISH_SYNCS);
});

test('a failed save does not request a sync; the successful retry does, once', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(db.results, 'put').mockRejectedValueOnce(new Error('QuotaExceededError'));
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('No pudimos guardar tu partida.')).toBeInTheDocument();
  expect(requestSync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(requestSync).toHaveBeenCalledTimes(FINISH_SYNCS);
});

test('the result screen shows the percentile once the game has been ranked', async () => {
  vi.mocked(fetchPercentile).mockResolvedValue(73);
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  expect(fetchPercentile).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('Estás por encima del 73 % de los jugadores')).toBeInTheDocument();
  expect(fetchPercentile).toHaveBeenCalledWith(null, 'fake', expect.any(Date));
});
