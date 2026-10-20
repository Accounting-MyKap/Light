import type { SyncConfig } from './config';
import type { RemoteStore } from './remote';
import type { SyncReport } from './syncEngine';

const ok: SyncReport = { status: 'ok', uploaded: 1, rejected: 0, pending: 0 };
const offline: SyncReport = { status: 'offline', uploaded: 0, rejected: 0, pending: 1 };
const config: SyncConfig = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test', turnstileSiteKey: 'site-key' };

const remote = { tag: 'remote' } as unknown as RemoteStore;
const captchaGetter = async () => 'token';
const syncNow = vi.fn<(remote: RemoteStore, getCaptchaToken: () => Promise<string | undefined>) => Promise<SyncReport>>();
const createSupabaseRemote = vi.fn(() => remote);
const createCaptchaTokenGetter = vi.fn(() => captchaGetter);

/** A fresh copy of the module, because it keeps its scheduler and remote at module level. */
async function load(syncConfig: SyncConfig | null) {
  vi.resetModules();
  vi.doMock('./config', () => ({ syncConfig }));
  vi.doMock('./syncEngine', () => ({ syncNow }));
  vi.doMock('./remote', () => ({ createSupabaseRemote }));
  vi.doMock('./captcha', () => ({ createCaptchaTokenGetter }));
  return import('./index');
}

const stops: Array<() => void> = [];
/** Services started by a test are stopped after it: their listeners live on the shared window and document. */
function start(sync: Awaited<ReturnType<typeof load>>): () => void {
  const stop = sync.startSyncService();
  stops.push(stop);
  return stop;
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  syncNow.mockReset().mockResolvedValue(ok);
  createSupabaseRemote.mockClear();
  createCaptchaTokenGetter.mockClear();
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('sync disabled (no configuration)', () => {
  test('there is no remote and nothing to request', async () => {
    const sync = await load(null);
    expect(sync.getRemote()).toBeNull();
    expect(await sync.requestSync()).toBeNull();
    expect(createSupabaseRemote).not.toHaveBeenCalled();
    expect(syncNow).not.toHaveBeenCalled();
  });

  test('the service is a no-op: no listeners, no network', async () => {
    const sync = await load(null);
    const onWindow = vi.spyOn(window, 'addEventListener');
    const onDocument = vi.spyOn(document, 'addEventListener');
    const stop = start(sync);
    expect(onWindow).not.toHaveBeenCalled();
    expect(onDocument).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('online'));
    setHidden(false);
    stop();
    expect(syncNow).not.toHaveBeenCalled();
    expect(createSupabaseRemote).not.toHaveBeenCalled();
  });
});

describe('sync enabled', () => {
  test('the remote and the captcha getter are created once and reused', async () => {
    const sync = await load(config);
    expect(createSupabaseRemote).not.toHaveBeenCalled();
    expect(sync.getRemote()).toBe(remote);
    expect(sync.getRemote()).toBe(remote);
    await sync.requestSync();
    await sync.requestSync();
    expect(createSupabaseRemote).toHaveBeenCalledExactlyOnceWith(config);
    expect(createCaptchaTokenGetter).toHaveBeenCalledExactlyOnceWith('site-key');
    expect(syncNow).toHaveBeenCalledTimes(2);
    expect(syncNow).toHaveBeenLastCalledWith(remote, captchaGetter);
  });

  test('requestSync resolves with the report of the run', async () => {
    const sync = await load(config);
    const report = { ...ok, uploaded: 3 };
    syncNow.mockResolvedValue(report);
    expect(await sync.requestSync()).toBe(report);
  });

  test('requestSync never rejects: a failing run is logged and resolves null', async () => {
    const sync = await load(config);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('IndexedDB is gone');
    syncNow.mockRejectedValue(failure);
    expect(await sync.requestSync()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toContain(failure);
  });

  test('requestSync survives a remote that cannot be created', async () => {
    const sync = await load(config);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createSupabaseRemote.mockImplementationOnce(() => {
      throw new Error('bad url');
    });
    expect(await sync.requestSync()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('the service asks for a sync at start and when the network or the tab comes back', async () => {
    const sync = await load(config);
    start(sync);
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
    expect(syncNow).toHaveBeenLastCalledWith(remote, captchaGetter);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));

    setHidden(true);
    await Promise.resolve();
    expect(syncNow).toHaveBeenCalledTimes(2);
    setHidden(false);
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(3));
  });

  test('the cleanup removes the listeners and stops the retries', async () => {
    vi.useFakeTimers();
    const sync = await load(config);
    syncNow.mockResolvedValue(offline);
    const stop = start(sync);
    await vi.advanceTimersByTimeAsync(0);
    expect(syncNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(syncNow).toHaveBeenCalledTimes(2);

    stop();
    window.dispatchEvent(new Event('online'));
    setHidden(false);
    await vi.advanceTimersByTimeAsync(2_000_000);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  test('after the cleanup a request gets a fresh scheduler and reuses the remote', async () => {
    vi.useFakeTimers();
    const sync = await load(config);
    // The first scheduler is backing off when it is disposed, so it must not carry that wait over.
    syncNow.mockResolvedValueOnce(offline).mockResolvedValue(ok);
    const stop = start(sync);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(await sync.requestSync()).toBe(ok);
    expect(syncNow).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000_000);
    expect(syncNow).toHaveBeenCalledTimes(2);
    expect(createSupabaseRemote).toHaveBeenCalledTimes(1);
  });

  test('a restarted service waits for the run still in flight instead of overlapping it', async () => {
    const sync = await load(config);
    let finish!: (report: SyncReport) => void;
    syncNow.mockImplementationOnce(() => new Promise<SyncReport>((resolve) => (finish = resolve)));
    const stop = start(sync);
    await vi.waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
    stop();
    const restarted = sync.requestSync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(syncNow).toHaveBeenCalledTimes(1);
    finish(offline);
    expect(await restarted).toBe(ok);
    expect(syncNow).toHaveBeenCalledTimes(2);
  });

  test('a run that fails does not block the next one', async () => {
    const sync = await load(config);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    syncNow.mockRejectedValueOnce(new Error('first run failed'));
    expect(await sync.requestSync()).toBeNull();
    expect(await sync.requestSync()).toBe(ok);
  });

  test('stopping the service twice is harmless', async () => {
    const sync = await load(config);
    const stop = start(sync);
    stop();
    expect(stop).not.toThrow();
  });
});
