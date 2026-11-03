import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { SwitchyardGame } from './Game';
import { switchyardGame } from './index';
import { i18n } from '../../i18n';

vi.mock('../../core/sound');

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
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

/** Points every switch along the route to the station of the first train. */
function routeFirstTrain() {
  const train = firstTrain()!;
  const station = document.querySelector<SVGElement>(`[data-station-id="${train.dataset.station}"]`)!;
  for (const step of station.dataset.route!.split(' ').filter(Boolean)) {
    const [sw, option] = step.split(':');
    if (switchButton(Number(sw)).dataset.option !== option) fireEvent.click(switchButton(Number(sw)));
  }
}

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

test('finishes once after 90 seconds', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(89_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 90_000 });
});

test('each level says which map it brings', () => {
  const t = i18n.t.bind(i18n);
  expect(switchyardGame.describeLevel?.(1, t)).toBe('3 estaciones');
  expect(switchyardGame.describeLevel?.(3, t)).toBe('4 estaciones · túnel lateral');
  expect(switchyardGame.describeLevel?.(5, t)).toBe('5 estaciones · estación central');
});
