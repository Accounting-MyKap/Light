import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { INTRO_MS, SameDifferentGame } from './Game';
import { timeLimitMs } from './engine';
import { SymbolGlyph } from './symbols';

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
const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function renderGame({ paused = false, onFinish = vi.fn() } = {}) {
  return render(
    <FeedbackProvider>
      <SameDifferentGame startLevel={1} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
}

/**
 * Plays past the intro and returns a function that answers the current question right or wrong, working out
 * from the symbols on screen which key does it.
 */
function startAnswering() {
  let previous = shownSymbol();
  advance(INTRO_MS + 300);
  return (correct: boolean) => {
    const current = shownSymbol();
    const same = current === previous;
    fireEvent.keyDown(window, { key: same === correct ? 'ArrowRight' : 'ArrowLeft' });
    previous = current;
    advance(300);
  };
}

test('the first symbol is shown alone and answers are ignored', () => {
  renderGame();
  expect(screen.getByText('Recuerda este símbolo')).toBeInTheDocument();
  advance(500);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(hud('Puntos')).toBe('0');
});

test('ArrowLeft = No (different), ArrowRight = Yes (same)', () => {
  renderGame();
  const first = shownSymbol();
  advance(INTRO_MS + 300);
  expect(screen.getByText('¿Es igual al anterior?')).toBeInTheDocument();
  const current = shownSymbol();
  fireEvent.keyDown(window, { key: current === first ? 'ArrowRight' : 'ArrowLeft' });
  expect(hud('Puntos')).toBe('10');
  expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
});

test('the on-screen buttons are disabled during the intro and answer afterwards', () => {
  renderGame();
  expect(screen.getByRole('button', { name: 'Sí' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
  const first = shownSymbol();
  advance(INTRO_MS + 300);
  const current = shownSymbol();
  fireEvent.click(screen.getByRole('button', { name: current === first ? 'Sí' : 'No' }));
  expect(hud('Puntos')).toBe('10');
});

test('finishes once after 60 active seconds', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  advance(59_000);
  expect(onFinish).not.toHaveBeenCalled();
  advance(2_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000 });
});

test('every new trial re-mounts the symbol card so repeats are visible', () => {
  renderGame();
  advance(INTRO_MS + 300);
  const before = screen.getByTestId('symbol-card');
  expect(before).toHaveClass('appear');
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  expect(screen.getByTestId('symbol-card')).not.toBe(before);
});

test('auto-repeated keys are ignored', () => {
  renderGame();
  advance(INTRO_MS + 300);
  fireEvent.keyDown(window, { key: 'ArrowLeft', repeat: true });
  fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
  expect(hud('Puntos')).toBe('0');
});

test('the streak pill appears at ×2 and goes away after a mistake', () => {
  renderGame();
  const answer = startAnswering();
  for (let i = 0; i < 5; i++) answer(true);
  expect(screen.getByText('Racha ×2')).toBeInTheDocument();
  answer(false);
  expect(screen.queryByText(/Racha/)).toBeNull();
});

test('the streak pill goes from ×2 to ×3 at ten in a row', () => {
  renderGame();
  const answer = startAnswering();
  for (let i = 0; i < 5; i++) answer(true);
  const pill = screen.getByText('Racha ×2');
  for (let i = 0; i < 4; i++) answer(true);
  expect(screen.getByText('Racha ×2')).toBe(pill);
  answer(true);
  expect(screen.queryByText('Racha ×2')).toBeNull();
  expect(screen.getByText('Racha ×3')).toBeInTheDocument();
});

test('no streak pill below ×2', () => {
  renderGame();
  const answer = startAnswering();
  for (let i = 0; i < 4; i++) answer(true);
  expect(hud('Puntos')).toBe('40');
  expect(screen.queryByText(/Racha/)).toBeNull();
});

test('a missed question is a timeout, not a wrong answer, and ends the streak', () => {
  renderGame();
  const answer = startAnswering();
  for (let i = 0; i < 5; i++) answer(true);
  // The answer helper leaves 300 ms of the new question's window behind.
  const limitMs = timeLimitMs(Number(hud('Nivel')));
  advance(limitMs - 300 - 100);
  expect(screen.getByText('Racha ×2')).toBeInTheDocument();
  advance(200);
  expect(flashes()).toEqual(['timeout']);
  expect(screen.queryByText(/Racha/)).toBeNull();
});

test('running out of time on the first question flashes as a timeout and costs no points', () => {
  renderGame();
  advance(INTRO_MS + timeLimitMs(1) - 100);
  expect(flashes()).toEqual([]);
  advance(200);
  expect(flashes()).toEqual(['timeout']);
  expect(hud('Puntos')).toBe('0');
});

test('a wrong answer flashes as wrong and a right one as correct', () => {
  renderGame();
  const answer = startAnswering();
  answer(false);
  expect(flashes()).toEqual(['wrong']);
  answer(true);
  expect(flashes()).toEqual(['correct']);
});

test('symbols are drawn as outlines', () => {
  renderGame();
  const svg = screen.getByTestId('symbol');
  expect(svg).toHaveAttribute('fill', 'none');
  expect(svg).toHaveAttribute('stroke', 'currentColor');
});

test('the dot of the dot figures stays filled', () => {
  const { container, rerender } = render(<SymbolGlyph id="dot-center" label="punto" />);
  const dot = container.querySelector('circle');
  expect(dot).toHaveAttribute('fill', 'currentColor');
  expect(dot).toHaveAttribute('stroke', 'none');
  rerender(<SymbolGlyph id="dot-none" label="cuadro" />);
  expect(container.querySelector('circle')).toBeNull();
});
