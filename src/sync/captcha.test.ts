import { createCaptchaTokenGetter } from './captcha';

type TurnstileWindow = { turnstile?: unknown };
const win = window as unknown as TurnstileWindow;

afterEach(() => {
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
