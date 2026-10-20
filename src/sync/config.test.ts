import { readSyncConfig, syncConfig } from './config';

const URL_OK = 'https://x.supabase.co';

test('readSyncConfig needs url and key', () => {
  expect(readSyncConfig({})).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: '' })).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' })).toBeNull();
  expect(readSyncConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1' }))
    .toEqual({ url: URL_OK, publishableKey: 'sb_publishable_1', turnstileSiteKey: null });
  expect(readSyncConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'k', VITE_TURNSTILE_SITE_KEY: 't' })?.turnstileSiteKey).toBe('t');
});

test('an empty Turnstile site key counts as no site key', () => {
  expect(readSyncConfig({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'k', VITE_TURNSTILE_SITE_KEY: '' })?.turnstileSiteKey).toBeNull();
});

test('the Supabase URL must be an http(s) URL, or sync stays off', () => {
  const withUrl = (url: string) => readSyncConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: 'k' });
  expect(withUrl('x.supabase.co')).toBeNull(); // missing protocol
  expect(withUrl('ftp://x.supabase.co')).toBeNull();
  expect(withUrl('javascript:alert(1)')).toBeNull();
  expect(withUrl(URL_OK)).toEqual({ url: URL_OK, publishableKey: 'k', turnstileSiteKey: null });
  expect(withUrl('http://127.0.0.1:54321')?.url).toBe('http://127.0.0.1:54321'); // the local stack
});

test('the test build has no sync config', () => {
  expect(syncConfig).toBeNull();
});
