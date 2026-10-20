export interface SyncConfig {
  url: string;
  publishableKey: string;
  turnstileSiteKey: string | null;
}

/** Sync is opt-in: without a Supabase URL and publishable key the app stays fully local. */
export function readSyncConfig(env: Record<string, string | undefined>): SyncConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey, turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || null };
}

export const syncConfig: SyncConfig | null = readSyncConfig(import.meta.env);
