import { createClient } from '@supabase/supabase-js';
import type { SyncConfig } from './config';

export interface RemoteResult {
  id: string;
  game_id: string;
  level: number;
  score: number;
  accuracy: number;
  duration_ms: number;
  is_daily: boolean;
  played_at: string;
}

export interface RemoteCompletion {
  day: string;
  games: string[];
}

/** `rejected`: the server refuses this data for good. `auth`: the session is missing or invalid. `network`: retry later. */
export type RemoteErrorKind = 'rejected' | 'auth' | 'network';

export class RemoteError extends Error {
  readonly kind: RemoteErrorKind;

  constructor(kind: RemoteErrorKind, message: string) {
    super(message);
    this.name = 'RemoteError';
    this.kind = kind;
  }
}

// Check (23514), foreign key (23503), trigger-raised (P0001), invalid text representation (22P02), not null (23502).
const REJECTED_CODES = new Set(['23514', '23503', 'P0001', '22P02', '23502']);
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', '42501']);
// Refresh tokens the server will never accept again: the guest identity on this device is lost for good.
const DEAD_SESSION_CODES = new Set(['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found']);

export function classifyError(error: { code?: string; status?: number; message?: string; name?: string }): RemoteErrorKind {
  if (error.code && REJECTED_CODES.has(error.code)) return 'rejected';
  if (
    error.status === 401 ||
    error.status === 403 ||
    (error.code && AUTH_CODES.has(error.code)) ||
    error.name?.startsWith('AuthSession')
  ) {
    return 'auth';
  }
  return 'network';
}

export interface RemoteStore {
  /** `null` when there is no (valid) session. */
  currentUserId(): Promise<string | null>;
  /** Creates an anonymous user and returns its id. */
  signInGuest(captchaToken?: string): Promise<string>;
  signOut(): Promise<void>;
  /** Inserts rows the server does not have yet; existing ids are left untouched. Throws `RemoteError`. */
  upsertResults(rows: RemoteResult[]): Promise<void>;
  upsertCompletions(rows: RemoteCompletion[]): Promise<void>;
  percentile(gameId: string, bestScore: number): Promise<number | null>;
  /** Deletes the signed-in user's `results` and `daily_completions`. */
  deleteMyData(): Promise<void>;
}

interface ErrorLike {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
}

function isDeadSession(error: ErrorLike): boolean {
  // supabase-js turns `session_not_found` into AuthSessionMissingError, which carries no code.
  return (error.code !== undefined && DEAD_SESSION_CODES.has(error.code)) || error.name === 'AuthSessionMissingError';
}

function toRemoteError(error: unknown, status?: number): RemoteError {
  if (error instanceof RemoteError) return error;
  const e: ErrorLike = typeof error === 'object' && error !== null ? error : {};
  // PostgREST reports the HTTP status next to the error, not inside it.
  const kind = classifyError({ code: e.code, status: e.status ?? status, message: e.message, name: e.name });
  return new RemoteError(kind, e.message || 'Remote request failed');
}

/** Awaits a supabase-js call and turns both returned and thrown failures into `RemoteError`. */
async function unwrap<R extends { data: unknown; error: ErrorLike | null; status?: number }>(
  request: PromiseLike<R>,
): Promise<R['data']> {
  let response: R;
  try {
    response = await request;
  } catch (error) {
    throw toRemoteError(error);
  }
  if (response.error) throw toRemoteError(response.error, response.status);
  return response.data;
}

/** Longest a request to Supabase may take. Past it the call fails as a network error and the scheduler retries later. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * `fetch` with a deadline: a request that never answers would otherwise hold the single sync run forever.
 * A signal from the caller still aborts the request too.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const deadline = timeoutSignal(REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: init.signal ? eitherSignal(init.signal, deadline) : deadline });
}

// AbortSignal.timeout and AbortSignal.any are recent (Safari 16 and 17.4): older browsers get the same behavior by hand.
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The request timed out', 'TimeoutError')), ms);
  return controller.signal;
}

function eitherSignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  const controller = new AbortController();
  for (const signal of [a, b]) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

export function createSupabaseRemote(config: SyncConfig, options: { storage?: Storage } = {}): RemoteStore {
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'light-auth', storage: options.storage },
    global: { fetch: fetchWithTimeout },
  });

  async function currentUserId(): Promise<string | null> {
    let loaded;
    try {
      loaded = await client.auth.getSession();
    } catch (error) {
      throw toRemoteError(error);
    }
    if (loaded.error) {
      // An expired session is refreshed inside getSession(); a refresh token the server rejects means "signed out",
      // not "try again later". supabase-js has already dropped the stored session, so the caller can sign in a new guest.
      if (isDeadSession(loaded.error)) return null;
      throw toRemoteError(loaded.error);
    }
    if (!loaded.data.session) return null;
    try {
      const { user } = await unwrap(client.auth.getUser());
      return user?.id ?? null;
    } catch (error) {
      const remoteError = toRemoteError(error);
      if (remoteError.kind !== 'auth') throw remoteError;
      // The session is dead (e.g. the anonymous user was cleaned up): forget it locally so the app can start a new one.
      await client.auth.signOut({ scope: 'local' });
      return null;
    }
  }

  return {
    currentUserId,

    async signInGuest(captchaToken) {
      const { user } = await unwrap(client.auth.signInAnonymously({ options: { captchaToken } }));
      if (!user) throw new RemoteError('network', 'Anonymous sign-in returned no user');
      return user.id;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw toRemoteError(error);
    },

    async upsertResults(rows) {
      if (rows.length === 0) return;
      await unwrap(client.from('results').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
    },

    async upsertCompletions(rows) {
      if (rows.length === 0) return;
      await unwrap(client.from('daily_completions').upsert(rows, { onConflict: 'user_id,day', ignoreDuplicates: true }));
    },

    async percentile(gameId, bestScore) {
      const value = await unwrap(client.rpc('get_percentile', { p_game_id: gameId, p_best_score: bestScore }));
      return (value as number | null) ?? null;
    },

    async deleteMyData() {
      const userId = await currentUserId();
      if (!userId) throw new RemoteError('auth', 'Not signed in');
      await unwrap(client.from('results').delete().eq('user_id', userId));
      await unwrap(client.from('daily_completions').delete().eq('user_id', userId));
    },
  };
}
