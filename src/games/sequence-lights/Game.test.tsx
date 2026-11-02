import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { FeedbackProvider } from '../shared/feedback';
import { GAP_MS, SHOW_MS } from './engine';
import { SequenceLightsGame } from './Game';

const STEP = SHOW_MS + GAP_MS;
/** The pause between rounds. The brief keeps it as it was; the test fixes it so nobody lengthens it by accident. */
const FEEDBACK_MS = 600;

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const cells = () => screen.getAllByRole('button', { name: /^Casilla \d+$/ });
const litIndex = () => cells().findIndex((c) => c.dataset.lit === 'true');
const litCells = () => cells().flatMap((c, i) => (c.dataset.lit === 'true' ? [i] : []));
const distinct = (seq: number[]) => [...new Set(seq)].sort((a, b) => a - b);
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const flashes = () => Array.from(document.querySelectorAll<HTMLElement>('[data-flash]')).map((el) => el.dataset.flash);

/** The game inside the feedback provider, as the play screen mounts it, so the frame can draw the reactions. */
function renderGame({ startLevel = 1, paused = false, onFinish = vi.fn() } = {}) {
  return render(
    <FeedbackProvider>
      <SequenceLightsGame startLevel={startLevel} paused={paused} onFinish={onFinish} />
    </FeedbackProvider>,
  );
}

/** Watches the whole show phase (span 3 at level 1) and returns the cell order. */
function watchSequence(span: number, clickDuringShow = false): number[] {
  const seen: number[] = [];
  for (let i = 0; i < span; i++) {
    advance(i === 0 ? 1 : STEP);
    seen.push(litIndex());
    if (clickDuringShow && i === 0) fireEvent.click(cells()[(seen[0] + 1) % 9]);
  }
  advance(STEP);
  return seen;
}

/** Plays the round that was just watched, tapping every cell in order. */
const repeat = (seq: number[]) => {
  for (const i of seq) fireEvent.click(cells()[i]);
};

test('clicks during the show phase are ignored', () => {
  renderGame();
  expect(screen.getByText('Observa…')).toBeInTheDocument();
  const seq = watchSequence(3, true);
  expect(seq.every((i) => i >= 0)).toBe(true);
  expect(screen.getByText('Tu turno')).toBeInTheDocument();
  repeat(seq);
  expect(screen.getByText('¡Perfecto!')).toBeInTheDocument();
});

test('rounds show as dots', () => {
  renderGame();
  const dots = screen.getByRole('list', { name: 'Ronda 1 de 8' });
  expect(within(dots).getAllByRole('listitem')).toHaveLength(8);
  // The frame draws them; the old text line is gone.
  expect(screen.queryByText('Ronda 1 de 8')).not.toBeInTheDocument();
});

test('the dots move on to the next round once a round is over', () => {
  renderGame();
  const seq = watchSequence(3);
  repeat(seq);
  expect(screen.getByRole('list', { name: 'Ronda 2 de 8' })).toBeInTheDocument();
});

test('the status text sits in the game zone and the board in the controls zone', () => {
  const { container } = renderGame();
  const stage = container.querySelector<HTMLElement>('[data-zone="stage"]')!;
  const controls = container.querySelector<HTMLElement>('[data-zone="controls"]')!;
  expect(within(stage).getByText('Observa…')).toBeInTheDocument();
  expect(within(controls).getAllByRole('button')).toHaveLength(9);
  expect(within(stage).queryAllByRole('button')).toHaveLength(0);
});

test('a correct round lights the whole path together', () => {
  renderGame();
  const seq = watchSequence(3);
  repeat(seq);
  expect(litCells()).toEqual(distinct(seq));
  // It lasts the pause between rounds that already existed, and no longer.
  advance(FEEDBACK_MS - 1);
  expect(litCells()).toEqual(distinct(seq));
  advance(1);
  expect(screen.getByText('Observa…')).toBeInTheDocument();
  expect(litCells()).toEqual([]);
});

test('the whole path is lit on the board it was played on, even when the next round needs a bigger one', () => {
  // Level 3 is the last one with a 3 x 3 board (a span of 5); the next round is 4 x 4.
  renderGame({ startLevel: 3 });
  const seq = watchSequence(5);
  expect(cells()).toHaveLength(9);
  repeat(seq);
  expect(cells()).toHaveLength(9);
  expect(litCells()).toEqual(distinct(seq));
  advance(FEEDBACK_MS);
  expect(cells()).toHaveLength(16);
  expect(litCells()).toEqual([]);
});

test('the round message says ¡Perfecto!', () => {
  renderGame();
  const seq = watchSequence(3);
  repeat(seq);
  const message = screen.getByText('¡Perfecto!');
  expect(message).toHaveAttribute('aria-live', 'polite');
  expect(message).toHaveAttribute('data-tone', 'ok');
  expect(screen.queryByText('¡Bien!')).not.toBeInTheDocument();
});

test('a wrong round lights nothing and says the soft message', () => {
  renderGame();
  const seq = watchSequence(3);
  fireEvent.click(cells()[(seq[0] + 1) % 9]);
  expect(screen.getByText('Casi… sigamos')).not.toHaveAttribute('data-tone');
  expect(litCells()).toEqual([]);
});

test('each round answer reaches the frame as a green flash or a red pulse', () => {
  renderGame();
  const seq = watchSequence(3);
  repeat(seq);
  expect(flashes()).toEqual(['correct']);
  advance(FEEDBACK_MS);
  const next = watchSequence(4);
  fireEvent.click(cells()[(next[0] + 1) % 9]);
  expect(flashes()).toEqual(['wrong']);
});

test('eight failed rounds finish the game once with accuracy 0', () => {
  const onFinish = vi.fn();
  renderGame({ onFinish });
  for (let round = 0; round < 8; round++) {
    advance(1000); // let the previous feedback hand over to the next show phase
    advance(20_000);
    fireEvent.click(cells()[0]);
    fireEvent.click(cells()[0]);
  }
  advance(1000);
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0]).toMatchObject({ accuracy: 0, score: 0, levelReached: 1 });
});

test('cells work with the keyboard', async () => {
  renderGame();
  const seq = watchSequence(3);
  vi.useRealTimers(); // the input phase has no timers; user-event needs real ones
  const user = userEvent.setup();
  for (const i of seq) {
    cells()[i].focus();
    await user.keyboard('{Enter}');
  }
  expect(screen.getByText('¡Perfecto!')).toBeInTheDocument();
});

test('pausing during the show restarts it from the beginning', () => {
  const { rerender } = renderGame();
  const again = (paused: boolean) =>
    rerender(
      <FeedbackProvider>
        <SequenceLightsGame startLevel={1} paused={paused} onFinish={vi.fn()} />
      </FeedbackProvider>,
    );
  advance(1);
  const first = litIndex();
  advance(STEP);
  again(true);
  advance(10_000);
  expect(screen.getByText('Observa…')).toBeInTheDocument();
  again(false);
  advance(1);
  expect(litIndex()).toBe(first);
});
