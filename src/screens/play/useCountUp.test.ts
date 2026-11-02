import { act, renderHook } from '@testing-library/react';
import { useCountUp } from './useCountUp';

function setReducedMotion(reduce: boolean | null) {
  if (reduce === null) vi.stubGlobal('matchMedia', undefined);
  else vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce })));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('counts from 0 up to the target', () => {
  setReducedMotion(false);
  const { result } = renderHook(() => useCountUp(340));
  expect(result.current).toBe(0);

  act(() => {
    vi.advanceTimersByTime(600);
  });
  // Slowing down: more than half way at half the time, but not there yet.
  expect(result.current).toBeGreaterThan(170);
  expect(result.current).toBeLessThan(340);

  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(result.current).toBe(340);

  // It stays on the target once it has arrived.
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(result.current).toBe(340);
});

test('never goes backwards on the way up', () => {
  setReducedMotion(false);
  const { result } = renderHook(() => useCountUp(340));
  let last = result.current;
  for (let i = 0; i < 80; i++) {
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current).toBeGreaterThanOrEqual(last);
    last = result.current;
  }
});

test('the duration is the second argument', () => {
  setReducedMotion(false);
  const { result } = renderHook(() => useCountUp(100, 400));
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(result.current).toBe(100);
});

test('a new target counts up again from 0', () => {
  setReducedMotion(false);
  const { result, rerender } = renderHook(({ target }) => useCountUp(target), { initialProps: { target: 340 } });
  act(() => {
    vi.advanceTimersByTime(1200);
  });
  expect(result.current).toBe(340);

  rerender({ target: 90 });
  expect(result.current).toBe(0);
  act(() => {
    vi.advanceTimersByTime(1200);
  });
  expect(result.current).toBe(90);
});

test('stops asking for frames when it unmounts', () => {
  setReducedMotion(false);
  const { unmount } = renderHook(() => useCountUp(340));
  act(() => {
    vi.advanceTimersByTime(100);
  });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('reduced motion returns the target at once', () => {
  setReducedMotion(true);
  const { result } = renderHook(() => useCountUp(340));
  expect(result.current).toBe(340);
  expect(vi.getTimerCount()).toBe(0);
});

test('a browser that cannot tell about motion gets the target at once', () => {
  setReducedMotion(null);
  const { result } = renderHook(() => useCountUp(340));
  expect(result.current).toBe(340);
});
