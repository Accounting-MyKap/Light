import { readSyncConfig, syncConfig } from './config';

test('readSyncConfig needs url and key', () => {
  expect(readSyncConfig({})).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' })).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }))
    .toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_1', turnstileSiteKey: null });
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_PUBLISHABLE_KEY: 'k', VITE_TURNSTILE_SITE_KEY: 't' })?.turnstileSiteKey).toBe('t');
});

test('an empty Turnstile site key counts as no site key', () => {
  expect(readSyncConfig({ VITE_SUPABASE_URL: 'u', VITE_SUPABASE_PUBLISHABLE_KEY: 'k', VITE_TURNSTILE_SITE_KEY: '' })?.turnstileSiteKey).toBeNull();
});

test('the test build has no sync config', () => {
  expect(syncConfig).toBeNull();
});
