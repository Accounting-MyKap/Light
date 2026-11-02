import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';
import { registerFakeGameTranslations } from '../test/fakeGame';
import { clearAllData, db } from '../data/db';
import * as levels from '../data/levels';
import { getSettings, updateSettings } from '../data/settings';
import { fetchPercentile, getRemote, requestSync } from '../sync';

// UI code reaches sync only through this module, so one mock keeps these tests off the network.
vi.mock('../sync');

// The 3-2-1 countdown takes 3 steps. The tests that need to see the game while it is still counting raise the step
// to one wide enough that a loaded runner cannot let the countdown end between a click and the next assertion.
const resumeTiming = vi.hoisted(() => ({ stepMs: 5 }));
const SLOW_STEP_MS = 200;
// Waiting out a whole slow countdown (three steps) is the one thing those tests pay for.
const SLOW_COUNTDOWN = { timeout: 5_000 };
vi.mock('./play/resumeTiming', () => ({
  get RESUME_STEP_MS() {
    return resumeTiming.stepMs;
  },
}));

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
  resumeTiming.stepMs = 5;
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

test('every phase of the game screen sits inside the dark Luz scope of the game area', async () => {
  await open('/play/fake');
  const heading = await screen.findByRole('heading', { name: 'Juego falso' });
  expect(heading.closest('[data-luz][data-area="memory"]')).not.toBeNull();
});

test('the dark Luz scope is already there while the game is still loading', async () => {
  vi.spyOn(levels, 'getStartLevel').mockReturnValue(new Promise(() => {}));
  const { container } = await renderApp('/play/fake');
  expect(container.querySelector('[data-luz][data-area="memory"]')).not.toBeNull();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

test('second visit skips instructions but offers how-to-play', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  expect(await screen.findByRole('button', { name: '¿Cómo se juega?' })).toBeInTheDocument();
  expect(screen.queryByText('Primera instrucción falsa')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
  expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
});

test('the intro shows the area label', async () => {
  await open('/play/fake');
  expect(await screen.findByText('Memoria')).toBeInTheDocument();
});

test('the intro for a returning player shows the area label too', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  expect(await screen.findByRole('button', { name: 'Comenzar' })).toBeInTheDocument();
  expect(screen.getByText('Memoria')).toBeInTheDocument();
});

test('the instructions have a ✕ that leaves without playing or saving', async () => {
  await open('/play/fake');
  expect(await screen.findByText('Primera instrucción falsa')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect(await db.results.count()).toBe(0);
});

test('the intro for a returning player has the ✕ too', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  expect(await screen.findByRole('button', { name: '¿Cómo se juega?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
});

test('the ✕ on the intro of a daily game goes back to Today', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['fake', 'fake2'], completed: [] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Salir del juego' }));
  expect(await screen.findByRole('heading', { name: 'Entrenamiento de hoy' })).toBeInTheDocument();
  expect(await db.results.count()).toBe(0);
});

test('the frame shows the game title and its ✕ opens the pause sheet with time and points', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  const game = document.querySelector<HTMLElement>('[data-game="fake"]')!;
  expect(within(game).getByRole('heading', { level: 1, name: 'Juego falso' })).toBeInTheDocument();
  // The screen draws no top bar of its own: the only title is the frame's.
  expect(screen.getAllByRole('heading', { name: 'Juego falso' })).toHaveLength(1);

  await userEvent.click(screen.getByRole('button', { name: 'Acertar' }));
  await userEvent.click(within(game).getByRole('button', { name: 'Salir del juego' }));
  const sheet = screen.getByRole('dialog', { name: 'Pausado' });
  // The score and the time the frame reported are what the sheet shows.
  expect(within(sheet).getByText('puntos').parentElement).toHaveTextContent('10');
  expect(within(sheet).getByText('quedan').parentElement).toHaveTextContent('35 s');
  expect(within(sheet).getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
  expect(within(sheet).getByRole('button', { name: 'Salir' })).toBeInTheDocument();
});

test('the game behind the pause sheet cannot be reached until it runs again', async () => {
  resumeTiming.stepMs = SLOW_STEP_MS;
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  const behindGame = () => screen.getByText(/^paused:/).closest('[inert]');
  expect(behindGame()).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  expect(behindGame()).not.toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(behindGame()).not.toBeNull(); // still counting
  expect(await screen.findByText('paused:false', undefined, SLOW_COUNTDOWN)).toBeInTheDocument();
  expect(behindGame()).toBeNull();
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
  expect(await screen.findByText('paused:false')).toBeInTheDocument();
});

test('continue counts down before the game runs again', async () => {
  resumeTiming.stepMs = SLOW_STEP_MS;
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  // The sheet is gone and the numbers are on screen, but the game has not started again.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByText('paused:true')).toBeInTheDocument();
  expect(await screen.findByText('paused:false', undefined, SLOW_COUNTDOWN)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('hiding the app during the countdown returns to the pause sheet', async () => {
  resumeTiming.stepMs = SLOW_STEP_MS;
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(screen.getByText('paused:true')).toBeInTheDocument(); // counting down
  setHidden(true);
  expect(screen.getByText('Pausado')).toBeInTheDocument();
  expect(screen.getByText('paused:true')).toBeInTheDocument();
  setHidden(false);
  // The interrupted countdown does not finish behind the sheet: a whole countdown later, the game is still paused.
  await new Promise((resolve) => setTimeout(resolve, 3 * SLOW_STEP_MS + 100));
  expect(screen.getByText('Pausado')).toBeInTheDocument();
  expect(screen.getByText('paused:true')).toBeInTheDocument();
  // Continuing again starts a fresh countdown that does finish.
  resumeTiming.stepMs = 5;
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('paused:false')).toBeInTheDocument();
});

test('the sheet takes focus, and the game gets it back when the countdown ends', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('paused:false')).toBeInTheDocument();
  expect(document.querySelector('[data-game="fake"]')).toHaveFocus();
});

test('the playing region has the name of the game, so the focus after the countdown lands on something named', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  const region = screen.getByRole('region', { name: 'Juego falso' });
  expect(region).toBe(document.querySelector('[data-game="fake"]'));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  expect(await screen.findByText('paused:false')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Juego falso' })).toHaveFocus();
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

test('daily mode shows how many games of the plan are done, counting the one just played', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['other', 'fake', 'third'], completed: ['other'] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('Entrenamiento de hoy: 2 de 3')).toBeInTheDocument();
});

test('free play shows no daily progress', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('Puntaje: 120')).toBeInTheDocument();
  expect(screen.queryByText(/Entrenamiento de hoy:/)).not.toBeInTheDocument();
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
