const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; 'error-callback': (code?: string) => void },
  ): string;
  remove(widgetId: string): void;
}

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

// In-flight script load per document, shared by concurrent getters. Dropped once settled: on success
// `window.turnstile` takes over, on failure a later call can retry.
const scriptLoads = new WeakMap<Document, Promise<TurnstileApi>>();

function loadTurnstile(doc: Document): Promise<TurnstileApi> {
  const win = doc.defaultView as TurnstileWindow | null;
  if (!win) return Promise.reject(new Error('Turnstile needs a window'));
  if (win.turnstile) return Promise.resolve(win.turnstile);
  const pending = scriptLoads.get(doc);
  if (pending) return pending;

  const load = new Promise<TurnstileApi>((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
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
  scriptLoads.set(doc, load);
  const forget = () => scriptLoads.delete(doc);
  load.then(forget, forget);
  return load;
}

/**
 * Returns a function that solves one invisible Turnstile challenge per call and resolves with its token.
 * Without a site key it resolves `undefined` and never touches the network or the DOM.
 */
export function createCaptchaTokenGetter(siteKey: string | null, doc: Document = document): () => Promise<string | undefined> {
  return async () => {
    if (!siteKey) return undefined;
    const turnstile = await loadTurnstile(doc);
    const container = doc.createElement('div');
    container.hidden = true;
    doc.body.appendChild(container);
    let widgetId: string | undefined;
    try {
      return await new Promise<string>((resolve, reject) => {
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          callback: resolve,
          'error-callback': (code) => reject(new Error(`Turnstile challenge failed${code ? ` (${code})` : ''}`)),
        });
      });
    } finally {
      // Runs after the promise settles, so the id is known even when Turnstile calls back synchronously.
      if (widgetId !== undefined) turnstile.remove(widgetId);
      container.remove();
    }
  };
}
