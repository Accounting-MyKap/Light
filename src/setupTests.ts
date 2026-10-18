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
