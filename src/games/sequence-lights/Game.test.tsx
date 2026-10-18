import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initI18n } from '../../i18n';
import { GAP_MS, SHOW_MS } from './engine';
import { SequenceLightsGame } from './Game';

const STEP = SHOW_MS + GAP_MS;

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const cells = () => screen.getAllByRole('button', { name: /^Casilla \d+$/ });
const litIndex = () => cells().findIndex((c) => c.dataset.lit === 'true');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

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

test('clicks during the show phase are ignored', () => {
  render(<SequenceLightsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  expect(screen.getByText('Observa…')).toBeInTheDocument();
  const seq = watchSequence(3, true);
  expect(seq.every((i) => i >= 0)).toBe(true);
  expect(screen.getByText('Tu turno')).toBeInTheDocument();
  for (const i of seq) fireEvent.click(cells()[i]);
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
});

test('eight failed rounds finish the game once with accuracy 0', () => {
  const onFinish = vi.fn();
  render(<SequenceLightsGame startLevel={1} paused={false} onFinish={onFinish} />);
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
  render(<SequenceLightsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  const seq = watchSequence(3);
  vi.useRealTimers(); // the input phase has no timers; user-event needs real ones
  const user = userEvent.setup();
  for (const i of seq) {
    cells()[i].focus();
    await user.keyboard('{Enter}');
  }
  expect(screen.getByText('¡Bien!')).toBeInTheDocument();
});

test('pausing during the show restarts it from the beginning', () => {
  const { rerender } = render(<SequenceLightsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(1);
  const first = litIndex();
  advance(STEP);
  rerender(<SequenceLightsGame startLevel={1} paused={true} onFinish={vi.fn()} />);
  advance(10_000);
  expect(screen.getByText('Observa…')).toBeInTheDocument();
  rerender(<SequenceLightsGame startLevel={1} paused={false} onFinish={vi.fn()} />);
  advance(1);
  expect(litIndex()).toBe(first);
});
