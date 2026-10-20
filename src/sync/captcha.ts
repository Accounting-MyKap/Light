import { RemoteError } from './remote';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** One deadline per call, covering the script load and the challenge together. */
export const CAPTCHA_TIMEOUT_MS = 25_000;

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback': (code?: string) => void;
      'timeout-callback': () => void;
      'unsupported-callback': () => void;
      'expired-callback': () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

interface ScriptLoad {
  promise: Promise<TurnstileApi>;
  /** Gives up on a load that is still in flight: removes the script so the next call injects a fresh one. */
  abandon(): void;
}

// In-flight script load per document, shared by concurrent getters. Dropped once settled: on success
// `window.turnstile` takes over, on failure or abandonment a later call starts over.
const scriptLoads = new WeakMap<Document, ScriptLoad>();

function loadTurnstile(doc: Document): ScriptLoad {
  const win = doc.defaultView as TurnstileWindow | null;
  if (!win) return { promise: Promise.reject(new Error('Turnstile needs a window')), abandon() {} };
  if (win.turnstile) return { promise: Promise.resolve(win.turnstile), abandon() {} };
  const pending = scriptLoads.get(doc);
  if (pending) return pending;

  const script = doc.createElement('script');
  script.src = SCRIPT_SRC;
  script.async = true;
  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    const fail = (error: Error) => {
      script.remove();
      reject(error);
    };
    script.addEventListener('load', () => {
      if (win.turnstile) resolve(win.turnstile);
      else fail(new Error('Turnstile script loaded without exposing window.turnstile'));
    });
    script.addEventListener('error', () => fail(new Error('Could not load the Turnstile script')));
    doc.head.appendChild(script);
  });
  const forget = () => {
    if (scriptLoads.get(doc) === load) scriptLoads.delete(doc);
  };
  const load: ScriptLoad = {
    promise,
    abandon() {
      if (scriptLoads.get(doc) !== load) return;
      forget();
      script.remove();
    },
  };
  scriptLoads.set(doc, load);
  promise.then(forget, forget);
  return load;
}

/**
 * Returns a function that solves one invisible Turnstile challenge per call and resolves with its token.
 * Without a site key it resolves `undefined` and never touches the network or the DOM.
 * It never waits forever: a script that does not load, a challenge that cannot complete in a hidden container,
 * and Turnstile's own timeout / unsupported / expired / error signals all reject with a retryable
 * `RemoteError('network')`, and the widget, its container and the timer are always cleaned up.
 */
export function createCaptchaTokenGetter(siteKey: string | null, doc: Document = document): () => Promise<string | undefined> {
  return () => {
    if (!siteKey) return Promise.resolve(undefined);
    return new Promise<string>((resolve, reject) => {
      const load = loadTurnstile(doc);
      let turnstile: TurnstileApi | undefined;
      let container: HTMLElement | undefined;
      let widgetId: string | undefined;
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        if (turnstile && widgetId !== undefined) turnstile.remove(widgetId);
        container?.remove();
      };
      const succeed = (token: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(token);
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        load.abandon();
        reject(new RemoteError('network', message));
      };
      const timer = setTimeout(() => fail('Captcha timed out'), CAPTCHA_TIMEOUT_MS);

      load.promise.then(
        (api) => {
          if (settled) return;
          turnstile = api;
          container = doc.createElement('div');
          container.hidden = true;
          doc.body.appendChild(container);
          try {
            widgetId = api.render(container, {
              sitekey: siteKey,
              callback: succeed,
              'error-callback': (code) => fail(`Turnstile challenge failed${code ? ` (${code})` : ''}`),
              'timeout-callback': () => fail('Turnstile challenge timed out'),
              'unsupported-callback': () => fail('Turnstile is not supported in this browser'),
              'expired-callback': () => fail('Turnstile token expired before it was used'),
            });
          } catch (error) {
            fail(error instanceof Error ? error.message : 'Turnstile could not render');
            return;
          }
          // Turnstile may have called back before `render` returned the id: remove the widget now that it is known.
          if (settled) cleanup();
        },
        (error: Error) => fail(error.message),
      );
    });
  };
}
