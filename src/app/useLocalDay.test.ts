import { act, renderHook } from '@testing-library/react';
import { useLocalDay } from './useLocalDay';

afterEach(() => {
  vi.useRealTimers();
});

test('rolls over at local midnight', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 18, 23, 59, 30));
  const { result } = renderHook(() => useLocalDay());
  expect(result.current).toBe('2026-10-18');
  act(() => vi.advanceTimersByTime(31_000));
  expect(result.current).toBe('2026-10-19');
});

test('refreshes when the app becomes visible again', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 23, 58));
  const { result } = renderHook(() => useLocalDay());
  vi.setSystemTime(new Date(2026, 9, 19, 8, 0));
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe('2026-10-19');
});
