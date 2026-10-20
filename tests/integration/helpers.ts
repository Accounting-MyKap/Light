import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRemote, type RemoteStore } from '../../src/sync/remote';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: the integration tests must run through vitest.integration.config.ts`);
  return value;
}

/** Each guest keeps its session in its own memory, so several guests can coexist in one test process. */
export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

/** The app's remote store, pointed at the local stack. */
export function newGuestRemote(storage: Storage = memoryStorage()): RemoteStore {
  return createSupabaseRemote(
    { url: requireEnv('LIGHT_SB_URL'), publishableKey: requireEnv('LIGHT_SB_PUBLISHABLE_KEY'), turnstileSiteKey: null },
    { storage },
  );
}

/** A plain supabase-js client acting as the guest whose session lives in `storage` (to read what the guest can see). */
export function guestClient(storage: Storage): SupabaseClient {
  // Same storage key as the app's remote store. supabase-js only reads `storage` when persistSession is on; refresh stays off so this client never rewrites the app's session.
  return createClient(requireEnv('LIGHT_SB_URL'), requireEnv('LIGHT_SB_PUBLISHABLE_KEY'), {
    auth: { persistSession: true, autoRefreshToken: false, storageKey: 'light-auth', storage },
  });
}

/** Service-role client: bypasses RLS, so it shows what the server really holds. */
export function adminClient(): SupabaseClient {
  return createClient(requireEnv('LIGHT_SB_URL'), requireEnv('LIGHT_SB_SERVICE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Empties `results` and `daily_completions` and deletes every auth user, so no test depends on another. */
export async function resetDatabase(): Promise<void> {
  const admin = adminClient();

  const results = await admin.from('results').delete().not('id', 'is', null);
  if (results.error) throw new Error(`Could not clear results: ${results.error.message}`);
  const completions = await admin.from('daily_completions').delete().not('user_id', 'is', null);
  if (completions.error) throw new Error(`Could not clear daily_completions: ${completions.error.message}`);

  // Collect every id first: deleting while paging would skip users.
  const perPage = 200;
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    ids.push(...data.users.map((user) => user.id));
    if (data.users.length < perPage) break;
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`Could not delete user ${id}: ${error.message}`);
  }
}
