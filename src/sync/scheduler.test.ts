import { createSyncScheduler } from './scheduler';
import type { SyncReport } from './syncEngine';

const ok: SyncReport = { status: 'ok', uploaded: 1, rejected: 0, pending: 0 };
const offline: SyncReport = { status: 'offline', uploaded: 0, rejected: 0, pending: 2 };
const failed: SyncReport = { status: 'error', uploaded: 0, rejected: 0, pending: 2 };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A run that stays open until the test releases it; each call opens a new gate. */
function gatedRun() {
  const releases: Array<(report: SyncReport) => void> = [];
  const run = vi.fn(() => new Promise<SyncReport>((resolve) => releases.push(resolve)));
  return { run, release: (report: SyncReport) => releases.shift()!(report) };
}

/** A run that records when it was called and returns whatever `next.report` says at that moment. */
function recordedRun(report: SyncReport) {
  const next = { report };
  const times: number[] = [];
  const run = vi.fn(async () => {
    times.push(Date.now());
    return next.report;
  });
  return { run, next, times, gaps: () => times.slice(1).map((time, i) => time - times[i]) };
}

test('one run at a time; requests during a run collapse into one follow-up run', async () => {
  const { run, release } = gatedRun();
  const s = createSyncScheduler(run);
  const p1 = s.request();
  const p2 = s.request();
  const p3 = s.request();
  expect(run).toHaveBeenCalledTimes(1);
  release(ok);
  expect(await p1).toBe(ok);
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  const second = { ...ok, uploaded: 5 };
  release(second);
  // Callers that arrived during the first run get the report of the run that served them.
  expect(await Promise.all([p2, p3])).toEqual([second, second]);
  expect(run).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(600_000);
  expect(run).toHaveBeenCalledTimes(2);
});

test('a request after an idle period starts a new run at once', async () => {
  const run = vi.fn(async () => ok);
  const s = createSyncScheduler(run);
  await s.request();
  await s.request();
  expect(run).toHaveBeenCalledTimes(2);
});

test('offline retries back off 1s, 2s, 4s and cap at 5 minutes; ok resets', async () => {
  const { run, next, times, gaps } = recordedRun(offline);
  const s = createSyncScheduler(run);
  expect(await s.request()).toBe(offline);
  const start = times[0];

  await vi.advanceTimersByTimeAsync(999);
  expect(run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(2000);
  expect(run).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(4000);
  expect(run).toHaveBeenCalledTimes(4);
  expect(times.map((time) => time - start)).toEqual([0, 1000, 3000, 7000]);

  await vi.advanceTimersByTimeAsync(2_000_000);
  expect(gaps().slice(0, 9)).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 256000]);
  const capped = gaps().slice(9);
  expect(capped.length).toBeGreaterThanOrEqual(2);
  expect(capped.every((gap) => gap === 300_000)).toBe(true);

  // The next retry succeeds: no more retries, and the wait starts over from one second.
  next.report = ok;
  await vi.advanceTimersByTimeAsync(300_000);
  const calls = run.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1_000_000);
  expect(run).toHaveBeenCalledTimes(calls);
  next.report = failed;
  const before = Date.now();
  await s.request();
  await vi.advanceTimersByTimeAsync(999);
  expect(run).toHaveBeenCalledTimes(calls + 1);
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(calls + 2);
  expect(times[times.length - 1] - before).toBe(1000);
});

test("an 'error' report backs off like 'offline'", async () => {
  const { run, gaps } = recordedRun(failed);
  createSyncScheduler(run).request();
  await vi.advanceTimersByTimeAsync(7000);
  expect(run).toHaveBeenCalledTimes(4);
  expect(gaps()).toEqual([1000, 2000, 4000]);
});

test('the delays can be configured', async () => {
  const { run, gaps } = recordedRun(offline);
  createSyncScheduler(run, { baseDelayMs: 10, maxDelayMs: 25 }).request();
  await vi.advanceTimersByTimeAsync(100);
  expect(gaps().slice(0, 4)).toEqual([10, 20, 25, 25]);
});

test('an explicit request during a backoff wait runs at once and keeps the backoff level', async () => {
  const { run, times } = recordedRun(offline);
  const s = createSyncScheduler(run);
  const start = Date.now();
  await s.request();
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(2);
  // Retry number 3 was due at 3000 ms; asking at 1500 ms runs it now and cancels that timer.
  await vi.advanceTimersByTimeAsync(500);
  await s.request();
  expect(run).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(2500);
  expect(run).toHaveBeenCalledTimes(3);
  // The failed explicit run advanced the level (1 s, 2 s, now 4 s): it was not reset to 1 s.
  await vi.advanceTimersByTimeAsync(1500);
  expect(run).toHaveBeenCalledTimes(4);
  expect(times.map((time) => time - start)).toEqual([0, 1000, 1500, 5500]);
});

test('a request that arrives during a failing run still gets its follow-up run right away', async () => {
  const { run, release } = gatedRun();
  const s = createSyncScheduler(run);
  const p1 = s.request();
  const p2 = s.request();
  release(offline);
  expect(await p1).toBe(offline);
  await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  release(ok);
  expect(await p2).toBe(ok);
  // The follow-up succeeded, so there is no retry left over from the first failure.
  await vi.advanceTimersByTimeAsync(600_000);
  expect(run).toHaveBeenCalledTimes(2);
});

test('a run that rejects rejects the callers it serves and backs off like an error', async () => {
  const failure = new Error('local storage failed');
  const run = vi.fn<() => Promise<SyncReport>>().mockRejectedValueOnce(failure).mockResolvedValue(ok);
  const s = createSyncScheduler(run);
  await expect(s.request()).rejects.toBe(failure);
  expect(run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(999);
  expect(run).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  // The retry succeeded and nobody was waiting for it; the scheduler keeps working.
  await vi.advanceTimersByTimeAsync(600_000);
  expect(run).toHaveBeenCalledTimes(2);
  expect(await s.request()).toBe(ok);
});

test('a retry that rejects keeps backing off without unhandled rejections', async () => {
  const run = vi.fn<() => Promise<SyncReport>>().mockRejectedValue(new Error('still broken'));
  const s = createSyncScheduler(run);
  await expect(s.request()).rejects.toThrow('still broken');
  await vi.advanceTimersByTimeAsync(3000);
  expect(run).toHaveBeenCalledTimes(3);
  s.dispose();
});

test('dispose cancels pending retries', async () => {
  const { run } = recordedRun(offline);
  const s = createSyncScheduler(run);
  await s.request();
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(2);
  s.dispose();
  await vi.advanceTimersByTimeAsync(2_000_000);
  expect(run).toHaveBeenCalledTimes(2);
});

test('dispose lets the run in flight finish but starts nothing after it', async () => {
  const { run, release } = gatedRun();
  const s = createSyncScheduler(run);
  const inFlight = s.request();
  const queued = s.request();
  const queuedOutcome = expect(queued).rejects.toThrow(/disposed/);
  s.dispose();
  await queuedOutcome;
  release(offline);
  expect(await inFlight).toBe(offline);
  await vi.advanceTimersByTimeAsync(2_000_000);
  expect(run).toHaveBeenCalledTimes(1);
});

test('a disposed scheduler refuses new requests', async () => {
  const run = vi.fn(async () => ok);
  const s = createSyncScheduler(run);
  s.dispose();
  await expect(s.request()).rejects.toThrow(/disposed/);
  expect(run).not.toHaveBeenCalled();
});
