import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { playTone } from '../../core/sound';
import { clearAllData } from '../../data/db';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../../data/settings';
import { FeedbackProvider, useCue, useFeedback, useFeedbackSignal, type FeedbackKind } from './feedback';

vi.mock('../../core/sound');
// The real hook, unless a test pins the settings (see the re-render test below).
vi.mock('../../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/settings')>();
  return { ...actual, useSettings: vi.fn(actual.useSettings) };
});

const vibrate = vi.fn();

beforeEach(async () => {
  vi.mocked(playTone).mockClear();
  vibrate.mockClear();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  await clearAllData();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate');
  vi.mocked(useSettings).mockReset();
});

/** The hook under test next to the settings it reads, so a test can wait until the stored settings have loaded. */
function renderFeedback(wrapper?: ({ children }: { children: ReactNode }) => ReactNode) {
  return renderHook(() => ({ feedback: useFeedback(), settings: useSettings() }), { wrapper });
}

test('correct plays the correct tone and a short vibration', () => {
  const { result } = renderFeedback();
  act(() => result.current.feedback('correct'));
  expect(playTone).toHaveBeenCalledExactlyOnceWith('correct');
  expect(vibrate).toHaveBeenCalledExactlyOnceWith(12);
});

test('wrong and timeout play the wrong tone and a double vibration', () => {
  const { result } = renderFeedback();
  act(() => result.current.feedback('wrong'));
  act(() => result.current.feedback('timeout'));
  expect(vi.mocked(playTone).mock.calls).toEqual([['wrong'], ['wrong']]);
  expect(vibrate.mock.calls).toEqual([[[30, 50, 30]], [[30, 50, 30]]]);
});

test('sound and vibration follow their own switches', async () => {
  await updateSettings({ sound: false });
  const withoutSound = renderFeedback();
  await vi.waitFor(() => expect(withoutSound.result.current.settings.sound).toBe(false));
  act(() => withoutSound.result.current.feedback('correct'));
  expect(playTone).not.toHaveBeenCalled();
  expect(vibrate).toHaveBeenCalledExactlyOnceWith(12);
  withoutSound.unmount();

  vi.mocked(playTone).mockClear();
  vibrate.mockClear();
  await updateSettings({ sound: true, vibration: false });
  const withoutVibration = renderFeedback();
  await vi.waitFor(() => expect(withoutVibration.result.current.settings.vibration).toBe(false));
  act(() => withoutVibration.result.current.feedback('correct'));
  expect(playTone).toHaveBeenCalledExactlyOnceWith('correct');
  expect(vibrate).not.toHaveBeenCalled();
});

test('no navigator.vibrate is not an error', () => {
  Reflect.deleteProperty(navigator, 'vibrate');
  const { result } = renderFeedback();
  expect(() => act(() => result.current.feedback('wrong'))).not.toThrow();
  expect(playTone).toHaveBeenCalledExactlyOnceWith('wrong');
});

function Probe() {
  const signal = useFeedbackSignal();
  return <p data-testid="signal">{signal ? `${signal.kind}#${signal.id}` : 'none'}</p>;
}

test('each call publishes a new signal to the provider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FeedbackProvider>
      <Probe />
      {children}
    </FeedbackProvider>
  );
  const { result } = renderFeedback(wrapper);
  expect(screen.getByTestId('signal')).toHaveTextContent('none');

  act(() => result.current.feedback('correct'));
  const first = screen.getByTestId('signal').textContent;
  act(() => result.current.feedback('correct'));
  const second = screen.getByTestId('signal').textContent;
  expect(first).toMatch(/^correct#\d+$/);
  expect(second).toMatch(/^correct#\d+$/);
  expect(second).not.toBe(first);

  act(() => result.current.feedback('timeout'));
  expect(screen.getByTestId('signal')).toHaveTextContent(/^timeout#\d+$/);
});

test('the signal ids keep growing, also when two calls land in the same batch', () => {
  const seen: Array<{ kind: FeedbackKind; id: number }> = [];
  function Recorder() {
    const signal = useFeedbackSignal();
    if (signal) seen.push(signal);
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FeedbackProvider>
      <Recorder />
      {children}
    </FeedbackProvider>
  );
  const { result } = renderFeedback(wrapper);
  act(() => {
    result.current.feedback('wrong');
    result.current.feedback('correct');
  });
  act(() => result.current.feedback('wrong'));
  const ids = seen.map((signal) => signal.id);
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
  expect(new Set(ids).size).toBe(ids.length);
  expect(seen.at(-1)?.kind).toBe('wrong');
});

test('components that only call useFeedback do not re-render when a signal is published', async () => {
  // Pinned settings: every `useSettings()` call is its own live query and resolves on its own schedule, so a
  // late one would count as a re-render here. Only the context split is under test, not the settings load.
  vi.mocked(useSettings).mockReturnValue(DEFAULT_SETTINGS);
  let renders = 0;
  function Caller() {
    const feedback = useFeedback();
    useEffect(() => {
      renders += 1;
    });
    return <button onClick={() => feedback('correct')}>go</button>;
  }
  render(
    <FeedbackProvider>
      <Caller />
      <Probe />
    </FeedbackProvider>,
  );
  expect(renders).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'go' }));
  await userEvent.click(screen.getByRole('button', { name: 'go' }));
  // The signal reached the provider's consumers (the probe re-rendered), the emitter did not.
  expect(screen.getByTestId('signal')).toHaveTextContent('correct#2');
  expect(renders).toBe(1);
});

test('without a provider the sound still plays and nothing breaks', () => {
  const { result } = renderHook(() => useFeedback());
  expect(() => act(() => result.current('wrong'))).not.toThrow();
  expect(playTone).toHaveBeenCalledExactlyOnceWith('wrong');
  expect(vibrate).toHaveBeenCalledExactlyOnceWith([30, 50, 30]);
});

test('an answer can bring its own tone instead of the usual one, and keeps its vibration and signal', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FeedbackProvider>
      <Probe />
      {children}
    </FeedbackProvider>
  );
  const { result } = renderFeedback(wrapper);
  act(() => result.current.feedback('correct', 'chime'));
  expect(playTone).toHaveBeenCalledExactlyOnceWith('chime');
  expect(vibrate).toHaveBeenCalledExactlyOnceWith(12);
  expect(screen.getByTestId('signal')).toHaveTextContent(/^correct#\d+$/);
});

test('a cue plays its tone and its vibration, and publishes no signal', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <FeedbackProvider>
      <Probe />
      {children}
    </FeedbackProvider>
  );
  const { result } = renderHook(() => useCue(), { wrapper });
  act(() => result.current('clack', 8));
  act(() => result.current('whistle'));
  expect(vi.mocked(playTone).mock.calls).toEqual([['clack'], ['whistle']]);
  expect(vibrate).toHaveBeenCalledExactlyOnceWith(8);
  expect(screen.getByTestId('signal')).toHaveTextContent('none');
});

test('a cue follows the sound and vibration settings', () => {
  vi.mocked(useSettings).mockReturnValue({ ...DEFAULT_SETTINGS, sound: false, vibration: false });
  const { result } = renderHook(() => useCue());
  act(() => result.current('clack', 8));
  expect(playTone).not.toHaveBeenCalled();
  expect(vibrate).not.toHaveBeenCalled();
});

test('without a provider there is no signal', () => {
  const { result } = renderHook(() => useFeedbackSignal());
  expect(result.current).toBeNull();
});
