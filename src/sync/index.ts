// The single entry point the UI uses for sync: screens import from here, never from the modules behind it.
import { createCaptchaTokenGetter } from './captcha';
import { syncConfig } from './config';
import { createSupabaseRemote, type RemoteStore } from './remote';
import { createSyncScheduler, type SyncScheduler } from './scheduler';
import { syncNow, type SyncReport } from './syncEngine';

export { fetchPercentile } from './percentile';
export type { RemoteStore } from './remote';
export type { SyncReport } from './syncEngine';

let remote: RemoteStore | null = null;
let captchaTokenGetter: (() => Promise<string | undefined>) | null = null;
let scheduler: SyncScheduler | null = null;
// The engine has no guard against overlapping runs. A scheduler guarantees that for its own runs, but a restarted
// service (a StrictMode remount, say) gets a new scheduler while the old one's run may still be in flight.
let lastRun: Promise<unknown> = Promise.resolve();

function runAfterLast(store: RemoteStore, getCaptchaToken: () => Promise<string | undefined>): Promise<SyncReport> {
  const run = lastRun.then(() => syncNow(store, getCaptchaToken));
  lastRun = run.catch(() => {});
  return run;
}

/** The Supabase remote, created on first use and then shared. `null` when sync is not configured. */
export function getRemote(): RemoteStore | null {
  if (!syncConfig) return null;
  remote ??= createSupabaseRemote(syncConfig);
  return remote;
}

function getScheduler(): SyncScheduler | null {
  const store = getRemote();
  if (!store || !syncConfig) return null;
  captchaTokenGetter ??= createCaptchaTokenGetter(syncConfig.turnstileSiteKey);
  const getCaptchaToken = captchaTokenGetter;
  scheduler ??= createSyncScheduler(() => runAfterLast(store, getCaptchaToken));
  return scheduler;
}

/** Asks for a sync. Resolves with its report, or `null` when sync is disabled or the run failed; never rejects. */
export async function requestSync(): Promise<SyncReport | null> {
  try {
    return (await getScheduler()?.request()) ?? null;
  } catch (error) {
    console.warn('Sync failed', error);
    return null;
  }
}

/**
 * Starts syncing for the life of the app: once now and again whenever the device comes back online or the tab becomes
 * visible. Returns the function that stops it. Does nothing when sync is not configured.
 */
export function startSyncService(): () => void {
  if (!syncConfig) return () => {};
  const request = () => void requestSync();
  const onVisibility = () => {
    if (!document.hidden) request();
  };
  window.addEventListener('online', request);
  document.addEventListener('visibilitychange', onVisibility);
  request();
  return () => {
    window.removeEventListener('online', request);
    document.removeEventListener('visibilitychange', onVisibility);
    // The next use starts from a fresh scheduler, so a React StrictMode remount never inherits a stopped one.
    scheduler?.dispose();
    scheduler = null;
  };
}
