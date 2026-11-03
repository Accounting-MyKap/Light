import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../app/App';
import { initI18n } from '../i18n';
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
  const { fakeGame, fakeGame2, fakeGame3, fakeGameNoPractice, fakeQuizGame } = await import('../test/fakeGame');
  const training = [fakeGame, fakeGame2, fakeGame3, fakeGameNoPractice];
  const games = [...training, fakeQuizGame];
  return {
    GAMES: games,
    TRAINING_GAMES: training,
    QUIZ_GAMES: [fakeQuizGame],
    getGame: (id: string) => games.find((g) => g.id === id),
  };
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

/** Shows where the router is, so a test can tell which route a navigation ended on. */
function LocationProbe() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

async function openWithProbe(route: string) {
  await initI18n('es');
  render(
    <MemoryRouter initialEntries={[route]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
  registerFakeGameTranslations();
}

// A first visit starts on the practice intro; skipping the practice goes straight to the game.
async function startFirstVisit() {
  await userEvent.click(await screen.findByRole('button', { name: 'Saltar práctica' }));
}

test('first visit offers the practice, then the «¡Listo!» screen, then the game with its result', async () => {
  await open('/play/fake');
  expect(await screen.findByRole('heading', { name: 'Juego falso' })).toBeInTheDocument();
  expect(screen.getByText(/Vamos a practicar/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Empezar práctica' }));
  expect(screen.getByText('fake practice')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Terminar práctica' }));
  expect(screen.getByRole('heading', { name: '¡Listo! Ahora va en serio' })).toBeInTheDocument();
  expect(screen.getByText('Resumen falso')).toBeInTheDocument();
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toContain('fake'));
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(await db.results.count()).toBe(1);
});

test('first visit of a game without a practice shows instructions, then plays and shows result with new best', async () => {
  await open('/play/fakenp');
  expect(await screen.findByRole('heading', { name: 'Juego falso sin práctica' })).toBeInTheDocument();
  expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
  expect(screen.getByText('fake example')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Saltar práctica' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toContain('fakenp'));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  expect(screen.getByText('¡Nueva mejor marca!')).toBeInTheDocument();
  expect(await db.results.count()).toBe(1);
});

test('skipping from the first-visit intro starts the game and marks it seen', async () => {
  await open('/play/fake');
  await startFirstVisit();
  expect(screen.getByText('paused:false')).toBeInTheDocument();
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toContain('fake'));
});

test('skipping the first-visit practice halfway starts the game and marks it seen', async () => {
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Empezar práctica' }));
  await userEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(screen.getByText('paused:false')).toBeInTheDocument();
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toContain('fake'));
});

test('the ✕ of the first-visit intro does not mark the game as seen', async () => {
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Salir del juego' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect((await getSettings()).seenInstructions).not.toContain('fake');
  expect(await db.results.count()).toBe(0);
});

test('a returning player opens the practice from «¿Cómo se juega?»; skipping goes back to the intro', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: '¿Cómo se juega?' }));
  expect(screen.getByText('fake practice')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(screen.getByRole('button', { name: 'Comenzar' })).toBeInTheDocument();
  expect(screen.getByText('Un juego para pruebas')).toBeInTheDocument();
  expect(screen.queryByText('fake practice')).not.toBeInTheDocument();
});

test('a returning player who finishes the practice gets «¡Listo!» and then starts the game', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: '¿Cómo se juega?' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar práctica' }));
  expect(screen.getByText('Resumen falso')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  expect(screen.getByText('paused:false')).toBeInTheDocument();
});

test('«¿Cómo se juega?» in the pause shows the practice over the game and comes back to the same sheet', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Acertar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  const sheet = screen.getByRole('dialog', { name: 'Pausado' });
  const buttons = within(sheet).getAllByRole('button').map((b) => b.textContent);
  expect(buttons).toEqual(['Continuar', '¿Cómo se juega?', 'Salir']);

  await userEvent.click(within(sheet).getByRole('button', { name: '¿Cómo se juega?' }));
  expect(screen.getByRole('dialog', { name: '¿Cómo se juega?' })).toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: '¿Cómo se juega?' }).contains(document.activeElement)).toBe(true);
  expect(screen.getByText('fake practice')).toBeInTheDocument();
  // The game is still there, paused and out of reach.
  expect(screen.getByText('paused:true').closest('[inert]')).not.toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Terminar práctica' }));
  expect(screen.queryByText('fake practice')).not.toBeInTheDocument();
  const again = screen.getByRole('dialog', { name: 'Pausado' });
  expect(within(again).getByText('puntos').parentElement).toHaveTextContent('10');
  expect(within(again).getByText('quedan').parentElement).toHaveTextContent('35 s');
  expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
});

test('skipping the practice from the pause also comes back to the sheet', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
  await userEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
  expect(screen.getByRole('dialog', { name: 'Pausado' })).toBeInTheDocument();
  // A second opening mounts a fresh practice.
  await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
  expect(screen.getByText('fake practice')).toBeInTheDocument();
});

test('hiding the app during the pause practice does not close it', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
  setHidden(true);
  expect(screen.getByText('fake practice')).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Pausado' })).not.toBeInTheDocument();
  setHidden(false);
  expect(screen.getByText('fake practice')).toBeInTheDocument();
});

describe('a game without a practice (Guardagujas, the quiz games)', () => {
  /** A second visit to the game without a practice, started and paused with 10 points. */
  async function playAndPause() {
    await updateSettings({ seenInstructions: ['fakenp'] });
    await open('/play/fakenp');
    await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Acertar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  }

  test('a returning player opens its instructions from «¿Cómo se juega?», and «Comenzar» starts the game', async () => {
    await updateSettings({ seenInstructions: ['fakenp'] });
    await open('/play/fakenp');
    await userEvent.click(await screen.findByRole('button', { name: '¿Cómo se juega?' }));
    expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
    expect(screen.getByText('fake example')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Saltar práctica' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(screen.getByText('paused:false')).toBeInTheDocument();
  });

  test('«¿Cómo se juega?» in the pause shows its instructions in the layer, and «Volver» comes back to the sheet', async () => {
    await playAndPause();
    const sheet = screen.getByRole('dialog', { name: 'Pausado' });
    const buttons = within(sheet).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Continuar', '¿Cómo se juega?', 'Salir']);

    await userEvent.click(within(sheet).getByRole('button', { name: '¿Cómo se juega?' }));
    const layer = screen.getByRole('dialog', { name: '¿Cómo se juega?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(layer.contains(document.activeElement)).toBe(true);
    expect(within(layer).getByText('Primera instrucción falsa')).toBeInTheDocument();
    expect(within(layer).getByText('fake example')).toBeInTheDocument();
    // Its main button goes back, it does not start anything.
    expect(within(layer).queryByRole('button', { name: 'Comenzar' })).not.toBeInTheDocument();
    // The game is still there, paused and out of reach.
    expect(screen.getByText('paused:true').closest('[inert]')).not.toBeNull();

    await userEvent.click(within(layer).getByText('Volver', { selector: 'button' }));
    expect(screen.queryByText('Primera instrucción falsa')).not.toBeInTheDocument();
    const again = screen.getByRole('dialog', { name: 'Pausado' });
    expect(within(again).getByText('puntos').parentElement).toHaveTextContent('10');
    expect(within(again).getByText('quedan').parentElement).toHaveTextContent('35 s');
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
    expect(await db.results.count()).toBe(0);
  });

  test('the ✕ of the instructions in the pause is «Volver» too and comes back to the sheet, without leaving', async () => {
    await playAndPause();
    await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
    const layer = screen.getByRole('dialog', { name: '¿Cómo se juega?' });
    expect(within(layer).getByText('✕', { selector: 'button' })).toHaveAccessibleName('Volver');
    // It does not leave the game, so it is not named «Salir del juego».
    expect(within(layer).queryByRole('button', { name: 'Salir del juego' })).not.toBeInTheDocument();
    await userEvent.click(within(layer).getByText('✕', { selector: 'button' }));
    expect(screen.getByRole('dialog', { name: 'Pausado' })).toBeInTheDocument();
    expect(screen.getByText('paused:true')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('paused:false')).toBeInTheDocument();
  });

  test('hiding the app while the instructions are open in the pause does not close them', async () => {
    await playAndPause();
    await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
    setHidden(true);
    expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Pausado' })).not.toBeInTheDocument();
    setHidden(false);
    expect(screen.getByText('Primera instrucción falsa')).toBeInTheDocument();
  });
});

test('instructions come from instructionsKey when a game sets it', async () => {
  await open('/play/fake3');
  expect(await screen.findByRole('heading', { name: 'Tercer juego falso' })).toBeInTheDocument();
  expect(screen.getByText('Responde 10 preguntas; tienes 20 segundos para cada una.')).toBeInTheDocument();
  expect(screen.getByText('fake example')).toBeInTheDocument();
});

test('games that share instructions show them only once', async () => {
  // fake3 and the quiz game both use `quiz.instructions`.
  await open('/play/fake3');
  expect(await screen.findByText('Responde 10 preguntas; tienes 20 segundos para cada una.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await vi.waitFor(async () => expect((await getSettings()).seenInstructions).toEqual(['quiz.instructions']));
});

test('instructions seen under a shared key are not shown again by another game with that key', async () => {
  await updateSettings({ seenInstructions: ['quiz.instructions'] });
  await open('/play/fakeq');
  expect(await screen.findByRole('button', { name: '¿Cómo se juega?' })).toBeInTheDocument();
  expect(screen.queryByText('Responde 10 preguntas; tienes 20 segundos para cada una.')).not.toBeInTheDocument();
});

test('a game without a shared key still uses its own id', async () => {
  await updateSettings({ seenInstructions: ['quiz.instructions'] });
  await open('/play/fakenp');
  expect(await screen.findByText('Primera instrucción falsa')).toBeInTheDocument();
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

test('the intro shows the area label', async () => {
  await open('/play/fake');
  expect(await screen.findByText('Memoria')).toBeInTheDocument();
});

test('the intro of a quiz game shows its bank as the area label', async () => {
  await open('/play/fakeq');
  expect(await screen.findByText('Cultura general')).toBeInTheDocument();
  expect(screen.getByText('Cultura general').closest('[data-luz][data-area="trivia"]')).not.toBeNull();
});

test('the ✕ on the intro of a quiz game opened with no history goes to the Quiz tab', async () => {
  await updateSettings({ seenInstructions: ['quiz.instructions'] });
  await openWithProbe('/play/fakeq');
  await userEvent.click(await screen.findByRole('button', { name: 'Salir del juego' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
  expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/quiz$/);
  expect(await db.results.count()).toBe(0);
});

test('the intro for a returning player shows the area label too', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  expect(await screen.findByRole('button', { name: 'Comenzar' })).toBeInTheDocument();
  expect(screen.getByText('Memoria')).toBeInTheDocument();
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

test('daily mode: first visit, practice, game, and the result offers the next game', async () => {
  await db.dailyPlans.put({ day: '2026-10-20', gameIds: ['fake', 'fake2'], completed: [] });
  await open('/play/fake?daily=2026-10-20');
  await userEvent.click(await screen.findByRole('button', { name: 'Empezar práctica' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar práctica' }));
  await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByRole('button', { name: 'Siguiente juego' })).toBeInTheDocument();
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

test('the result screen opens at the top of the page, every time a game ends', async () => {
  // A game can leave the page scrolled down (a long quiz question with its explanation); the result must start at its title.
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  await updateSettings({ seenInstructions: ['fake'] });
  await open('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  expect(scrollTo).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('Puntaje: 120')).toBeInTheDocument();
  expect(scrollTo).toHaveBeenCalledTimes(1);
  // A jump, never a smooth scroll: it is a new screen, and nothing should glide for whoever asked for less motion.
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });

  await userEvent.click(screen.getByRole('button', { name: 'Jugar de nuevo' }));
  expect(scrollTo).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('Puntaje: 120')).toBeInTheDocument();
  expect(scrollTo).toHaveBeenCalledTimes(2);
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

describe('choosing the level', () => {
  /** A second visit to the fake game: its instructions were seen, so the intro shows. */
  async function openIntro(route = '/play/fake') {
    await updateSettings({ seenInstructions: ['fake'] });
    await open(route);
    await screen.findByRole('heading', { name: 'Juego falso' });
  }

  async function reached(level: number) {
    await db.results.put({
      id: crypto.randomUUID(),
      gameId: 'fake',
      level,
      score: 50,
      accuracy: 0.8,
      durationMs: 60000,
      isDaily: false,
      playedAt: new Date().toISOString(),
      day: '2026-11-01',
      synced: 1,
    });
  }

  test('there is nothing to choose before a level above 1 was reached', async () => {
    await openIntro();
    expect(screen.queryByRole('group', { name: 'Elige el nivel' })).toBeNull();
  });

  test('the levels already reached can be chosen, starting at the suggested one', async () => {
    await levels.setStartLevel('fake', 3);
    await reached(5);
    await openIntro();
    const group = await screen.findByRole('group', { name: 'Elige el nivel' });
    const options = within(group).getAllByRole('button');
    expect(options.map((b) => b.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(within(group).getByRole('button', { name: 'Nivel 3, sugerido' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(group).getByRole('button', { name: 'Nivel 5' }));
    expect(within(group).getByRole('button', { name: 'Nivel 5' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(await screen.findByText('startLevel:5')).toBeInTheDocument();
  });

  test('a practice game at another level keeps the suggested level, and playing again keeps the chosen one', async () => {
    await levels.setStartLevel('fake', 3);
    await reached(4);
    await openIntro();
    const group = await screen.findByRole('group', { name: 'Elige el nivel' });
    await userEvent.click(within(group).getByRole('button', { name: 'Nivel 1' }));
    expect(screen.getByText(/tu nivel sugerido \(3\) no cambia/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Terminar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Jugar de nuevo' }));
    expect(await screen.findByText('startLevel:1')).toBeInTheDocument();
    expect(await levels.getStartLevel('fake')).toBe(3);
  });

  test('the practice keeps the level chosen before it: skipping comes back with it, «Comenzar» on «¡Listo!» starts it', async () => {
    await levels.setStartLevel('fake', 3);
    await reached(5);
    await openIntro();
    const choice = await screen.findByRole('group', { name: 'Elige el nivel' });
    await userEvent.click(within(choice).getByRole('button', { name: 'Nivel 5' }));
    await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Saltar práctica' }));
    const group = screen.getByRole('group', { name: 'Elige el nivel' });
    expect(within(group).getByRole('button', { name: 'Nivel 5' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '¿Cómo se juega?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Terminar práctica' }));
    await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(await screen.findByText('startLevel:5')).toBeInTheDocument();
  });

  test('the daily training has no level choice: the game picks it', async () => {
    await levels.setStartLevel('fake', 3);
    await reached(5);
    await openIntro('/play/fake?daily=2026-11-03');
    expect(screen.queryByRole('group', { name: 'Elige el nivel' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Comenzar' }));
    expect(await screen.findByText('startLevel:3')).toBeInTheDocument();
  });
});

test('Back from a quiz result goes to the Quiz tab', async () => {
  await updateSettings({ seenInstructions: ['fakeq'] });
  await openWithProbe('/play/fakeq');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
  expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/quiz$/);
});

test('Back from a training result still goes to Games', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await openWithProbe('/play/fake');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  expect(await screen.findByText('120')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/games$/);
});

test('leaving a quiz game opened with no history goes to the Quiz tab', async () => {
  await updateSettings({ seenInstructions: ['fakeq'] });
  await openWithProbe('/play/fakeq');
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir del juego' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
  expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/quiz$/);
  expect(await db.results.count()).toBe(0);
});

async function openWithHistory(entries: string[], index: number) {
  await initI18n('es');
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <AppRoutes />
    </MemoryRouter>,
  );
  registerFakeGameTranslations();
}

async function finishFakeGame() {
  await userEvent.click(await screen.findByRole('button', { name: 'Comenzar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Terminar' }));
  await screen.findByText('Puntaje: 120');
}

test('«Volver» on the free-play result returns to the catalog with its filter', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await openWithHistory(['/games?area=memory', '/play/fake'], 1);
  await finishFakeGame();
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Memoria' })).toHaveAttribute('aria-pressed', 'true');
});

test('«Volver» on the free-play result of a deep link goes to the catalog', async () => {
  await updateSettings({ seenInstructions: ['fake'] });
  await openWithHistory(['/play/fake'], 0);
  await finishFakeGame();
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument();
});

test('«Volver» on a quiz result opened from the Quiz tab goes back to it', async () => {
  await updateSettings({ seenInstructions: ['quiz.instructions'] });
  await openWithHistory(['/quiz', '/play/fakeq'], 1);
  await finishFakeGame();
  await userEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Preguntas' })).toBeInTheDocument();
});
