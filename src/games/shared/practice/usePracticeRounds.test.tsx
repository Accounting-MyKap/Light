import { act, render } from '@testing-library/react';
import { PRACTICE_NEXT_MS, usePracticeRounds } from './usePracticeRounds';
import { FeedbackProvider } from '../feedback';

vi.mock('../../../core/sound');
vi.mock('../../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/settings')>();
  return {
    ...actual,
    useSettings: () => ({
      ...actual.DEFAULT_SETTINGS,
      sound: false,
      haptics: false,
    }),
  };
});

type Api = ReturnType<typeof usePracticeRounds>;

function setup(total: number, onComplete: () => void) {
  const api: { current: Api } = { current: null as unknown as Api };
  function Probe() {
    api.current = usePracticeRounds(total, onComplete);
    return null;
  }
  const view = render(
    <FeedbackProvider>
      <Probe />
    </FeedbackProvider>,
  );
  return { api, ...view };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('a right answer advances to the next round after the pause', () => {
  const { api } = setup(3, vi.fn());
  expect(api.current).toMatchObject({ round: 0, status: 'asking' });
  act(() => api.current.answer(true));
  expect(api.current).toMatchObject({ round: 0, status: 'right' });
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
  expect(api.current).toMatchObject({ round: 1, status: 'asking' });
});

test('a wrong answer stays on the round until a right one', () => {
  const { api } = setup(3, vi.fn());
  act(() => api.current.answer(false));
  expect(api.current).toMatchObject({ round: 0, status: 'wrong' });
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS * 2));
  expect(api.current).toMatchObject({ round: 0, status: 'wrong' });
  act(() => api.current.answer(true));
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
  expect(api.current).toMatchObject({ round: 1, status: 'asking' });
});

test('a right answer in the last round completes once', () => {
  const onComplete = vi.fn();
  const { api } = setup(1, onComplete);
  act(() => api.current.answer(true));
  expect(onComplete).not.toHaveBeenCalled();
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
  expect(onComplete).toHaveBeenCalledTimes(1);
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS * 3));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('answers while the status is right are ignored', () => {
  const { api } = setup(3, vi.fn());
  act(() => {
    api.current.answer(true);
    api.current.answer(true);
  });
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS * 3));
  expect(api.current.round).toBe(1);
  act(() => api.current.answer(true));
  act(() => api.current.answer(false));
  expect(api.current.status).toBe('right');
});

test('two right answers in one batch on the last round complete exactly once', () => {
  const onComplete = vi.fn();
  const { api } = setup(1, onComplete);
  act(() => {
    api.current.answer(true);
    api.current.answer(true);
  });
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test('two right answers in one batch advance a single round', () => {
  const { api } = setup(4, vi.fn());
  act(() => {
    api.current.answer(true);
    api.current.answer(true);
  });
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS));
  expect(api.current.round).toBe(1);
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS * 3));
  expect(api.current.round).toBe(1);
});

test('unmounting during the pause does not complete nor warn', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const onComplete = vi.fn();
  const { api, unmount } = setup(1, onComplete);
  act(() => api.current.answer(true));
  unmount();
  act(() => void vi.advanceTimersByTime(PRACTICE_NEXT_MS * 2));
  expect(onComplete).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  error.mockRestore();
  warn.mockRestore();
});
