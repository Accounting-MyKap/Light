/*
 * Plain 2D geometry for the tracks: lines with rounded corners, the point and heading at a distance along them,
 * and parallel copies for the rails. Board units, with y growing downward as on screen; angles in degrees, 0 to
 * the right and 90 downward.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Polyline {
  points: Point[];
  /** Distance from the start to each point. */
  cumulative: number[];
  length: number;
}

export interface Pose {
  x: number;
  y: number;
  /** Heading in degrees: 0 to the right, 90 downward. */
  angle: number;
}

const EPSILON = 1e-9;

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function length(v: Point): number {
  return Math.hypot(v.x, v.y);
}

function unit(v: Point): Point {
  const l = length(v);
  return l < EPSILON ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

/**
 * Replaces each corner with a circular arc of the given radius, sampled every `step` units or less. A corner whose
 * legs are too short for the radius gets the largest arc that fits in half of each leg. Points in a straight run
 * are dropped.
 */
export function roundCorners(points: readonly Point[], radius: number, step = 3): Point[] {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  const out: Point[] = [{ ...points[0] }];
  const push = (p: Point) => {
    if (!samePoint(out[out.length - 1], p)) out.push(p);
  };

  for (let i = 1; i < points.length - 1; i++) {
    const [p0, p1, p2] = [points[i - 1], points[i], points[i + 1]];
    const d1 = unit(sub(p1, p0));
    const d2 = unit(sub(p2, p1));
    const turn = Math.acos(Math.min(1, Math.max(-1, d1.x * d2.x + d1.y * d2.y)));
    if (turn < 1e-6) continue; // straight run: the corner point adds nothing

    const half = Math.tan(turn / 2);
    const tangent = Math.min(radius * half, length(sub(p1, p0)) / 2, length(sub(p2, p1)) / 2);
    const r = tangent / half;
    const a = { x: p1.x - d1.x * tangent, y: p1.y - d1.y * tangent };
    const side = cross(d1, d2) > 0 ? 1 : -1;
    const normal = side > 0 ? { x: -d1.y, y: d1.x } : { x: d1.y, y: -d1.x };
    const center = { x: a.x + normal.x * r, y: a.y + normal.y * r };
    const start = Math.atan2(a.y - center.y, a.x - center.x);
    const n = Math.max(1, Math.ceil((r * turn) / step));

    push(a);
    for (let k = 1; k < n; k++) {
      const angle = start + (side * turn * k) / n;
      push({ x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) });
    }
    push({ x: p1.x + d2.x * tangent, y: p1.y + d2.y * tangent });
  }

  push({ ...points[points.length - 1] });
  return out;
}

export function polyline(points: readonly Point[]): Polyline {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + length(sub(points[i], points[i - 1])));
  }
  return { points: points.map((p) => ({ ...p })), cumulative, length: cumulative[cumulative.length - 1] };
}

/** The point and heading at `distance` from the start, clamped to the line. */
export function poseAt(line: Polyline, distance: number): Pose {
  const { points, cumulative } = line;
  if (points.length === 1) return { ...points[0], angle: 0 };
  const d = Math.min(line.length, Math.max(0, distance));
  // The last piece whose start is at or before d.
  let lo = 0;
  let hi = points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulative[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo];
  const b = points[lo + 1];
  const piece = cumulative[lo + 1] - cumulative[lo];
  const t = piece < EPSILON ? 0 : (d - cumulative[lo]) / piece;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

/**
 * A copy of the line moved `offset` units along its normal (−dy, dx): with y downward, a positive offset is on the
 * right-hand side of the direction of travel. Meant for densely sampled lines (rounded corners), where the average
 * of the neighbouring directions is a good normal.
 */
export function offsetPolyline(points: readonly Point[], offset: number): Point[] {
  return points.map((p, i) => {
    const before = i > 0 ? unit(sub(p, points[i - 1])) : null;
    const after = i < points.length - 1 ? unit(sub(points[i + 1], p)) : null;
    const dir = unit({ x: (before?.x ?? 0) + (after?.x ?? 0), y: (before?.y ?? 0) + (after?.y ?? 0) });
    return { x: p.x - dir.y * offset, y: p.y + dir.x * offset };
  });
}

/** True when the two segments cross each other. Touching at an end, or running parallel, does not count. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = cross(sub(b, a), sub(c, a));
  const o2 = cross(sub(b, a), sub(d, a));
  const o3 = cross(sub(d, c), sub(a, c));
  const o4 = cross(sub(d, c), sub(b, c));
  const tol = 1e-9;
  return o1 * o2 < -tol && o3 * o4 < -tol;
}

export type Heading = 'right' | 'down-right' | 'down' | 'down-left' | 'left' | 'up-left' | 'up' | 'up-right';

const HEADINGS: readonly Heading[] = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];

/** The nearest of the eight screen directions for an angle in degrees. */
export function headingName(angle: number): Heading {
  const normalized = ((angle % 360) + 360) % 360;
  return HEADINGS[Math.round(normalized / 45) % 8];
}
