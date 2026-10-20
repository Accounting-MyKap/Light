import { CAPTCHA_TIMEOUT_MS, createCaptchaTokenGetter } from './captcha';

type TurnstileWindow = { turnstile?: unknown };
const win = window as unknown as TurnstileWindow;

afterEach(() => {
  vi.useRealTimers();
  delete win.turnstile;
  document.querySelectorAll('script[src*="turnstile"]').forEach((s) => s.remove());
  document.body.replaceChildren();
});

test('captcha getter returns undefined without a site key and never loads a script', async () => {
  const get = createCaptchaTokenGetter(null, document);
  expect(await get()).toBeUndefined();
  expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
});

test('captcha getter renders a widget and resolves with its token', async () => {
  const render = vi.fn((_el: HTMLElement, opts: { callback: (t: string) => void }) => { opts.callback('tok-1'); return 'w1'; });
  const remove = vi.fn();
  win.turnstile = { render, remove };
  await expect(createCaptchaTokenGetter('site-key', document)()).resolves.toBe('tok-1');
  expect(render.mock.calls[0][1]).toMatchObject({ sitekey: 'site-key' });
  expect(remove).toHaveBeenCalledWith('w1');
  expect(document.body.children).toHaveLength(0);
});

test('captcha getter rejects when the widget reports an error, and still cleans up', async () => {
  const render = vi.fn((_el: HTMLElement, opts: { 'error-callback': (c?: string) => void }) => { opts['error-callback']('300030'); return 'w2'; });
  const remove = vi.fn();
  win.turnstile = { render, remove };
  await expect(createCaptchaTokenGetter('site-key', document)()).rejects.toThrow(/300030/);
  expect(remove).toHaveBeenCalledWith('w2');
  expect(document.body.children).toHaveLength(0);
});

test('captcha getter loads the Turnstile script once and waits for it', async () => {
  const getA = createCaptchaTokenGetter('site-key', document);
  const getB = createCaptchaTokenGetter('site-key', document);
  const pending = Promise.all([getA(), getB()]);

  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="turnstile"]');
  expect(scripts).toHaveLength(1);
  expect(scripts[0].src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  expect(scripts[0].async).toBe(true);

  win.turnstile = {
    render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => { opts.callback('tok-2'); return 'w3'; },
    remove: vi.fn(),
  };
  scripts[0].dispatchEvent(new Event('load'));
  await expect(pending).resolves.toEqual(['tok-2', 'tok-2']);
  expect(document.querySelectorAll('script[src*="turnstile"]')).toHaveLength(1);
});

test('captcha getter rejects when the script fails to load and allows a retry', async () => {
  const get = createCaptchaTokenGetter('site-key', document);
  const first = get();
  document.querySelector('script[src*="turnstile"]')!.dispatchEvent(new Event('error'));
  await expect(first).rejects.toThrow(/Turnstile/);
  expect(document.querySelector('script[src*="turnstile"]')).toBeNull();

  const second = get();
  expect(document.querySelectorAll('script[src*="turnstile"]')).toHaveLength(1);
  win.turnstile = {
    render: (_el: HTMLElement, opts: { callback: (t: string) => void }) => { opts.callback('tok-3'); return 'w4'; },
    remove: vi.fn(),
  };
  document.querySelector('script[src*="turnstile"]')!.dispatchEvent(new Event('load'));
  await expect(second).resolves.toBe('tok-3');
});

describe('bounded wait', () => {
  type WidgetOptions = { sitekey: string } & Record<
    'callback' | 'error-callback' | 'timeout-callback' | 'unsupported-callback' | 'expired-callback',
    (arg?: string) => void
  >;

  /** Installs a fake Turnstile that records each widget and never calls back by itself. */
  function installTurnstile() {
    const widgets: WidgetOptions[] = [];
    const render = vi.fn((_el: HTMLElement, opts: WidgetOptions) => { widgets.push(opts); return `w${widgets.length}`; });
    const remove = vi.fn();
    win.turnstile = { render, remove };
    return { widgets, render, remove };
  }

  /** Records how a promise settled, so fake-timer tests can look at it before and after a deadline. */
  function track(promise: Promise<unknown>) {
    const outcome: { state: 'pending' | 'resolved' | 'rejected'; error?: unknown } = { state: 'pending' };
    promise.then(
      () => { outcome.state = 'resolved'; },
      (error: unknown) => { outcome.state = 'rejected'; outcome.error = error; },
    );
    return outcome;
  }

  const scriptTag = () => document.querySelector<HTMLScriptElement>('script[src*="turnstile"]');

  test('the deadline is 25 seconds', () => {
    expect(CAPTCHA_TIMEOUT_MS).toBe(25_000);
  });

  test('a script that never loads rejects with a retryable error at the deadline and is removed', async () => {
    vi.useFakeTimers();
    const outcome = track(createCaptchaTokenGetter('site-key', document)());
    expect(scriptTag()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(CAPTCHA_TIMEOUT_MS - 1);
    expect(outcome.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);

    expect(outcome.state).toBe('rejected');
    expect(outcome.error).toMatchObject({ name: 'RemoteError', kind: 'network' });
    expect(scriptTag()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a call after a timed-out script load injects the script again', async () => {
    vi.useFakeTimers();
    const get = createCaptchaTokenGetter('site-key', document);
    const first = track(get());
    const firstScript = scriptTag();
    await vi.advanceTimersByTimeAsync(CAPTCHA_TIMEOUT_MS);
    expect(first.state).toBe('rejected');

    const second = get();
    const secondScript = scriptTag();
    expect(secondScript).not.toBeNull();
    expect(secondScript).not.toBe(firstScript);
    expect(document.querySelectorAll('script[src*="turnstile"]')).toHaveLength(1);

    const { widgets } = installTurnstile();
    secondScript!.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(0);
    widgets[0].callback('tok-late');
    await expect(second).resolves.toBe('tok-late');
  });

  test('a script that loads after its call timed out renders nothing', async () => {
    vi.useFakeTimers();
    const outcome = track(createCaptchaTokenGetter('site-key', document)());
    const script = scriptTag()!;
    await vi.advanceTimersByTimeAsync(CAPTCHA_TIMEOUT_MS);
    expect(outcome.state).toBe('rejected');

    const { render } = installTurnstile();
    script.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(0);
    expect(render).not.toHaveBeenCalled();
    expect(document.body.children).toHaveLength(0);
  });

  test('a challenge that never completes rejects at the deadline and cleans up', async () => {
    vi.useFakeTimers();
    const { render, remove } = installTurnstile();
    const outcome = track(createCaptchaTokenGetter('site-key', document)());
    await vi.advanceTimersByTimeAsync(0);
    expect(render).toHaveBeenCalledTimes(1);
    expect(document.body.children).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(CAPTCHA_TIMEOUT_MS - 1);
    expect(outcome.state).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);

    expect(outcome.state).toBe('rejected');
    expect(outcome.error).toMatchObject({ name: 'RemoteError', kind: 'network' });
    expect(remove).toHaveBeenCalledWith('w1');
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('one deadline covers script load and challenge together', async () => {
    vi.useFakeTimers();
    const outcome = track(createCaptchaTokenGetter('site-key', document)());
    await vi.advanceTimersByTimeAsync(CAPTCHA_TIMEOUT_MS - 1_000);
    const { render } = installTurnstile();
    scriptTag()!.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(0);
    expect(render).toHaveBeenCalledTimes(1);
    expect(outcome.state).toBe('pending');

    await vi.advanceTimersByTimeAsync(1_000);
    expect(outcome.state).toBe('rejected');
    expect(document.body.children).toHaveLength(0);
  });

  test.each(['timeout-callback', 'unsupported-callback', 'expired-callback'] as const)(
    'the widget reporting %s rejects with a retryable error and cleans up',
    async (callbackName) => {
      vi.useFakeTimers();
      const { widgets, remove } = installTurnstile();
      const outcome = track(createCaptchaTokenGetter('site-key', document)());
      await vi.advanceTimersByTimeAsync(0);

      widgets[0][callbackName]();
      await vi.advanceTimersByTimeAsync(0);

      expect(outcome.state).toBe('rejected');
      expect(outcome.error).toMatchObject({ name: 'RemoteError', kind: 'network' });
      expect(remove).toHaveBeenCalledWith('w1');
      expect(document.body.children).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test('a delivered token wins over a later expiry, and the timer is cleared', async () => {
    vi.useFakeTimers();
    const { widgets, remove } = installTurnstile();
    const get = createCaptchaTokenGetter('site-key', document);
    const promise = get();
    await vi.advanceTimersByTimeAsync(0);

    widgets[0].callback('tok-ok');
    widgets[0]['expired-callback']();
    await expect(promise).resolves.toBe('tok-ok');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a render that throws rejects and cleans up', async () => {
    vi.useFakeTimers();
    win.turnstile = { render: vi.fn(() => { throw new Error('bad sitekey'); }), remove: vi.fn() };
    const outcome = track(createCaptchaTokenGetter('site-key', document)());
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome.state).toBe('rejected');
    expect(outcome.error).toMatchObject({ kind: 'network', message: expect.stringContaining('bad sitekey') });
    expect(document.body.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
