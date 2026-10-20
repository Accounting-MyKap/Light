import type { SyncReport } from './syncEngine';

export interface SyncScheduler {
  /**
   * Runs a sync as soon as none is in flight and resolves with the report of the run that serves this call.
   * Calls that arrive during a run share the one follow-up run. Rejects if that run rejects or the scheduler is disposed.
   */
  request(): Promise<SyncReport>;
  /** Cancels the pending retry and starts nothing more; a run already in flight may finish. */
  dispose(): void;
}

export interface SyncSchedulerOptions {
  /** Wait before the first retry; it doubles after each failed run. Default 1 s. */
  baseDelayMs?: number;
  /** The longest wait between retries. Default 5 minutes. */
  maxDelayMs?: number;
}

interface Waiter {
  resolve(report: SyncReport): void;
  reject(error: unknown): void;
}

/**
 * Keeps `run` to one execution at a time and retries it by itself, with a growing wait, while it reports `offline`,
 * `error` or rejects. Only an `ok` report resets the wait; an explicit `request()` never does.
 */
export function createSyncScheduler(run: () => Promise<SyncReport>, options: SyncSchedulerOptions = {}): SyncScheduler {
  const { baseDelayMs = 1000, maxDelayMs = 300_000 } = options;
  let running = false;
  let disposed = false;
  let nextDelayMs = baseDelayMs;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Callers the next run will serve. A run takes them when it starts, so later callers wait for the one after it.
  let waiting: Waiter[] = [];

  function backOff(): void {
    retryTimer = setTimeout(start, nextDelayMs);
    nextDelayMs = Math.min(nextDelayMs * 2, maxDelayMs);
  }

  async function start(): Promise<void> {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    running = true;
    const serving = waiting;
    waiting = [];

    let failed = true;
    try {
      const report = await run();
      failed = report.status !== 'ok';
      for (const waiter of serving) waiter.resolve(report);
    } catch (error) {
      // A retry has nobody to tell; it only feeds the backoff.
      for (const waiter of serving) waiter.reject(error);
    }
    running = false;

    if (!failed) nextDelayMs = baseDelayMs;
    if (disposed) return;
    // Someone asked while this run was busy: run again now. That run decides about the next retry.
    if (waiting.length > 0) void start();
    else if (failed) backOff();
  }

  return {
    request() {
      if (disposed) return Promise.reject(new Error('The sync scheduler was disposed'));
      return new Promise<SyncReport>((resolve, reject) => {
        waiting.push({ resolve, reject });
        if (!running) void start();
      });
    },

    dispose() {
      disposed = true;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      const abandoned = waiting;
      waiting = [];
      for (const waiter of abandoned) waiter.reject(new Error('The sync scheduler was disposed'));
    },
  };
}
