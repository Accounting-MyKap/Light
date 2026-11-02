import { act, render, screen } from '@testing-library/react';
import { initI18n } from '../../i18n';
import { DEMO_STEP_MS, SequenceLightsExample } from './Example';

function setReducedMotion(reduce: boolean | null) {
  if (reduce === null) {
    Reflect.deleteProperty(window, 'matchMedia');
  } else {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({ matches: reduce })),
      configurable: true,
    });
  }
}

beforeEach(async () => {
  await initI18n('es');
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  setReducedMotion(null);
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
/** The numbers (cell 1 is the first cell of the board) of the cells that are lit right now. */
const lit = () =>
  screen
    .getAllByRole('button', { name: /^Casilla \d+$/ })
    .flatMap((cell, i) => (cell.dataset.lit === 'true' ? [i + 1] : []));

test('three cells light up one after another, rest, and start over', () => {
  render(<SequenceLightsExample />);
  expect(lit()).toEqual([1]);
  advance(DEMO_STEP_MS);
  expect(lit()).toEqual([5]);
  advance(DEMO_STEP_MS);
  expect(lit()).toEqual([9]);
  advance(DEMO_STEP_MS);
  expect(lit()).toEqual([]);
  advance(DEMO_STEP_MS);
  expect(lit()).toEqual([1]);
});

test('the three cells carry the numbers 1, 2 and 3 that say the order', () => {
  render(<SequenceLightsExample />);
  expect(screen.getByRole('button', { name: 'Casilla 1' })).toHaveTextContent('1');
  expect(screen.getByRole('button', { name: 'Casilla 5' })).toHaveTextContent('2');
  expect(screen.getByRole('button', { name: 'Casilla 9' })).toHaveTextContent('3');
});

test('with reduced motion the whole path stays lit and nothing changes', () => {
  setReducedMotion(true);
  render(<SequenceLightsExample />);
  expect(lit()).toEqual([1, 5, 9]);
  advance(DEMO_STEP_MS * 5);
  expect(lit()).toEqual([1, 5, 9]);
});

test('when the browser cannot tell about motion preferences nothing moves either', () => {
  setReducedMotion(null);
  render(<SequenceLightsExample />);
  advance(DEMO_STEP_MS * 5);
  expect(lit()).toEqual([1, 5, 9]);
});

test('the loop stops when the example goes away', () => {
  const { unmount } = render(<SequenceLightsExample />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
