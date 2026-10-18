import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { QuickMathGame } from './Game';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

function currentAnswer(): number {
  const text = screen.getByTestId('problem').textContent ?? '';
  const [a, op1, b, op2, c] = text.split(' ');
  const n = (s: string) => Number(s);
  if (op2 === '×') return n(a) + n(b) * n(c);
  if (op1 === '+') return n(a) + n(b);
  if (op1 === '−') return n(a) - n(b);
  if (op1 === '×') return n(a) * n(b);
  return n(a) / n(b);
}

test('on-screen keypad has digits, delete, OK and skip', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  for (const name of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Borrar', 'OK', 'Saltar']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
});

test('keypad answers a problem', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  for (const d of String(currentAnswer())) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  expect(hud('Puntos')).toBe('11');
});

test('physical keyboard: digits, Backspace and Enter', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  fireEvent.keyDown(window, { key: '9' });
  expect(screen.getByTestId('answer').textContent).toBe('9');
  fireEvent.keyDown(window, { key: 'Backspace' });
  expect(screen.getByTestId('answer').textContent).toBe('?');
  for (const d of String(currentAnswer())) fireEvent.keyDown(window, { key: d });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(hud('Puntos')).toBe('11');
});

test('skip moves on and counts as a miss', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Saltar' }));
  expect(hud('Puntos')).toBe('0');
});

test('finishes once after 60 seconds', () => {
  const onFinish = vi.fn();
  render(<QuickMathGame startLevel={1} paused={false} onFinish={onFinish} />);
  advance(61_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000, accuracy: 0 });
});
