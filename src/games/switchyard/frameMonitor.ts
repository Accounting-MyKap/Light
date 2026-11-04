/*
 * Watches how fast the yard is drawn, so a phone too slow for the decoration plays on without it («lite»): no smoke,
 * and no animated beacons, fireflies or other particles. Pure: the loop feeds it the time of every frame.
 *
 * The frames are averaged over windows of WINDOW_MS. The yard turns lite after SLOW_WINDOWS slow windows in a row
 * (about 2 s of frames slower than SLOW_FRAME_MS on average), and stays lite for the rest of the game, so it never
 * flips back and forth. A single long frame slows one window at most, and a gap longer than GAP_MS (a pause, a
 * hidden page, a stall) is not a frame at all: the watch starts over after it.
 */

/**
 * Frames slower than this on average (under about 26 a second) are too slow for the decoration. Above 33 ms, so a
 * phone held at 30 a second on purpose (an iPhone in Low Power Mode) keeps its scenery.
 */
export const SLOW_FRAME_MS = 38;
export const WINDOW_MS = 500;
export const SLOW_WINDOWS = 4;
export const GAP_MS = 250;

export interface FrameMonitor {
  /** Time of the latest frame; null before the first one. */
  last: number | null;
  /** Length and frames of the window being measured. */
  span: number;
  frames: number;
  /** Slow windows in a row so far. */
  slow: number;
  /** Decided for good. */
  lite: boolean;
}

export function createFrameMonitor(): FrameMonitor {
  return { last: null, span: 0, frames: 0, slow: 0, lite: false };
}

/** The monitor after a frame drawn at `time` (ms, any origin). */
export function recordFrame(monitor: FrameMonitor, time: number): FrameMonitor {
  if (monitor.lite) return monitor;
  if (monitor.last === null) return { ...monitor, last: time };
  const interval = time - monitor.last;
  if (interval < 0 || interval > GAP_MS) return { ...createFrameMonitor(), last: time };
  const span = monitor.span + interval;
  const frames = monitor.frames + 1;
  if (span < WINDOW_MS) return { ...monitor, last: time, span, frames };
  const slow = span / frames > SLOW_FRAME_MS ? monitor.slow + 1 : 0;
  return { last: time, span: 0, frames: 0, slow, lite: slow >= SLOW_WINDOWS };
}
