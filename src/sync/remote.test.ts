import { classifyError, createSupabaseRemote, fetchWithTimeout, RemoteError, REQUEST_TIMEOUT_MS } from './remote';
import type { RemoteResult } from './remote';

test.each([
  [{ code: '23514' }, 'rejected'], [{ code: 'P0001' }, 'rejected'], [{ code: '23503' }, 'rejected'],
  [{ code: '22P02' }, 'rejected'], [{ code: '23502' }, 'rejected'],
  [{ status: 401 }, 'auth'], [{ status: 403 }, 'auth'], [{ code: 'PGRST301' }, 'auth'], [{ code: 'PGRST302' }, 'auth'],
  [{ code: '42501' }, 'auth'], [{ name: 'AuthSessionMissingError' }, 'auth'],
  [{ name: 'TypeError', message: 'Failed to fetch' }, 'network'], [{ status: 503 }, 'network'], [{ status: 0 }, 'network'],
  [{ code: '23505' }, 'network'], [{}, 'network'],
  [{ status: 400, code: '23514' }, 'rejected'],
])('classifyError(%j) = %s', (e, kind) => {
  expect(classifyError(e)).toBe(kind);
});

test('RemoteError is a real Error carrying its kind', () => {
  const error = new RemoteError('auth', 'session expired');
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(RemoteError);
  expect(error.kind).toBe('auth');
  expect(error.message).toBe('session expired');
  expect(error.name).toBe('RemoteError');
});

// --- createSupabaseRemote against a stubbed fetch: only the request shapes and error mapping, no real server. ---

const config = { url: 'https://proj.supabase.co', publishableKey: 'sb_publishable_test', turnstileSiteKey: null };

interface Call { method: string; url: URL; headers: Headers; body: unknown }

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

function storedSession(userId: string): Record<string, string> {
  return {
    'light-auth': JSON.stringify({
      access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }),
  };
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Stubs `fetch` and returns the recorded calls; `respond` decides each reply. */
function stubFetch(respond: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      url: new URL(String(input)),
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return respond(call);
  });
  return calls;
}

// Each test builds its own client on purpose (own storage, own fetch stub), which makes supabase-js warn about
// "multiple GoTrueClient instances". The app creates a single client, so keep that warning out of the test output.
beforeEach(() => {
  const warn = console.warn.bind(console);
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple GoTrueClient instances')) return;
    warn(...args);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const result: RemoteResult = {
  id: 'r-1', game_id: 'sequence', level: 3, score: 120, accuracy: 0.9, duration_ms: 45_000, is_daily: false,
  played_at: '2026-10-20T10:00:00.000Z',
};

describe('createSupabaseRemote', () => {
  test('upsertResults inserts missing rows only and never sends a user id', async () => {
    const calls = stubFetch(() => json(201));
    await createSupabaseRemote(config, { storage: memoryStorage() }).upsertResults([result]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.pathname).toBe('/rest/v1/results');
    expect(calls[0].url.searchParams.get('on_conflict')).toBe('id');
    expect(calls[0].headers.get('Prefer')).toContain('resolution=ignore-duplicates');
    expect(calls[0].headers.get('apikey')).toBe('sb_publishable_test');
    expect(calls[0].body).toEqual([result]);
    expect(JSON.stringify(calls[0].body)).not.toContain('user_id');
  });

  test('upsertCompletions conflicts on (user_id, day) and keeps existing rows', async () => {
    const calls = stubFetch(() => json(201));
    await createSupabaseRemote(config, { storage: memoryStorage() }).upsertCompletions([{ day: '2026-10-20', games: ['sequence', 'arrows'] }]);
    expect(calls[0].url.pathname).toBe('/rest/v1/daily_completions');
    expect(calls[0].url.searchParams.get('on_conflict')).toBe('user_id,day');
    expect(calls[0].headers.get('Prefer')).toContain('resolution=ignore-duplicates');
    expect(calls[0].body).toEqual([{ day: '2026-10-20', games: ['sequence', 'arrows'] }]);
  });

  test('upserting nothing makes no request', async () => {
    const calls = stubFetch(() => json(201));
    const remote = createSupabaseRemote(config, { storage: memoryStorage() });
    await remote.upsertResults([]);
    await remote.upsertCompletions([]);
    expect(calls).toHaveLength(0);
  });

  test.each([
    ['a check violation', () => json(400, { code: '23514', message: 'new row violates check constraint' }), 'rejected'],
    ['an expired JWT', () => json(401, { code: 'PGRST301', message: 'JWT expired' }), 'auth'],
    ['a server error', () => json(503, { message: 'upstream unavailable' }), 'network'],
  ])('upsertResults maps %s to a %s RemoteError', async (_label, reply, kind) => {
    stubFetch(reply);
    const failure = createSupabaseRemote(config, { storage: memoryStorage() }).upsertResults([result]);
    await expect(failure).rejects.toBeInstanceOf(RemoteError);
    await expect(failure).rejects.toMatchObject({ kind });
  });

  test('upsertResults maps a failed fetch to a network RemoteError', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    await expect(createSupabaseRemote(config, { storage: memoryStorage() }).upsertResults([result]))
      .rejects.toMatchObject({ name: 'RemoteError', kind: 'network' });
  });

  test('percentile calls the RPC and passes null through', async () => {
    let reply: unknown = 87;
    const calls = stubFetch(() => json(200, reply));
    const remote = createSupabaseRemote(config, { storage: memoryStorage() });
    expect(await remote.percentile('sequence', 120)).toBe(87);
    expect(calls[0].url.pathname).toBe('/rest/v1/rpc/get_percentile');
    expect(calls[0].body).toEqual({ p_game_id: 'sequence', p_best_score: 120 });
    reply = null;
    expect(await remote.percentile('sequence', 120)).toBeNull();
  });

  test('signInGuest creates an anonymous user, forwarding the captcha token', async () => {
    const calls = stubFetch(() => json(200, {
      access_token: 'a', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
      user: { id: 'anon-1', aud: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    }));
    const storage = memoryStorage();
    expect(await createSupabaseRemote(config, { storage }).signInGuest('tok-1')).toBe('anon-1');
    expect(calls[0].url.pathname).toBe('/auth/v1/signup');
    expect(calls[0].body).toMatchObject({ gotrue_meta_security: { captcha_token: 'tok-1' } });
    expect(storage.getItem('light-auth')).toContain('anon-1');
  });

  test('currentUserId is null without a stored session and does not hit the network', async () => {
    const calls = stubFetch(() => json(200, {}));
    expect(await createSupabaseRemote(config, { storage: memoryStorage() }).currentUserId()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test('currentUserId validates the stored session against the server', async () => {
    const calls = stubFetch(() => json(200, { id: 'user-1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }));
    const remote = createSupabaseRemote(config, { storage: memoryStorage(storedSession('user-1')) });
    expect(await remote.currentUserId()).toBe('user-1');
    expect(calls.map((c) => c.url.pathname)).toEqual(['/auth/v1/user']);
  });

  test('currentUserId drops a session the server no longer knows and returns null', async () => {
    const calls = stubFetch((call) => call.url.pathname === '/auth/v1/user'
      ? json(403, { code: 'user_not_found', error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' })
      : json(204));
    const storage = memoryStorage(storedSession('ghost'));
    expect(await createSupabaseRemote(config, { storage }).currentUserId()).toBeNull();
    expect(storage.getItem('light-auth')).toBeNull();
    expect(calls.some((c) => c.url.pathname === '/auth/v1/logout' && c.url.searchParams.get('scope') === 'local')).toBe(true);
  });

  test('currentUserId keeps the session and throws a network error when offline', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    const storage = memoryStorage(storedSession('user-1'));
    await expect(createSupabaseRemote(config, { storage }).currentUserId()).rejects.toMatchObject({ kind: 'network' });
    expect(storage.getItem('light-auth')).not.toBeNull();
  });

  // supabase-js refreshes an expired session on start-up and drops a dead one silently. The failure the app can see
  // is a session that expires while it is running: the refresh then happens inside getSession() and returns the error.
  describe('when the stored session expires while the app is running', () => {
    async function remoteWithExpiredSession(userId: string) {
      const storage = memoryStorage(storedSession(userId));
      const remote = createSupabaseRemote(config, { storage });
      await new Promise((resolve) => setTimeout(resolve, 20)); // let supabase-js finish its start-up pass
      const stored = JSON.parse(storage.getItem('light-auth')!);
      storage.setItem('light-auth', JSON.stringify({ ...stored, expires_at: Math.floor(Date.now() / 1000) - 60 }));
      return { remote, storage };
    }

    test.each(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found'])(
      'currentUserId resolves null for a dead refresh token (%s) so a fresh guest can be created',
      async (code) => {
        const calls = stubFetch(() => json(400, { code, error_code: code, msg: 'Invalid Refresh Token' }));
        const { remote, storage } = await remoteWithExpiredSession('user-1');
        expect(await remote.currentUserId()).toBeNull();
        expect(calls.some((c) => c.url.pathname === '/auth/v1/token')).toBe(true);
        expect(storage.getItem('light-auth')).toBeNull();
      },
    );

    test('a genuine network failure while refreshing still rejects with kind network and keeps the session', async () => {
      vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
      const { remote, storage } = await remoteWithExpiredSession('user-1');
      vi.useFakeTimers(); // supabase-js retries a failed refresh with backoff for up to 30 seconds
      try {
        const outcome = remote.currentUserId().then(() => undefined, (error: unknown) => error);
        await vi.advanceTimersByTimeAsync(31_000);
        expect(await outcome).toMatchObject({ name: 'RemoteError', kind: 'network' });
        expect(storage.getItem('light-auth')).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    test('any other refresh failure keeps its classification', async () => {
      stubFetch(() => json(400, { code: 'validation_failed', error_code: 'validation_failed', msg: 'nope' }));
      const { remote } = await remoteWithExpiredSession('user-1');
      await expect(remote.currentUserId()).rejects.toMatchObject({ name: 'RemoteError', kind: 'network' });
    });
  });

  test('deleteMyData removes only the signed-in user rows from both tables', async () => {
    const calls = stubFetch((call) => call.url.pathname === '/auth/v1/user'
      ? json(200, { id: 'user-1', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
      : json(204));
    await createSupabaseRemote(config, { storage: memoryStorage(storedSession('user-1')) }).deleteMyData();
    const deletes = calls.filter((c) => c.method === 'DELETE');
    expect(deletes.map((c) => c.url.pathname)).toEqual(['/rest/v1/results', '/rest/v1/daily_completions']);
    expect(deletes.every((c) => c.url.searchParams.get('user_id') === 'eq.user-1')).toBe(true);
  });

  test('deleteMyData without a session fails with an auth error and deletes nothing', async () => {
    const calls = stubFetch(() => json(204));
    await expect(createSupabaseRemote(config, { storage: memoryStorage() }).deleteMyData()).rejects.toMatchObject({ kind: 'auth' });
    expect(calls).toHaveLength(0);
  });
});

describe('request timeout', () => {
  /**
   * A fetch that never answers but, like the real one, rejects with the abort reason once its signal aborts.
   * Returns the paths it was called with (clients left over from earlier tests may call it too).
   */
  function stubHangingFetch(): string[] {
    const paths: string[] = [];
    vi.stubGlobal('fetch', (input: string | URL | Request, init: RequestInit = {}) => {
      paths.push(new URL(String(input)).pathname);
      return new Promise<Response>((_resolve, reject) => {
        const { signal } = init;
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    });
    return paths;
  }

  /** Runs `body` as if this browser had no `AbortSignal.timeout` / `AbortSignal.any`, then puts them back. */
  async function withoutAbortSignalHelpers(names: Array<'timeout' | 'any'>, body: () => Promise<void>) {
    const saved = { timeout: AbortSignal.timeout, any: AbortSignal.any };
    try {
      for (const name of names) Object.assign(AbortSignal, { [name]: undefined });
      await body();
    } finally {
      Object.assign(AbortSignal, saved);
    }
  }

  test('a request that hangs is given up after 20 seconds and fails as a network error', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const paths = stubHangingFetch();
    const failure = createSupabaseRemote(config, { storage: memoryStorage() }).upsertResults([result]);
    await vi.waitFor(() => expect(paths).toContain('/rest/v1/results'));
    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
    expect(timeout).toHaveBeenCalledWith(20_000);

    deadline.abort(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(failure).rejects.toMatchObject({ name: 'RemoteError', kind: 'network' });
  });

  test('without AbortSignal.timeout or AbortSignal.any a hanging request still fails after 20 seconds', async () => {
    await withoutAbortSignalHelpers(['timeout', 'any'], async () => {
      vi.useFakeTimers();
      try {
        const paths = stubHangingFetch();
        let settled = false;
        const outcome = createSupabaseRemote(config, { storage: memoryStorage() })
          .upsertResults([result])
          .then(() => undefined, (error: unknown) => error)
          .finally(() => (settled = true));
        await vi.advanceTimersByTimeAsync(0);
        expect(paths).toContain('/rest/v1/results');
        await vi.advanceTimersByTimeAsync(19_999);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await outcome).toMatchObject({ name: 'RemoteError', kind: 'network' });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  test.each([
    ['with', []],
    ['without', ['any']],
  ] as const)("%s AbortSignal.any, the caller's own signal still aborts the request", async (_label, missing) => {
    await withoutAbortSignalHelpers([...missing], async () => {
      stubHangingFetch();
      const caller = new AbortController();
      const request = fetchWithTimeout('https://proj.supabase.co/rest/v1/games', { signal: caller.signal });
      caller.abort();
      await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});
