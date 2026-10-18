import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { INTRO_MS, SameDifferentGame } from './Game';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const shownSymbol = () => screen.getByTestId('symbol').dataset.symbol;

test('the first symbol is shown alone and answers are ignored', () => {
  render(<SameDifferentGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  expect(screen.getByText('Recuerda este símbolo')).toBeInTheDocument();
  advance(500);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(hud('Puntos')).toBe('0');
});

test('ArrowLeft = No (different), ArrowRight = Yes (same)', () => {
  render(<SameDifferentGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  const first = shownSymbol();
  advance(INTRO_MS + 300);
  expect(screen.getByText('¿Es igual al anterior?')).toBeInTheDocument();
  const current = shownSymbol();
  fireEvent.keyDown(window, { key: current === first ? 'ArrowRight' : 'ArrowLeft' });
  expect(hud('Puntos')).toBe('10');
  expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
});

test('finishes once after 60 active seconds', () => {
  const onFinish = vi.fn();
  render(<SameDifferentGame startLevel={1} paused={false} onFinish={onFinish} />);
  advance(59_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000 });
});
