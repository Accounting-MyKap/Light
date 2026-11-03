import { act, fireEvent, render, screen } from '@testing-library/react';
import { playTone } from '../../core/sound';
import { VIBRATION } from '../../core/vibrate';
import { DEFAULT_SETTINGS, useSettings } from '../../data/settings';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { FASTER_SHOW_MS } from './FasterToast';
import { SwitchyardGame } from './Game';
import { switchyardGame } from './index';
import { i18n } from '../../i18n';

// Some tests play tens of seconds of trains frame by frame: room to spare on a loaded runner.
vi.setConfig({ testTimeout: 15_000 });

vi.mock('../../core/sound');
// Pinned, so a test can turn the sound or the vibration off at once (the stored ones load on their own schedule).
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: vi.fn(() => actual.DEFAULT_SETTINGS) };
});

const vibrate = vi.fn();

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  vi.mocked(playTone).mockClear();
  vibrate.mockClear();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});
afterEach(() => {
  // Before the real timers come back: a stub put over a fake timer would otherwise outlive it.
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
  vi.mocked(useSettings).mockReset();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const switchButtons = () => screen.getAllByRole('button', { name: /^Cambio \d/ });
const switchButton = (index: number) => document.querySelector<HTMLButtonElement>(`[data-switch="${index}"]`)!;
const firstTrain = () => document.querySelector<SVGElement>('[data-train]');
/** Where the first train's locomotive is drawn. */
const locoAt = () => firstTrain()!.querySelector('[data-car="loco"]')!.getAttribute('transform');

function renderGame({ paused = false, onFinish = vi.fn(), startLevel = 1 } = {}) {
  const view = render(
    <FeedbackProvider>
      <SwitchyardGame startLevel={startLevel} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
  return {
    ...view,
    setPaused: (next: boolean) =>
      view.rerender(
        <FeedbackProvider>
          <SwitchyardGame startLevel={startLevel} paused={next} onFinish={onFinish} />
        </FeedbackProvider>,
      ),
  };
}

/** Points every switch along the route to `station`. */
function routeTo(station: number | string) {
  const house = document.querySelector<SVGElement>(`[data-station-id="${station}"]`)!;
  for (const step of house.dataset.route!.split(' ').filter(Boolean)) {
    const [sw, option] = step.split(':');
    if (switchButton(Number(sw)).dataset.option !== option) fireEvent.click(switchButton(Number(sw)));
  }
}

/** Points every switch along the route to the station of the first train. */
function routeFirstTrain() {
  routeTo(firstTrain()!.dataset.station!);
}

/** Points the switches to a station other than the first train's. */
function misrouteFirstTrain() {
  routeTo(Number(firstTrain()!.dataset.station) === 0 ? 1 : 0);
}

/**
 * Routes each train to its station (or, with `wrong`, to another) as it comes out of the tunnel, until `done` holds.
 * On the 3-station maps of levels 1–3 a train is past its last switch (230 u, plus the grace) before the next one
 * comes out (more than 280 u behind), so setting the switches for the newest train never sends an older one astray.
 */
function playUntil(done: () => boolean, { wrong = false } = {}) {
  let routed = -1;
  for (let t = 0; t < 60_000 && !done(); t += 100) {
    const newest = [...document.querySelectorAll<SVGElement>('[data-train]')].at(-1);
    if (newest && Number(newest.dataset.train) > routed) {
      routed = Number(newest.dataset.train);
      const station = Number(newest.dataset.station);
      routeTo(wrong ? (station === 0 ? 1 : 0) : station);
    }
    advance(100);
  }
  expect(done()).toBe(true);
}

const faster = () => screen.queryByText(/^¡Más rápido!/);

/** The tones played so far, in order. */
const tones = () => vi.mocked(playTone).mock.calls.map(([kind]) => kind);

test('every switch is a button named after its number and where it points', () => {
  renderGame({ startLevel: 1 });
  expect(switchButtons()).toHaveLength(2);
  expect(switchButtons()[0]).toHaveAccessibleName(/^Cambio 1: (hacia|abajo)/);
  renderGame({ startLevel: 10 });
  expect(screen.getAllByRole('button', { name: /^Cambio 6:/ }).length).toBeGreaterThan(0);
});

test('a tap flips a switch and its name follows', () => {
  renderGame();
  const button = switchButton(0);
  const [option, name] = [button.dataset.option, button.getAttribute('aria-label')];
  fireEvent.click(button);
  expect(button.dataset.option).not.toBe(option);
  expect(button.getAttribute('aria-label')).not.toBe(name);
  fireEvent.click(button);
  expect(button.dataset.option).toBe(option);
});

test('number keys flip the switch with that number; numbers without a switch do nothing', () => {
  renderGame();
  const option = switchButton(1).dataset.option;
  fireEvent.keyDown(window, { key: '2' });
  expect(switchButton(1).dataset.option).not.toBe(option);
  const options = [0, 1].map((i) => switchButton(i).dataset.option);
  // fireEvent returns false when the handler prevented the browser default.
  expect(fireEvent.keyDown(window, { key: '9' })).toBe(true);
  expect([0, 1].map((i) => switchButton(i).dataset.option)).toEqual(options);
});

test('trains come out of the tunnel and move on', () => {
  renderGame();
  advance(900);
  expect(firstTrain()).toBeNull();
  advance(300);
  expect(firstTrain()).not.toBeNull();
  const at = locoAt();
  advance(500);
  expect(locoAt()).not.toBe(at);
});

test('nothing moves or flips while paused, and the game goes on from the same place', () => {
  const { setPaused } = renderGame();
  advance(1500);
  setPaused(true);
  const at = locoAt();
  const option = switchButton(0).dataset.option;
  advance(2000);
  fireEvent.click(switchButton(0));
  fireEvent.keyDown(window, { key: '1' });
  expect(locoAt()).toBe(at);
  expect(switchButton(0).dataset.option).toBe(option);
  expect(tones()).not.toContain('clack');
  setPaused(false);
  advance(50);
  expect(locoAt()).not.toBe(at);
});

test('a train sent to its station scores and shows a check mark there, without flashing the whole board', () => {
  renderGame();
  advance(1100);
  routeFirstTrain();
  for (let i = 0; i < 150 && hud('Puntos') === '0'; i++) advance(100);
  expect(hud('Puntos')).toBe('10');
  expect(document.querySelector('[data-arrival="correct"]')).not.toBeNull();
  expect(document.querySelector('[data-flash]')).toBeNull();
});

test('a soft whistle as each train comes out of the tunnel', () => {
  renderGame();
  advance(900);
  expect(tones()).toEqual([]);
  advance(300);
  expect(tones()).toEqual(['whistle']);
  // The next train, one interval later at level 1; the first one is still on its way.
  advance(4000);
  expect(tones()).toEqual(['whistle', 'whistle']);
});

test('a switch clacks and ticks when it flips, by tap or by key; a key without a switch is silent', () => {
  renderGame();
  fireEvent.click(switchButton(0));
  fireEvent.keyDown(window, { key: '2' });
  fireEvent.keyDown(window, { key: '9' });
  expect(tones()).toEqual(['clack', 'clack']);
  expect(vibrate.mock.calls).toEqual([[VIBRATION.tick], [VIBRATION.tick]]);
});

test('a train home rings the chime instead of the usual hit tone', () => {
  renderGame();
  advance(1100);
  routeFirstTrain();
  for (let i = 0; i < 150 && hud('Puntos') === '0'; i++) advance(100);
  expect(hud('Puntos')).toBe('10');
  expect(tones()).toContain('chime');
  expect(tones()).not.toContain('correct');
  expect(vibrate).toHaveBeenCalledWith(VIBRATION.correct);
});

test('a train at the wrong station keeps the miss tone', () => {
  renderGame();
  advance(1100);
  misrouteFirstTrain();
  for (let i = 0; i < 150 && !document.querySelector('[data-arrival]'); i++) advance(100);
  expect(document.querySelector('[data-arrival="wrong"]')).not.toBeNull();
  expect(tones()).toContain('wrong');
  expect(tones()).not.toContain('chime');
});

test('with the sound off nothing sounds; with the vibration off nothing vibrates', () => {
  vi.mocked(useSettings).mockReturnValue({ ...DEFAULT_SETTINGS, sound: false });
  const quiet = renderGame();
  advance(1100);
  fireEvent.click(switchButton(0));
  routeFirstTrain();
  for (let i = 0; i < 150 && hud('Puntos') === '0'; i++) advance(100);
  expect(hud('Puntos')).toBe('10');
  expect(playTone).not.toHaveBeenCalled();
  expect(vibrate).toHaveBeenCalledWith(VIBRATION.tick);
  quiet.unmount();

  vibrate.mockClear();
  vi.mocked(useSettings).mockReturnValue({ ...DEFAULT_SETTINGS, vibration: false });
  renderGame();
  fireEvent.click(switchButton(0));
  expect(tones()).toEqual(['clack']);
  expect(vibrate).not.toHaveBeenCalled();
});

test('when the level goes up, «¡Más rápido! · Nivel N» shows over the board for a moment, politely', () => {
  renderGame({ startLevel: 1 });
  expect(faster()).toBeNull();
  playUntil(() => hud('Nivel') === '2');
  expect(faster()).toHaveTextContent('¡Más rápido! · Nivel 2');
  expect(faster()!.closest('[role="status"]')).not.toBeNull();
  advance(FASTER_SHOW_MS);
  expect(faster()).toBeNull();
});

test('no «¡Más rápido!» at the start, nor when the level goes down', () => {
  renderGame({ startLevel: 2 });
  expect(faster()).toBeNull();
  playUntil(() => hud('Nivel') === '1', { wrong: true });
  expect(faster()).toBeNull();
});

test('on a slow phone the board turns lite after about 2 s of slow frames, and stays so', () => {
  // A frame every 40 ms (25 a second).
  vi.stubGlobal('requestAnimationFrame', (draw: FrameRequestCallback) => setTimeout(() => draw(Date.now()), 40));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  renderGame();
  const board = screen.getByRole('group', { name: 'Mapa de vías' });
  advance(1500);
  expect(board).not.toHaveAttribute('data-lite');
  advance(1500);
  expect(board).toHaveAttribute('data-lite');
  advance(3000);
  expect(board).toHaveAttribute('data-lite');
});

test('with smooth frames the board never turns lite', () => {
  renderGame();
  advance(6000);
  expect(screen.getByRole('group', { name: 'Mapa de vías' })).not.toHaveAttribute('data-lite');
});

test('finishes once after 90 seconds', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(89_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 90_000 });
});

test('trains that arrive after the last frame drawn, before the 90 s end, count in the result', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(1100);
  routeFirstTrain();
  // The browser stops drawing (a phone saving power, a stalled page): after the frame already asked for, the yard is
  // not moved again before the end.
  vi.stubGlobal('requestAnimationFrame', () => 0);
  advance(100);
  expect(hud('Puntos')).toBe('0');
  expect(document.querySelector('[data-arrival]')).toBeNull();

  advance(90_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  // The first train got home, and at least one more reached a station, in the 89 s nobody saw.
  const result = onFinish.mock.calls[0][0];
  expect(result.score).toBeGreaterThanOrEqual(10);
  expect(result.accuracy).toBeGreaterThan(0);
  expect(result.accuracy).toBeLessThanOrEqual(1);
  expect(result.durationMs).toBe(90_000);
});

test('each level says which map it brings', () => {
  const t = i18n.t.bind(i18n);
  expect(switchyardGame.describeLevel?.(1, t)).toBe('3 estaciones');
  expect(switchyardGame.describeLevel?.(3, t)).toBe('4 estaciones · túnel lateral');
  expect(switchyardGame.describeLevel?.(5, t)).toBe('5 estaciones · estación central');
});
