import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { ArrowsGame } from './Game';

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

test('arrow keys answer the center arrow', () => {
  render(<ArrowsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowLeft' : 'ArrowRight' });
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('on-screen buttons answer too', () => {
  render(<ArrowsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Izquierda' })).toBeInTheDocument();
  advance(300);
  fireEvent.click(screen.getByRole('button', { name: target() === 'left' ? 'Izquierda' : 'Derecha' }));
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('keys are ignored while paused', () => {
  render(<ArrowsGame startLevel={1} paused={true} onFinish={vi.fn()} />);
  advance(300);
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(hud('Puntos')).toBe('0');
});

test('finishes once after 60 seconds', () => {
  const onFinish = vi.fn();
  render(<ArrowsGame startLevel={1} paused={false} onFinish={onFinish} />);
  advance(59_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000 });
});

test('every new trial re-mounts the arrow row so repeats are visible', () => {
  render(<ArrowsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  const before = screen.getByTestId('arrows-row');
  expect(before).toHaveClass('appear');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByTestId('arrows-row')).not.toBe(before);
});

test('holding an arrow key does not answer trials (auto-repeat is ignored)', () => {
  render(<ArrowsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  fireEvent.keyDown(window, { key: target() === 'left' ? 'ArrowLeft' : 'ArrowRight', repeat: true });
  expect(hud('Puntos')).toBe('0');
});
