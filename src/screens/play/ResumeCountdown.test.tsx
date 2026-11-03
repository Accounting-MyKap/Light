import { act, render, screen } from '@testing-library/react';
import { ResumeCountdown } from './ResumeCountdown';
import { RESUME_STEP_MS } from './resumeTiming';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const step = () => act(() => vi.advanceTimersByTime(RESUME_STEP_MS));

test('shows 3, 2, 1, one step each, and calls onDone once the last step is over', () => {
  const onDone = vi.fn();
  render(<ResumeCountdown onDone={onDone} />);
  expect(screen.getByText('3')).toBeInTheDocument();
  step();
  expect(screen.getByText('2')).toBeInTheDocument();
  step();
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(onDone).not.toHaveBeenCalled();
  step();
  expect(onDone).toHaveBeenCalledTimes(1);
  step();
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('is decorative: hidden from screen readers', () => {
  const { container } = render(<ResumeCountdown onDone={() => {}} />);
  expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
});

test('a new onDone from the parent does not restart the count', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<ResumeCountdown onDone={first} />);
  act(() => vi.advanceTimersByTime(RESUME_STEP_MS - 1));
  rerender(<ResumeCountdown onDone={second} />);
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByText('2')).toBeInTheDocument();
  step();
  step();
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

test('stops counting when it goes away', () => {
  const onDone = vi.fn();
  const { unmount } = render(<ResumeCountdown onDone={onDone} />);
  unmount();
  act(() => vi.advanceTimersByTime(RESUME_STEP_MS * 5));
  expect(onDone).not.toHaveBeenCalled();
});
