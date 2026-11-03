import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { RuleSwitchGame } from './Game';
import { ruleWindowMs } from './engine';

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function renderGame({ paused = false, onFinish = vi.fn() } = {}) {
  return render(
    <FeedbackProvider>
      <RuleSwitchGame startLevel={1} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
}

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

test('cards never pile up across rule switches', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<RuleSwitchGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  let switches = 0;
  for (let i = 0; i < 40; i++) {
    advance(300);
    const before = screen.getByTestId('rule-banner').dataset.rule;
    fireEvent.keyDown(window, { key: correctKey() });
    if (screen.getAllByTestId('rule-banner')[0].dataset.rule !== before) switches++;
    expect(screen.getAllByTestId('stimulus')).toHaveLength(1);
    expect(screen.getAllByTestId('rule-banner')).toHaveLength(1);
  }
  expect(switches).toBeGreaterThan(2);
  expect(errors.mock.calls.flat().join(' ')).not.toMatch(/same key/);
});

test('the two options sit in the controls area, below the stimulus', () => {
  const { container } = renderGame();
  const controls = container.querySelector('[data-zone="controls"]');
  const stage = container.querySelector('[data-zone="stage"]');
  const stimulus = screen.getByTestId('stimulus');
  const left = screen.getByTestId('target-left');
  const right = screen.getByTestId('target-right');
  expect(controls).toContainElement(left);
  expect(controls).toContainElement(right);
  expect(controls).not.toContainElement(stimulus);
  // The rule and the stimulus are the game zone, which comes before the controls.
  expect(stage).toContainElement(stimulus);
  expect(stage).toContainElement(screen.getByTestId('rule-banner'));
  expect(stimulus.compareDocumentPosition(left) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('a timeout is not a wrong answer', () => {
  renderGame();
  advance(ruleWindowMs(1) - 100);
  expect(flashes()).toEqual([]);
  advance(200);
  expect(flashes()).toEqual(['timeout']);
  expect(hud('Puntos')).toBe('0');
});

test('a wrong answer flashes as wrong and a right one as correct', () => {
  renderGame();
  advance(300);
  fireEvent.keyDown(window, { key: correctKey() === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft' });
  expect(flashes()).toEqual(['wrong']);
  advance(300);
  fireEvent.keyDown(window, { key: correctKey() });
  expect(flashes()).toEqual(['correct']);
});

test('the on-screen cards answer too', () => {
  renderGame();
  advance(300);
  const key = correctKey();
  fireEvent.click(screen.getByTestId(key === 'ArrowLeft' ? 'target-left' : 'target-right'));
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});
