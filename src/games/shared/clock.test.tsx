import { act, renderHook } from '@testing-library/react';
import { useCountdown, useGameClock, useTrialTimeout } from './clock';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('game clock excludes paused time', () => {
  const { result, rerender } = renderHook(({ p }) => useGameClock(p), { initialProps: { p: false } });
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.now()).toBe(1000);
  rerender({ p: true });
  act(() => vi.advanceTimersByTime(5000));
  rerender({ p: false });
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.now()).toBe(1500);
});

test('countdown calls onDone once after active duration, never while paused', () => {
  const onDone = vi.fn();
  const { result, rerender } = renderHook(
    ({ p }) => {
      const clock = useGameClock(p);
      return useCountdown(clock, 3000, p, onDone);
    },
    { initialProps: { p: true } },
  );
  act(() => vi.advanceTimersByTime(10_000));
  expect(onDone).not.toHaveBeenCalled();
  expect(result.current).toBe(3000);
  rerender({ p: false });
  act(() => vi.advanceTimersByTime(2900));
  expect(onDone).not.toHaveBeenCalled();
  expect(result.current).toBeLessThanOrEqual(100);
  act(() => vi.advanceTimersByTime(5000));
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(result.current).toBe(0);
});

test('trial timeout resumes with remaining time after a pause', () => {
  const onTimeout = vi.fn();
  const { rerender } = renderHook(
    ({ p }) => {
      const clock = useGameClock(p);
      useTrialTimeout(clock, 0, 1000, p, onTimeout);
    },
    { initialProps: { p: false } },
  );
  act(() => vi.advanceTimersByTime(600));
  rerender({ p: true });
  act(() => vi.advanceTimersByTime(5000));
  expect(onTimeout).not.toHaveBeenCalled();
  rerender({ p: false });
  act(() => vi.advanceTimersByTime(399));
  expect(onTimeout).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onTimeout).toHaveBeenCalledTimes(1);
});

test('trial timeout restarts when trialStartedAt changes', () => {
  const onTimeout = vi.fn();
  const { rerender } = renderHook(
    ({ start }) => {
      const clock = useGameClock(false);
      useTrialTimeout(clock, start, 1000, false, onTimeout);
    },
    { initialProps: { start: 0 } },
  );
  act(() => vi.advanceTimersByTime(900));
  rerender({ start: 900 });
  act(() => vi.advanceTimersByTime(100));
  expect(onTimeout).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(900));
  expect(onTimeout).toHaveBeenCalledTimes(1);
});

test('trial timeout disabled when window is null', () => {
  const onTimeout = vi.fn();
  renderHook(() => {
    const clock = useGameClock(false);
    useTrialTimeout(clock, 0, null, false, onTimeout);
  });
  act(() => vi.advanceTimersByTime(100_000));
  expect(onTimeout).not.toHaveBeenCalled();
});
