import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { ArrowsGame } from './Game';
import { arrowWindowMs } from './engine';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const target = () => screen.getByTestId('arrows-row').dataset.direction as 'left' | 'right';
const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function renderGame({ paused = false, onFinish = vi.fn() } = {}) {
  return render(
    <FeedbackProvider>
      <ArrowsGame startLevel={1} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
}

test('arrow keys answer the center arrow', () => {
  renderGame();
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowLeft' : 'ArrowRight' });
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('on-screen buttons answer too', () => {
  renderGame();
  expect(screen.getByRole('button', { name: 'Izquierda' })).toBeInTheDocument();
  advance(300);
  fireEvent.click(screen.getByRole('button', { name: target() === 'left' ? 'Izquierda' : 'Derecha' }));
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('keys are ignored while paused', () => {
  renderGame({ paused: true });
  advance(300);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(hud('Puntos')).toBe('0');
});

test('finishes once after 60 seconds', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(59_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000 });
});

test('every new trial re-mounts the arrow row so repeats are visible', () => {
  renderGame();
  advance(300);
  const before = screen.getByTestId('arrows-row');
  expect(before).toHaveClass('appear');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByTestId('arrows-row')).not.toBe(before);
});

test('holding an arrow key does not answer trials (auto-repeat is ignored)', () => {
  renderGame();
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowLeft' : 'ArrowRight', repeat: true });
  expect(hud('Puntos')).toBe('0');
});

test('a missed arrow is a timeout, not a wrong answer', () => {
  renderGame();
  advance(arrowWindowMs(1) - 100);
  expect(flashes()).toEqual([]);
  advance(200);
  expect(flashes()).toEqual(['timeout']);
  expect(hud('Puntos')).toBe('0');
});

test('a wrong answer flashes as wrong and a right one as correct', () => {
  renderGame();
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowRight' : 'ArrowLeft' });
  expect(flashes()).toEqual(['wrong']);
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowLeft' : 'ArrowRight' });
  expect(flashes()).toEqual(['correct']);
});

test('the center arrow is marked as the target', () => {
  renderGame();
  const row = screen.getByTestId('arrows-row');
  const targets = row.querySelectorAll('[data-target="true"]');
  expect(row.children).toHaveLength(5);
  expect(targets).toHaveLength(1);
  expect(targets[0]).toBe(row.children[2]);
});
