import { createFrameMonitor, recordFrame, type FrameMonitor } from './frameMonitor';

/** Feeds frames `every` ms apart for `ms` ms, starting `gap` ms after the monitor's last frame (or at 0). */
function frames(monitor: FrameMonitor, every: number, ms: number, gap = every) {
  let m = monitor;
  let t = (m.last ?? -gap) + gap;
  for (const end = t + ms; t <= end; t += every) m = recordFrame(m, t);
  return m;
}

/** The time at which the monitor turns lite under steady frames `every` ms apart, or null within `ms`. */
function liteAfter(every: number, ms = 10_000): number | null {
  let m = createFrameMonitor();
  for (let t = 0; t <= ms; t += every) {
    m = recordFrame(m, t);
    if (m.lite) return t;
  }
  return null;
}

test('a smooth yard, at 60 or 40 frames a second, never turns lite', () => {
  expect(liteAfter(1000 / 60)).toBeNull();
  expect(liteAfter(25)).toBeNull();
  expect(liteAfter(1000 / 120)).toBeNull();
});

test('a slow one (under about 35 frames a second) turns lite after about 2 s of it', () => {
  for (const every of [30, 1000 / 30, 50, 100]) {
    const at = liteAfter(every);
    expect(at, `${every} ms frames`).not.toBeNull();
    expect(at!, `${every} ms frames`).toBeGreaterThanOrEqual(1900);
    expect(at!, `${every} ms frames`).toBeLessThanOrEqual(2600);
  }
});

test('one long frame, or a few far apart, do not turn it lite', () => {
  let m = frames(createFrameMonitor(), 16, 3000);
  for (let i = 0; i < 5; i++) {
    m = recordFrame(m, m.last! + 240); // a stall just short of a gap
    m = frames(m, 16, 2000);
  }
  expect(m.lite).toBe(false);
});

test('a pause or a hidden page is a gap, not a slow frame: the watch starts over after it', () => {
  // Slow for 1.5 s, away for a while, slow for 1.5 s again: never 2 s of slow frames in a row.
  let m = frames(createFrameMonitor(), 40, 1500);
  m = frames(m, 40, 1500, 5000);
  m = frames(m, 40, 1500, 300);
  expect(m.lite).toBe(false);
  // A long gap alone is nothing either.
  m = frames(createFrameMonitor(), 16, 1000);
  m = frames(m, 16, 1000, 60_000);
  expect(m.lite).toBe(false);
});

test('once lite, it stays lite for the rest of the game, however smooth the frames get', () => {
  let m = frames(createFrameMonitor(), 40, 3000);
  expect(m.lite).toBe(true);
  const lite = m;
  m = frames(m, 16, 10_000);
  expect(m.lite).toBe(true);
  // Nothing more to measure: the same monitor comes back.
  expect(recordFrame(lite, lite.last! + 16)).toBe(lite);
});
