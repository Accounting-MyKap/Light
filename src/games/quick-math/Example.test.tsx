import { act, render, screen } from '@testing-library/react';
import { DEMO_STEP_MS, QuickMathExample } from './Example';

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

beforeEach(() => {
  vi.useFakeTimers();
  setReducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  setReducedMotion(null);
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const slot = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-confirmed]');

test('the answer is typed into the slot, flashes once it is right, and starts over', () => {
  const { container } = render(<QuickMathExample />);
  expect(screen.getByText('7 + 5')).toBeInTheDocument();
  expect(slot(container)).toHaveTextContent('?');
  expect(slot(container)).toHaveAttribute('data-confirmed', 'false');

  advance(DEMO_STEP_MS);
  expect(slot(container)).toHaveTextContent(/^1$/);
  advance(DEMO_STEP_MS);
  expect(slot(container)).toHaveTextContent(/^12$/);
  expect(slot(container)).toHaveAttribute('data-confirmed', 'false');

  advance(DEMO_STEP_MS);
  expect(slot(container)).toHaveTextContent(/^12$/);
  expect(slot(container)).toHaveAttribute('data-confirmed', 'true');

  advance(DEMO_STEP_MS);
  expect(slot(container)).toHaveTextContent('?');
  expect(slot(container)).toHaveAttribute('data-confirmed', 'false');
});

test('with reduced motion the finished answer stays still', () => {
  setReducedMotion(true);
  const { container } = render(<QuickMathExample />);
  expect(slot(container)).toHaveTextContent(/^12$/);
  advance(DEMO_STEP_MS * 8);
  expect(slot(container)).toHaveTextContent(/^12$/);
  expect(slot(container)).toHaveAttribute('data-confirmed', 'false');
  expect(vi.getTimerCount()).toBe(0);
});

test('when the browser cannot tell about motion preferences nothing moves either', () => {
  setReducedMotion(null);
  const { container } = render(<QuickMathExample />);
  advance(DEMO_STEP_MS * 3);
  expect(slot(container)).toHaveTextContent(/^12$/);
  expect(slot(container)).toHaveAttribute('data-confirmed', 'false');
});

test('the loop stops when the example goes away', () => {
  const { unmount } = render(<QuickMathExample />);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
