export interface SyncConfig {
  url: string;
  publishableKey: string;
  turnstileSiteKey: string | null;
}

/** Sync is opt-in: without a Supabase URL and publishable key the app stays fully local. */
export function readSyncConfig(env: Record<string, string | undefined>): SyncConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey || !isHttpUrl(url)) return null;
  return { url, publishableKey, turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || null };
}

/** A mistyped URL turns sync off instead of making supabase-js throw at start-up. `http:` is for the local stack. */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export const syncConfig: SyncConfig | null = readSyncConfig(import.meta.env);
