import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { playTone } from '../../core/sound';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { CORRECT_PAUSE_MS, WRONG_PAUSE_MS } from './engine';
import { BalanceGame } from './Game';

vi.mock('../../core/sound');

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  vi.mocked(playTone).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hud = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const challenge = () => screen.getByTestId('balance-challenge');
const answer = () => challenge().dataset.answer!;
const controls = () => within(document.querySelector<HTMLElement>('[data-zone="controls"]')!);
const choice = (value: string) => document.querySelector<HTMLButtonElement>(`[data-choice="${value}"]`)!;
const otherChoice = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-choice]')).find((b) => b.dataset.choice !== answer())!;

function renderGame({ startLevel = 1, paused = false, onFinish = vi.fn() } = {}) {
  const view = render(
    <FeedbackProvider>
      <BalanceGame startLevel={startLevel} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
  return {
    ...view,
    setPaused: (next: boolean) =>
      view.rerender(
        <FeedbackProvider>
          <BalanceGame startLevel={startLevel} paused={next} onFinish={onFinish} />
        </FeedbackProvider>,
      ),
  };
}

test('shows the clues, the question and one button per figure at level 1, with a 90 s time bar', () => {
  renderGame();
  expect(challenge()).toHaveAttribute('data-kind', 'heaviest');
  expect(screen.getAllByRole('img', { name: /pesa|frente a/ })).toHaveLength(2);
  expect(controls().getByText('¿Cuál pesa más?')).toBeInTheDocument();
  expect(document.querySelectorAll('[data-choice]')).toHaveLength(3);
  expect(screen.getByRole('progressbar', { name: 'Tiempo' })).toHaveAttribute('aria-valuemax', '90');
});

test('every balance has a name screen readers can read: what is on each pan and which way it tips', () => {
  renderGame();
  for (const img of screen.getAllByRole('img', { name: /frente a/ })) {
    expect(img.getAttribute('aria-label')).toMatch(/^1 \S+ \S+ frente a 1 \S+ \S+: baja la (izquierda|derecha)$/);
  }
});

test('the right figure scores, plays the hit tone and lights its button', () => {
  renderGame();
  advance(1000);
  const right = answer();
  fireEvent.click(choice(right));
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
  expect(playTone).toHaveBeenCalledWith('correct');
  expect(choice(right)).toHaveAttribute('data-state', 'right');
});

test('a wrong figure costs points, and the right one is shown until the pause ends', () => {
  renderGame();
  advance(1000);
  const right = answer();
  const wrong = otherChoice().dataset.choice!;
  fireEvent.click(choice(wrong));
  expect(playTone).toHaveBeenCalledWith('wrong');
  expect(choice(wrong)).toHaveAttribute('data-state', 'wrong');
  expect(choice(right)).toHaveAttribute('data-state', 'answer');
  advance(WRONG_PAUSE_MS - 50);
  expect(choice(right)).toHaveAttribute('data-state', 'answer');
  advance(100);
  expect(document.querySelector('[data-state]')).toBeNull();
});

test('a second tap during the pause is ignored', () => {
  renderGame();
  advance(1000);
  fireEvent.click(choice(answer()));
  const score = hud('Puntos');
  fireEvent.click(otherChoice());
  expect(hud('Puntos')).toBe(score);
  advance(CORRECT_PAUSE_MS + 10);
  expect(document.querySelector('[data-state]')).toBeNull();
});

test('keys 1 to 5 pick the figure of that button', () => {
  renderGame();
  advance(1000);
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-choice]'));
  const index = buttons.findIndex((b) => b.dataset.choice === answer());
  fireEvent.keyDown(window, { key: String(index + 1) });
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
});

test('«which way will it tip?» has three buttons, the arrow keys and = answer, and the balance tips with a clonk', () => {
  renderGame({ startLevel: 6 });
  expect(challenge()).toHaveAttribute('data-kind', 'tilt');
  expect(controls().getByText('¿Hacia dónde se inclina?')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Izquierda/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Igual/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Derecha/ })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /: \?$/ })).toBeInTheDocument();
  advance(1000);
  const key = { left: 'ArrowLeft', level: '=', right: 'ArrowRight' }[answer() as 'left' | 'level' | 'right'];
  fireEvent.keyDown(window, { key });
  expect(Number(hud('Puntos'))).toBeGreaterThan(10);
  expect(playTone).toHaveBeenCalledWith('tilt');
  expect(screen.queryByRole('img', { name: /: \?$/ })).toBeNull();
  const question = document.querySelector('[data-question="true"]');
  expect(question).toHaveAttribute('data-outcome', answer());
  expect(question?.getAttribute('aria-label')).toMatch(/(baja la (izquierda|derecha)|quedan iguales)$/);
});

test('the down arrow picks «level», like the = key', () => {
  renderGame({ startLevel: 6 });
  advance(1000);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(choice('level')).toHaveAttribute('data-state', answer() === 'level' ? 'right' : 'wrong');
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

test('the answer pause freezes while the game is paused', () => {
  const view = renderGame();
  advance(1000);
  fireEvent.click(otherChoice());
  view.setPaused(true);
  advance(5_000);
  expect(document.querySelector('[data-state="wrong"]')).not.toBeNull();
  view.setPaused(false);
  advance(WRONG_PAUSE_MS + 50);
  expect(document.querySelector('[data-state]')).toBeNull();
});

test('keys and taps are ignored while paused', () => {
  renderGame({ paused: true });
  advance(1000);
  fireEvent.click(choice(answer()));
  fireEvent.keyDown(window, { key: '1' });
  expect(hud('Puntos')).toBe('0');
});
