import { GAMES } from '../games/registry';
import { RemoteError, type RemoteErrorKind, type RemoteResult, type RemoteStore } from '../sync/remote';

export type FakeRemote = RemoteStore & {
  /** What the "server" stores per guest identity. `completions` holds the uploaded days. */
  users: Map<string, { results: Map<string, RemoteResult>; completions: Set<string> }>;
  /** The signed-in user; `null` means no session. Tests may set it to simulate a lost session. */
  currentUser: string | null;
  /** Number of guest identities created. */
  signInCount: number;
  /** Highest accepted score per game, like the server's `games.max_score`. */
  maxScore: Record<string, number>;
  /** The next `times` calls to signInGuest, upsertResults, upsertCompletions, percentile or deleteMyData throw `RemoteError(kind)`. */
  failNext(kind: RemoteErrorKind, times?: number): void;
  /** Rows matching `isRejected` make the server refuse the whole batch they are in, on top of the score limit. */
  rejectIf(isRejected: (row: RemoteResult) => boolean): void;
};

/** In-memory stand-in for the Supabase backend, with the same insert-or-ignore, all-or-nothing and session rules. */
export function createFakeRemote(): FakeRemote {
  const armedFailures: RemoteErrorKind[] = [];
  let isRejected: (row: RemoteResult) => boolean = () => false;

  function failIfArmed(): void {
    const kind = armedFailures.shift();
    if (kind) throw new RemoteError(kind, `Injected ${kind} failure`);
  }

  function signedInUser() {
    const user = remote.currentUser === null ? undefined : remote.users.get(remote.currentUser);
    if (!user) throw new RemoteError('auth', 'No valid session');
    return user;
  }

  /** Foreign key on `game_id` and the score ceiling trigger. */
  function violatesConstraints(row: RemoteResult): boolean {
    return !(row.game_id in remote.maxScore) || row.score > remote.maxScore[row.game_id] || isRejected(row);
  }

  const remote: FakeRemote = {
    users: new Map(),
    currentUser: null,
    signInCount: 0,
    maxScore: Object.fromEntries(GAMES.map((game) => [game.id, game.maxScore])),

    failNext(kind, times = 1) {
      for (let i = 0; i < times; i++) armedFailures.push(kind);
    },

    rejectIf(predicate) {
      isRejected = predicate;
    },

    async currentUserId() {
      return remote.currentUser;
    },

    async signInGuest() {
      failIfArmed();
      remote.signInCount++;
      const id = `guest-${remote.signInCount}`;
      remote.users.set(id, { results: new Map(), completions: new Set() });
      remote.currentUser = id;
      return id;
    },

    async signOut() {
      remote.currentUser = null;
    },

    async upsertResults(rows) {
      failIfArmed();
      const user = signedInUser();
      if (rows.some(violatesConstraints)) throw new RemoteError('rejected', 'A row violates a constraint');
      for (const row of rows) if (!user.results.has(row.id)) user.results.set(row.id, row);
    },

    async upsertCompletions(rows) {
      failIfArmed();
      const user = signedInUser();
      for (const row of rows) user.completions.add(row.day);
    },

    async percentile() {
      failIfArmed();
      signedInUser();
      return null;
    },

    async deleteMyData() {
      failIfArmed();
      const user = signedInUser();
      user.results.clear();
      user.completions.clear();
    },
  };
  return remote;
}
