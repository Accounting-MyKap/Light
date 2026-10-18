import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { RuleSwitchGame } from './Game';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

function correctKey(): string {
  const rule = screen.getByTestId('rule-banner').dataset.rule as 'color' | 'shape';
  const stimulus = screen.getByTestId('stimulus');
  const left = screen.getByTestId('target-left');
  return left.dataset[rule] === stimulus.dataset[rule] ? 'ArrowLeft' : 'ArrowRight';
}

test('rule banner shows COLOR or FORMA', () => {
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  expect(['COLOR', 'FORMA']).toContain(screen.getByTestId('rule-banner').textContent?.trim());
});

test('cards are labeled and carry a pattern matching their color', () => {
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  const patterns = { blue: 'solid', orange: 'stripes', purple: 'dots' } as const;
  for (const id of ['stimulus', 'target-left', 'target-right']) {
    const card = screen.getByTestId(id);
    expect(card.getAttribute('aria-label')).toMatch(/^(círculo|cuadrado|triángulo) (azul|naranja|morado)$/);
    expect(card.dataset.pattern).toBe(patterns[card.dataset.color as keyof typeof patterns]);
  }
});

test('arrow keys pick the left or right card', () => {
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  fireEvent.keyDown(window, { key: correctKey() });
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('finishes once after 60 seconds', () => {
  const onFinish = vi.fn();
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={onFinish} />);
  advance(61_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000 });
});

test('every new trial re-mounts the stimulus so repeats are visible', () => {
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  const before = screen.getByTestId('stimulus');
  expect(before).toHaveClass('appear');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByTestId('stimulus')).not.toBe(before);
});

test('auto-repeated keys are ignored', () => {
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(300);
  fireEvent.keyDown(window, { key: correctKey(), repeat: true });
  expect(hud('Puntos')).toBe('0');
});
