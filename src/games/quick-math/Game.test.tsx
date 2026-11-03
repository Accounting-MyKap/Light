import { act, fireEvent, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
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
const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function renderGame({ paused = false, onFinish = vi.fn() } = {}) {
  return render(
    <FeedbackProvider>
      <QuickMathGame startLevel={1} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
}

/** Types the right answer on the on-screen keypad and presses OK. */
function answerOnKeypad() {
  for (const d of String(currentAnswer())) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
}

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

test('skipping is a timeout, not a wrong answer', () => {
  renderGame();
  fireEvent.click(screen.getByRole('button', { name: 'Saltar' }));
  expect(flashes()).toEqual(['timeout']);
  expect(hud('Puntos')).toBe('0');
});

test('skipping costs no points', () => {
  renderGame();
  answerOnKeypad();
  expect(hud('Puntos')).toBe('11');
  fireEvent.click(screen.getByRole('button', { name: 'Saltar' }));
  expect(hud('Puntos')).toBe('11');
});

test('a wrong answer flashes as wrong and a right one as correct', () => {
  renderGame();
  fireEvent.keyDown(window, { key: String((currentAnswer() + 1) % 10) });
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(flashes()).toEqual(['wrong']);
  answerOnKeypad();
  expect(flashes()).toEqual(['correct']);
});

test('a new problem replaces the old one with an entering animation hook', () => {
  renderGame();
  const operation = () => screen.getByTestId('problem').closest<HTMLElement>('[data-enter]');
  const before = operation();
  expect(before).toHaveAttribute('data-enter', 'true');
  const liveRegion = before?.closest('[aria-live]');
  expect(liveRegion).not.toBeNull();

  answerOnKeypad();

  const after = operation();
  expect(after).not.toBe(before);
  expect(after).toHaveAttribute('data-enter', 'true');
  // The announcement region stays where it is, so a screen reader hears the new problem.
  expect(after?.closest('[aria-live]')).toBe(liveRegion);
});

test('typing a digit does not replace the operation', () => {
  renderGame();
  const before = screen.getByTestId('problem').closest('[data-enter]');
  expect(before).not.toBeNull();
  fireEvent.keyDown(window, { key: '4' });
  expect(screen.getByTestId('problem').closest('[data-enter]')).toBe(before);
});

test('the operation is the game zone; keypad and skip are the controls, below it', () => {
  const { container } = renderGame();
  const stage = container.querySelector('[data-zone="stage"]');
  const controls = container.querySelector('[data-zone="controls"]');
  const problem = screen.getByTestId('problem');
  expect(stage).toContainElement(problem);
  expect(stage).toContainElement(screen.getByTestId('answer'));
  expect(controls).not.toContainElement(problem);
  for (const name of ['0', '5', '9', 'Borrar', 'OK', 'Saltar']) {
    expect(controls).toContainElement(screen.getByRole('button', { name }));
  }
  expect(problem.compareDocumentPosition(screen.getByRole('button', { name: 'OK' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('pointer presses on the keys do not take keyboard focus away', () => {
  renderGame();
  for (const name of ['5', 'Borrar', 'OK', 'Saltar']) {
    const notPrevented = fireEvent.mouseDown(screen.getByRole('button', { name }));
    expect(notPrevented).toBe(false);
  }
});

test('finishes once after 60 seconds', () => {
  const onFinish = vi.fn();
  render(<QuickMathGame startLevel={1} paused={false} onFinish={onFinish} />);
  advance(61_000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ durationMs: 60_000, accuracy: 0 });
});

test('Enter on a focused button is left to the button, even while paused', () => {
  render(<QuickMathGame startLevel={1} paused={true} onFinish={vi.fn()} />);
  const notPrevented = fireEvent.keyDown(screen.getByRole('button', { name: 'OK' }), { key: 'Enter' });
  expect(notPrevented).toBe(true);
});

test('Enter on a focused button does not submit the typed answer', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  fireEvent.keyDown(window, { key: '7' });
  const notPrevented = fireEvent.keyDown(screen.getByRole('button', { name: 'Saltar' }), { key: 'Enter' });
  expect(notPrevented).toBe(true);
  expect(screen.getByTestId('answer').textContent).toBe('7');
});

test('auto-repeated keys are ignored', () => {
  render(<QuickMathGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  fireEvent.keyDown(window, { key: '7' });
  fireEvent.keyDown(window, { key: '7', repeat: true });
  expect(screen.getByTestId('answer').textContent).toBe('7');
});
