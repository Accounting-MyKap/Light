import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// The PWA registration module only exists in real builds; tests never register a service worker.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(() => ({
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: vi.fn(() => Promise.resolve()),
  })),
}));

// jsdom does not scroll: its window.scrollTo only reports «Not implemented». The play screen scrolls to the top when a
// result opens, so every test that finishes a game would print that; a silent stand-in keeps the output clean (the
// tests that check the scroll spy on it).
window.scrollTo = () => {};

// React logs «Encountered two children with the same key» when two siblings share a key, and then loses or
// duplicates elements. That is a bug, not noise: it made the Arrows rows pile up. The message is collected while a
// test runs and fails that test afterwards (React catches anything thrown from console.error itself). Other
// console errors, such as act() warnings, go through untouched. console.error is wrapped, not spied on, so
// the tests that call vi.restoreAllMocks() cannot take the guard away.
const DUPLICATE_KEY = 'Encountered two children with the same key';
const originalConsoleError = console.error;
let duplicateKeys: string[] = [];

beforeEach(() => {
  duplicateKeys = [];
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(DUPLICATE_KEY)) {
      // React passes the key as a separate %s argument.
      duplicateKeys.push(args.slice(1).reduce<string>((text, arg) => text.replace('%s', String(arg)), args[0]));
      return;
    }
    originalConsoleError(...args);
  };
});

afterEach(() => {
  console.error = originalConsoleError;
  if (duplicateKeys.length > 0) {
    const found = duplicateKeys;
    duplicateKeys = [];
    throw new Error(`React found sibling elements with the same key:\n${found.join('\n')}`);
  }
});
