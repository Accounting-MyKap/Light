import { createRng, seedFromString } from '../../core/rng';
import { clampLevel } from '../../core/difficulty';
import { polyline, poseAt, roundCorners, type Point, type Polyline } from './geometry';

/*
 * The track maps, drawn by hand on the 360 × 600 board. Each map is a tree: the trains leave the tunnel (at the top,
 * or on a side on some levels) and every switch splits the track in two until it ends at a station, on a side, along
 * the bottom or, on some levels, in the middle of the map. Tracks run
 * across the board as well as down, so the trains are often seen from the side. Both exits of a switch start in the
 * heading of the track that arrives, so a train never turns sharply at a junction.
 * Around the tracks grows a night meadow (trees, bushes, rocks, flowers, a pond, fireflies), placed by a generator
 * seeded with the map's key, so a map always looks the same.
 */

export const BOARD = { width: 360, height: 600 } as const;

/** Where the trains come out, and the heading they come out in (degrees, 0 right, 90 down). */
export interface Tunnel {
  at: Point;
  angle: number;
}

/** The usual tunnel, at the top in the middle, facing down. */
const TOP_TUNNEL: Tunnel = { at: { x: 180, y: 40 }, angle: 90 };
/** A tunnel on the left edge, facing right (mirrored maps have it on the right). */
const LEFT_TUNNEL: Tunnel = { at: { x: 40, y: 100 }, angle: 0 };

/** Radius of the curves, in board units. */
const CURVE_RADIUS = 26;

/** How far along an exit the switch arrow looks to decide where it points. */
const ARROW_LOOKAHEAD = 48;

export type Shape = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'heart' | 'cross';

/** Station looks, in the order maps use them: a map with N stations uses the first N. */
export const STATION_STYLES: readonly { color: string; shape: Shape }[] = [
  { color: '#ff5a5a', shape: 'circle' },
  { color: '#ffd23f', shape: 'square' },
  { color: '#4ddc84', shape: 'triangle' },
  { color: '#b48cff', shape: 'diamond' },
  { color: '#ff9a3c', shape: 'star' },
  { color: '#ff6fcf', shape: 'heart' },
  { color: '#5b8cff', shape: 'cross' },
];

export interface TrackSegment {
  id: number;
  line: Polyline;
  from: 'tunnel' | { switch: number };
  end: { switch: number } | { station: number };
}

export interface TrackSwitch {
  id: number;
  at: Point;
  /** The two segments a train can take: option 0 and option 1. */
  exits: [number, number];
  /** Where each exit heads, in degrees, a little way past the junction (for the arrow and the spoken name). */
  exitAngles: [number, number];
}

export interface TrackStation {
  id: number;
  at: Point;
  /** Index in STATION_STYLES. */
  style: number;
  /** The switch settings that lead here from the tunnel. */
  route: [number, 0 | 1][];
  /** Heading of the track as it reaches the station. */
  approachAngle: number;
}

export type DecorKind = 'pine' | 'tree' | 'bush' | 'rock' | 'flowers' | 'grass';

/** A plant or a stone, standing on the point x, y (its base). */
export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  scale: number;
  /** A small variation of the drawing (0 or 1). */
  variant: 0 | 1;
}

export interface Pond {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** A patch of grass a little lighter than the ground. */
export interface Patch {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface TrackMap {
  key: string;
  tunnel: Tunnel;
  segments: TrackSegment[];
  switches: TrackSwitch[];
  stations: TrackStation[];
  decor: Decor[];
  ponds: Pond[];
  fireflies: Point[];
  patches: Patch[];
}

/** How big each kind of decor is: the circle its drawing fits in, centered this far above its base. */
const FOOTPRINT: Record<DecorKind, { lift: number; r: number }> = {
  pine: { lift: 17, r: 18 },
  tree: { lift: 15, r: 16 },
  bush: { lift: 5, r: 10 },
  rock: { lift: 4, r: 8 },
  flowers: { lift: 0, r: 7 },
  grass: { lift: 3, r: 6 },
};

/** The circle the drawing of a decor fits in. */
export function decorFootprint(d: Decor): { x: number; y: number; r: number } {
  const f = FOOTPRINT[d.kind];
  return { x: d.x, y: d.y - f.lift * d.scale, r: f.r * d.scale };
}

/** A hand-drawn leg: the points after its start (the tunnel, or the switch it leaves) and what it ends in. */
export interface Blueprint {
  path: [number, number][];
  to: { station: number } | { left: Blueprint; right: Blueprint };
}

const station = (style: number, path: [number, number][]): Blueprint => ({ path, to: { station: style } });
const fork = (path: [number, number][], left: Blueprint, right: Blueprint): Blueprint => ({ path, to: { left, right } });

/* Side stations end at x 36 or 324, reached by a run across; bottom stations end at y 548. */
const BLUEPRINTS: Record<number, Blueprint> = {
  3: fork(
    [[180, 130]],
    station(0, [
      [180, 144],
      [156, 168],
      [96, 168],
      [96, 330],
      [36, 330],
    ]),
    fork(
      [[180, 270]],
      station(1, [
        [180, 370],
        [100, 370],
        [100, 460],
        [150, 460],
        [150, 548],
      ]),
      station(2, [
        [180, 284],
        [204, 308],
        [264, 308],
        [264, 450],
        [324, 450],
      ]),
    ),
  ),
  // The tunnel is on a side (see TUNNELS): the trains come in across the top.
  4: fork(
    [[120, 100]],
    fork(
      [[230, 100]],
      station(1, [[324, 100]]),
      station(3, [
        [244, 100],
        [268, 124],
        [268, 548],
      ]),
    ),
    fork(
      [
        [134, 100],
        [158, 124],
        [158, 300],
      ],
      station(2, [
        [158, 314],
        [134, 338],
        [36, 338],
      ]),
      station(0, [[158, 548]]),
    ),
  ),
  // A station waits in the middle of the map.
  5: fork(
    [[180, 110]],
    fork(
      [
        [180, 124],
        [156, 148],
        [100, 148],
        [100, 250],
      ],
      station(4, [
        [100, 264],
        [76, 288],
        [36, 288],
      ]),
      station(1, [
        [100, 450],
        [140, 450],
        [140, 548],
      ]),
    ),
    fork(
      [
        [180, 124],
        [204, 148],
        [260, 148],
        [260, 240],
      ],
      station(0, [
        [260, 254],
        [236, 278],
        [180, 278],
        [180, 330],
      ]),
      fork(
        [[260, 400]],
        station(2, [
          [260, 414],
          [284, 438],
          [324, 438],
        ]),
        station(3, [
          [260, 470],
          [220, 470],
          [220, 548],
        ]),
      ),
    ),
  ),
  // The tunnel is on a side (see TUNNELS).
  6: fork(
    [[112, 100]],
    fork(
      [
        [126, 100],
        [150, 124],
        [150, 220],
      ],
      station(5, [
        [150, 234],
        [126, 258],
        [36, 258],
      ]),
      fork(
        [[150, 380]],
        station(2, [
          [150, 394],
          [126, 418],
          [36, 418],
        ]),
        station(0, [
          [150, 480],
          [190, 480],
          [190, 548],
        ]),
      ),
    ),
    fork(
      [[220, 100]],
      station(4, [[324, 100]]),
      fork(
        [
          [234, 100],
          [258, 124],
          [258, 300],
        ],
        station(3, [
          [258, 314],
          [282, 338],
          [324, 338],
        ]),
        station(1, [[258, 548]]),
      ),
    ),
  ),
  // A station waits in the middle of the map.
  7: fork(
    [[180, 110]],
    fork(
      [
        [180, 124],
        [156, 148],
        [100, 148],
        [100, 220],
      ],
      station(6, [
        [100, 234],
        [76, 258],
        [36, 258],
      ]),
      fork(
        [[100, 370]],
        station(3, [
          [100, 384],
          [76, 408],
          [36, 408],
        ]),
        station(1, [
          [100, 470],
          [140, 470],
          [140, 548],
        ]),
      ),
    ),
    fork(
      [
        [180, 124],
        [204, 148],
        [260, 148],
        [260, 220],
      ],
      station(5, [
        [260, 234],
        [284, 258],
        [324, 258],
      ]),
      fork(
        [[260, 330]],
        station(0, [
          [260, 344],
          [236, 368],
          [180, 368],
        ]),
        fork(
          [[260, 450]],
          station(2, [
            [260, 464],
            [284, 488],
            [324, 488],
          ]),
          station(4, [
            [260, 500],
            [220, 500],
            [220, 548],
          ]),
        ),
      ),
    ),
  ),
};

/** Maps whose trains come out of a tunnel on a side; the others use the tunnel at the top. */
const TUNNELS: Partial<Record<number, Tunnel>> = { 4: LEFT_TUNNEL, 6: LEFT_TUNNEL };

export function compileMap(blueprint: Blueprint, key: string, tunnel: Tunnel = TOP_TUNNEL): TrackMap {
  const segments: TrackSegment[] = [];
  const switches: TrackSwitch[] = [];
  const stations: TrackStation[] = [];

  const visit = (leg: Blueprint, start: Point, from: TrackSegment['from'], route: [number, 0 | 1][]): number => {
    const id = segments.length;
    const points = [start, ...leg.path.map(([x, y]) => ({ x, y }))];
    const line = polyline(roundCorners(points, CURVE_RADIUS));
    const end = line.points[line.points.length - 1];
    const segment: TrackSegment = { id, line, from, end: { station: -1 } };
    segments.push(segment);

    if ('station' in leg.to) {
      const stationId = stations.length;
      stations.push({
        id: stationId,
        at: end,
        style: leg.to.station,
        route,
        approachAngle: poseAt(line, line.length).angle,
      });
      segment.end = { station: stationId };
    } else {
      const switchId = switches.length;
      const sw: TrackSwitch = { id: switchId, at: end, exits: [-1, -1], exitAngles: [0, 0] };
      switches.push(sw);
      segment.end = { switch: switchId };
      const left = visit(leg.to.left, end, { switch: switchId }, [...route, [switchId, 0]]);
      const right = visit(leg.to.right, end, { switch: switchId }, [...route, [switchId, 1]]);
      sw.exits = [left, right];
      sw.exitAngles = [left, right].map((exit) => {
        const exitLine = segments[exit].line;
        return poseAt(exitLine, Math.min(ARROW_LOOKAHEAD, exitLine.length)).angle;
      }) as [number, number];
    }
    return id;
  };

  visit(blueprint, tunnel.at, 'tunnel', []);
  const map: TrackMap = { key, tunnel, segments, switches, stations, decor: [], ponds: [], fireflies: [], patches: [] };
  return { ...map, ...growNature(map) };
}

function distToPolyline(p: Point, points: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

const DECOR_WEIGHTS: [DecorKind, number][] = [
  ['pine', 0.3],
  ['tree', 0.2],
  ['bush', 0.2],
  ['rock', 0.1],
  ['flowers', 0.12],
  ['grass', 0.08],
];

function pickKind(roll: number): DecorKind {
  let sum = 0;
  for (const [kind, weight] of DECOR_WEIGHTS) {
    sum += weight;
    if (roll < sum) return kind;
  }
  return 'grass';
}

/** How far inside a pond's ellipse grown by `margin` the point is: below 1 means inside. */
function ellipseReach(p: Point, pond: Pond, margin: number): number {
  return ((p.x - pond.x) / (pond.rx + margin)) ** 2 + ((p.y - pond.y) / (pond.ry + margin)) ** 2;
}

/** Points every few units along every track, to keep things off the tracks. */
function trackSamples(map: TrackMap): Point[] {
  const out: Point[] = [];
  for (const s of map.segments) for (let d = 0; d <= s.line.length; d += 4) out.push(poseAt(s.line, d));
  return out;
}

/**
 * The night meadow around the tracks: a pond or two in the widest free spaces, then trees, bushes, rocks, flowers
 * and grass on a loose grid, fireflies, and lighter patches of grass on the ground. Nothing stands on a track, a
 * station, a switch or the tunnel.
 */
function growNature(map: TrackMap): Pick<TrackMap, 'decor' | 'ponds' | 'fireflies' | 'patches'> {
  const rng = createRng(seedFromString(`nature:${map.key}`));
  const samples = trackSamples(map);
  const tunnel = map.tunnel.at;
  const landmarks = [tunnel, ...map.stations.map((st) => st.at), ...map.switches.map((sw) => sw.at)];
  const trackDistance = (p: Point) => Math.min(...map.segments.map((s) => distToPolyline(p, s.line.points)));

  const ponds: Pond[] = [];
  for (let attempt = 0; attempt < 600 && ponds.length < 2; attempt++) {
    const rx = (ponds.length === 0 ? 30 : 22) + rng() * 10;
    const pond: Pond = { x: 0, y: 0, rx, ry: rx * 0.55 };
    pond.x = pond.rx + 10 + rng() * (BOARD.width - 2 * pond.rx - 20);
    pond.y = 80 + pond.ry + rng() * (BOARD.height - 110 - 2 * pond.ry);
    if (samples.some((p) => ellipseReach(p, pond, 14) < 1)) continue;
    if (landmarks.some((p) => ellipseReach(p, pond, 34) < 1)) continue;
    if (ponds.some((o) => Math.hypot(o.x - pond.x, o.y - pond.y) < o.rx + pond.rx + 30)) continue;
    ponds.push(pond);
  }

  const decor: Decor[] = [];
  const step = 20;
  for (let gy = step / 2; gy < BOARD.height; gy += step) {
    for (let gx = step / 2; gx < BOARD.width; gx += step) {
      const x = gx + (rng() - 0.5) * 14;
      const y = gy + (rng() - 0.5) * 14;
      const kind = pickKind(rng());
      const scale = 0.8 + rng() * 0.35;
      const variant: 0 | 1 = rng() < 0.5 ? 0 : 1;
      if (rng() < 0.45) continue;
      const item: Decor = { kind, x, y, scale, variant };
      const f = decorFootprint(item);
      if (f.x - f.r < 2 || f.x + f.r > BOARD.width - 2 || f.y - f.r < 2 || f.y + f.r > BOARD.height - 2) continue;
      if (Math.hypot(f.x - tunnel.x, f.y - tunnel.y) < f.r + 32) continue;
      if (trackDistance(f) < f.r + 10) continue;
      if (map.stations.some((st) => Math.hypot(f.x - st.at.x, f.y - st.at.y) < f.r + 28)) continue;
      if (map.switches.some((sw) => Math.hypot(f.x - sw.at.x, f.y - sw.at.y) < f.r + 30)) continue;
      if (ponds.some((pond) => ellipseReach(f, pond, f.r + 2) < 1)) continue;
      if (decor.some((o) => {
        const g = decorFootprint(o);
        return Math.hypot(f.x - g.x, f.y - g.y) < 0.7 * (f.r + g.r);
      })) continue;
      decor.push(item);
    }
  }
  decor.sort((a, b) => a.y - b.y);

  const fireflies: Point[] = [];
  for (let attempt = 0; attempt < 400 && fireflies.length < 12; attempt++) {
    const p = { x: 12 + rng() * (BOARD.width - 24), y: 60 + rng() * (BOARD.height - 80) };
    if (trackDistance(p) < 18) continue;
    if (fireflies.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 40)) continue;
    fireflies.push(p);
  }

  const patches: Patch[] = Array.from({ length: 8 }, () => ({
    x: rng() * BOARD.width,
    y: rng() * BOARD.height,
    rx: 40 + rng() * 50,
    ry: 18 + rng() * 22,
  }));

  return { decor, ponds, fireflies, patches };
}

const mirrorPoint = (p: Point): Point => ({ x: BOARD.width - p.x, y: p.y });
const mirrorAngle = (angle: number): number => 180 - angle;

/** The same map seen in a mirror (left and right swapped). Routes and option numbers stay the same. */
export function mirrorMap(map: TrackMap): TrackMap {
  return {
    key: `${map.key}m`,
    tunnel: { at: mirrorPoint(map.tunnel.at), angle: mirrorAngle(map.tunnel.angle) },
    segments: map.segments.map((s) => ({ ...s, line: polyline(s.line.points.map(mirrorPoint)) })),
    switches: map.switches.map((s) => ({
      ...s,
      at: mirrorPoint(s.at),
      exitAngles: [mirrorAngle(s.exitAngles[0]), mirrorAngle(s.exitAngles[1])],
    })),
    stations: map.stations.map((s) => ({ ...s, at: mirrorPoint(s.at), approachAngle: mirrorAngle(s.approachAngle) })),
    decor: map.decor.map((d) => ({ ...d, x: BOARD.width - d.x })),
    ponds: map.ponds.map((p) => ({ ...p, x: BOARD.width - p.x })),
    fireflies: map.fireflies.map(mirrorPoint),
    patches: map.patches.map((p) => ({ ...p, x: BOARD.width - p.x })),
  };
}

/** Levels 1–2 → 3 stations, 3–4 → 4, 5–6 → 5, 7–8 → 6, 9–10 → 7. */
export function stationCountForLevel(level: number): number {
  return 3 + Math.floor((clampLevel(level) - 1) / 2);
}

export const ALL_MAPS: readonly TrackMap[] = [3, 4, 5, 6, 7].flatMap((n) => {
  const map = compileMap(BLUEPRINTS[n], String(n), TUNNELS[n]);
  return [map, mirrorMap(map)];
});

export function mapFor(stationCount: number, mirrored: boolean): TrackMap {
  const key = `${stationCount}${mirrored ? 'm' : ''}`;
  const map = ALL_MAPS.find((m) => m.key === key);
  if (!map) throw new Error(`No map with ${stationCount} stations`);
  return map;
}
